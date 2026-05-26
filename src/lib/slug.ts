// Helpers de slug del Perfil público (/[slug]). Puros: usables en client y server.

// Única fuente de verdad de "palabras prohibidas como slug": rutas de primer nivel
// del sistema (presentes y futuras) + internos de Next. Toda ruta top-level nueva
// debe sumarse acá para no colisionar con un slug ya registrado.
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'login',
  'admin',
  'api',
  'ajustes',
  'onboarding',
  'stats',
  'settings',
  'app',
  'u',
  'p',
  '_next',
  'favicon.ico',
])

export const SLUG_MIN = 3
export const SLUG_MAX = 30

// Formato canónico: minúsculas/números separados por guiones simples, sin bordes en guion.
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Deriva un slug sugerido a partir de un nombre libre.
// "Raphael Carvalho" → "raphael-carvalho"; "Peñarol 2026" → "penarol-2026".
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // tildes y ñ → ASCII
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // todo lo no alfanumérico → guion
    .replace(/-{2,}/g, '-') // colapsar guiones repetidos
    .slice(0, SLUG_MAX)
    .replace(/^-+|-+$/g, '') // recortar guiones de los bordes (también tras el slice)
}

export type SlugFormatError = 'length' | 'chars' | 'reserved'

// Valida las tres reglas del slug. No consulta la DB (eso es unicidad, va aparte).
export function validateSlugFormat(slug: string): { ok: true } | { ok: false; reason: SlugFormatError } {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) return { ok: false, reason: 'length' }
  if (!SLUG_REGEX.test(slug)) return { ok: false, reason: 'chars' }
  if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: 'reserved' }
  return { ok: true }
}
