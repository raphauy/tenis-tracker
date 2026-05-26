// Destino post-login. Siempre la raíz: el proxy resuelve `/` → /[slug] del usuario
// (o /onboarding si todavía no eligió slug), sin que el cliente necesite conocer el slug.
export function getPostLoginUrl(): string {
  return '/'
}
