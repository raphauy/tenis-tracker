import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getUserAccessInfo } from '@/services/user-service'

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas (no requieren sesión).
  const publicRoutes = ['/', '/login', '/api/auth']
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || (route !== '/' && pathname.startsWith(`${route}/`))
  )

  if (isPublicRoute) {
    return NextResponse.next()
  }

  // NextAuth v5 / Auth.js usa el cookie name authjs.session-token.
  const isProduction = process.env.NODE_ENV === 'production'
  const cookieName = isProduction
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    cookieName,
  })

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Re-leer de la DB: control de acceso real (rol/estado actualizado).
  const user = await getUserAccessInfo(token.id as string)

  if (!user || !user.isActive) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('authjs.session-token')
    response.cookies.delete('__Secure-authjs.session-token')
    return response
  }

  // /admin/* solo SUPERADMIN.
  if (pathname.startsWith('/admin')) {
    if (user.role !== 'SUPERADMIN') {
      return NextResponse.redirect(new URL('/app', request.url))
    }
    return NextResponse.next()
  }

  // /app/* (y cualquier otra ruta privada): basta con sesión válida.
  return NextResponse.next()
}

export const config = {
  // Excluir assets estáticos y de Next del proxy.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
}
