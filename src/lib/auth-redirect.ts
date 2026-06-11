// Destino post-login por defecto: Cuadros. OJO: /cuadros es ruta pública (el proxy no la
// intercepta), así que el caso "usuario nuevo sin slug → /onboarding" lo resuelven los
// callers del lado server (afterLoginAction / login page) antes de usar esta URL.
export function getPostLoginUrl(): string {
  return '/cuadros'
}
