import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getUserAccessInfo } from '@/services/user-service'
import { RESERVED_SLUGS } from '@/lib/slug'

// Las subrutas privadas del perfil (nuevo/participacion/ajustes) exigen sesión + slug;
// la autorización fina (ser el dueño) la hace la page, no el proxy.
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const segments = pathname.split('/').filter(Boolean)
  const firstSeg = segments[0]

  // Siempre públicas sin sesión: login, rutas de API (NextAuth) y los cuadros
  // externos (/cuadros/*). `cuadros` está en RESERVED_SLUGS (no es un perfil),
  // así que sin este short-circuit caería al gate de sesión de abajo.
  if (pathname === '/login' || firstSeg === 'api' || firstSeg === 'cuadros') {
    return NextResponse.next()
  }

  // Clasificación de rutas SIN tocar la DB. Los reservados (admin, login, ...) nunca
  // pueden ser un slug, así que ganan sobre /[slug].
  const isReservedFirst = firstSeg ? RESERVED_SLUGS.has(firstSeg) : false
  const isPublicProfile =
    !isReservedFirst &&
    (segments.length === 1 || (segments.length === 2 && segments[1] === 'stats'))

  // Perfil público (/[slug] y /[slug]/stats): accesible sin sesión.
  // La page decide notFound (slug inexistente) o "perfil privado".
  if (isPublicProfile) {
    return NextResponse.next()
  }

  const isProduction = process.env.NODE_ENV === 'production'
  const cookieName = isProduction
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    cookieName,
  })

  // Sin sesión.
  if (!token) {
    // Landing anónima.
    if (pathname === '/') {
      return NextResponse.next()
    }
    // Onboarding, /admin, subrutas privadas, etc.: exigen sesión.
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Re-leer de la DB: control de acceso real (estado/rol/slug actuales).
  const user = await getUserAccessInfo(token.id as string)

  if (!user || !user.isActive) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('authjs.session-token')
    response.cookies.delete('__Secure-authjs.session-token')
    return response
  }

  // Onboarding: si ya tiene slug, no corresponde; si no, dejar pasar.
  if (pathname === '/onboarding') {
    return user.slug
      ? NextResponse.redirect(new URL(`/${user.slug}`, request.url))
      : NextResponse.next()
  }

  // Sin slug todavía: forzar onboarding antes de usar la app.
  if (!user.slug) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  // La raíz `/` (landing) es visible también logueado: NO se redirige al perfil.
  // El usuario entra a sus torneos desde el botón de la landing o el avatar.

  // /admin/* solo SUPERADMIN.
  if (firstSeg === 'admin') {
    if (user.role !== 'SUPERADMIN') {
      return NextResponse.redirect(new URL(`/${user.slug}`, request.url))
    }
    return NextResponse.next()
  }

  // Subrutas privadas del perfil (nuevo/participacion/ajustes) y demás rutas
  // autenticadas: pasar; la page valida que el viewer sea el dueño.
  return NextResponse.next()
}

export const config = {
  // Excluir assets estáticos y de Next del proxy.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
}
