// Adapter de la fuente AUT Grados (MUR Academy). MUR es una app sobre Supabase y expone
// su backend por PostgREST con lectura anónima pública (anon key embebida en su bundle).
// Pegamos a esa REST API y delegamos el armado del cuadro al builder PURO. No toca Prisma.
// PII-safe: se piden SOLO los campos necesarios (jamás email/teléfono/nacimiento) y nunca
// se consulta la tabla `players`. Identidad por UUID estable (`mur:<id>`). Ver research +
// docs/PRPs/cuadros-prp.md § Known Gotchas.

import { slugify } from '@/lib/slug'
import type { MurConfig } from '@/lib/cuadros/sources'
import type {
  DiscoveredCategory,
  DiscoveredTournament,
  SourceAdapter,
} from '@/lib/cuadros/types'
import { buildBracket, type MurMatch, type MurRegistration } from './builder'

const TYPE = 'mur-supabase'

function apiKey(): string {
  const key = process.env.MUR_SUPABASE_ANON_KEY
  if (!key) throw new Error('MUR_SUPABASE_ANON_KEY no configurado')
  return key
}

// GET a la REST API de MUR con la anon key (lectura pública). Lanza si no responde 2xx.
async function murGet<T>(baseUrl: string, path: string): Promise<T> {
  const key = apiKey()
  const res = await fetch(`${baseUrl}${path}`, {
    cache: 'no-store',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`MUR PostgREST ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

// "mayo-2026" desde la fecha (UTC, determinista). Los meses en español no llevan tildes →
// directos para el slug.
function periodSlug(d: Date): string {
  const month = new Intl.DateTimeFormat('es', { month: 'long', timeZone: 'UTC' }).format(d).toLowerCase()
  return `${month}-${d.getUTCFullYear()}`
}

export const murSupabaseAdapter: SourceAdapter = {
  type: TYPE,
  // MUR no flipea (UUID estables): se archiva cuando el cuadro está completo. Ver glosario.
  archivePolicy: 'completion',

  async discoverTournaments(config) {
    const { baseUrl, nameFilter } = config as MurConfig
    const rows = await murGet<{ id: string; name: string; start_date: string | null }[]>(
      baseUrl,
      `/tournaments?name=ilike.*${nameFilter}*&deleted=eq.0&select=id,name,start_date&order=start_date.desc`
    )
    // Slug legible: nombre + período (mes/año). Dedup dentro del batch para no chocar con
    // el @unique de slug (dos etapas homónimas del mismo mes → sufijo -2). El identityKey
    // (uuid) es la clave de upsert; el slug es solo para la URL.
    const used = new Set<string>()
    return rows.map((t): DiscoveredTournament => {
      const startDate = t.start_date ? new Date(t.start_date) : null
      const base = slugify(t.name) || 'mur'
      const period = startDate ? `-${periodSlug(startDate)}` : ''
      let slug = `${base}${period}`
      let n = 2
      while (used.has(slug)) slug = `${base}${period}-${n++}`
      used.add(slug)
      return {
        identityKey: `mur:${t.id}`,
        slug,
        name: t.name.trim(),
        startDate,
        locator: { tournamentId: t.id },
      }
    })
  },

  async discoverCategories(config, tournament) {
    const { baseUrl } = config as MurConfig
    const { tournamentId } = tournament.locator as { tournamentId: string }
    const rows = await murGet<{ id: string; name: string; display_order: number | null }[]>(
      baseUrl,
      `/tournament_circuits?tournament_id=eq.${tournamentId}&deleted=eq.0&order=display_order&select=id,name,display_order`
    )
    const used = new Set<string>()
    return rows.map((c, i): DiscoveredCategory => {
      const base = slugify(c.name) || `cat-${i}`
      let slug = base
      let n = 2
      while (used.has(slug)) slug = `${base}-${n++}`
      used.add(slug)
      return {
        categoryName: c.name.trim(),
        slug,
        displayOrder: c.display_order ?? i,
        locator: { circuitId: c.id },
      }
    })
  },

  async fetchBracket(config, category) {
    const { baseUrl } = config as MurConfig
    const { circuitId } = category.locator as { circuitId: string }
    // Solo el cuadro principal (bracket_type=main); las consolaciones quedan post-feature.
    const matches = await murGet<MurMatch[]>(
      baseUrl,
      `/matches?circuit_id=eq.${circuitId}&bracket_type=eq.main&order=match_number&select=match_number,round,player1_id,player2_id,winner_id,player1_score,player2_score,status`
    )
    // PII-safe: solo nombre + siembra + id global; nunca email/teléfono/nacimiento.
    const registrations = await murGet<MurRegistration[]>(
      baseUrl,
      `/registrations?circuit_id=eq.${circuitId}&select=id,player_name,seed_position,player_id`
    )
    const normalized = buildBracket(matches, registrations)
    if (!normalized) return null // sin matches → etapa en inscripción (sin draw)
    // El crudo guardado es el payload PII-safe (no se persiste PII).
    const raw = JSON.stringify({ matches, registrations })
    return { normalized, raw, categoryName: category.categoryName }
  },
}
