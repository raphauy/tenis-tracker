// Destino post-login según el rol. Función pura: usable en server (page) y client (form).
// Reusable para cualquier redirect basado en rol (ej. al entrar a /login ya logueado).
export function getPostLoginUrl(role?: string | null): string {
  if (role === 'SUPERADMIN') return '/admin'
  return '/app'
}
