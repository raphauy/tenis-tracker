// Adapter de la fuente Academia MG (Google Sheets). Hace fetch (CSV export + Sheets
// API para enumerar hojas) y delega el parseo al parser PURO. No toca Prisma.
// Gids auto-descubiertos (NO hardcodear: cambian entre etapas). La identidad del
// torneo es por CONTENIDO (etapa+año del header), no por spreadsheetId. Ver ADR 0003.

import { slugify } from '@/lib/slug'
import { parseCsv } from '@/lib/cuadros/csv'
import type { AcademiaConfig } from '@/lib/cuadros/sources'
import type {
  DiscoveredCategory,
  DiscoveredTournament,
  SourceAdapter,
} from '@/lib/cuadros/types'
import { academiaIdentity, parseBracket, parseHeader, type AcademiaHeader } from './parser'

const TYPE = 'google-sheets-academia'

type SheetMeta = { gid: number; title: string }

function apiKey(): string {
  const key = process.env.GOOGLE_SHEETS_API_KEY
  if (!key) throw new Error('GOOGLE_SHEETS_API_KEY no configurado')
  return key
}

// Enumera las hojas (gid + título) vía Sheets API v4 (key gratis para hojas públicas).
async function listSheets(spreadsheetId: string): Promise<SheetMeta[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)&key=${apiKey()}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Sheets API ${res.status}: no se pudieron listar las hojas`)
  const json = (await res.json()) as {
    sheets?: { properties?: { sheetId?: number; title?: string } }[]
  }
  const sheets = (json.sheets ?? [])
    .map((s) => ({ gid: s.properties?.sheetId ?? -1, title: (s.properties?.title ?? '').trim() }))
    .filter((s) => s.gid >= 0)
  if (sheets.length === 0) throw new Error('La planilla no tiene hojas legibles')
  return sheets
}

// Baja una hoja como CSV (sin auth; el export es público).
async function fetchSheetCsv(spreadsheetId: string, gid: number): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`CSV export ${res.status}: no se pudo bajar la hoja gid=${gid}`)
  return res.text()
}

export const googleSheetsAcademiaAdapter: SourceAdapter = {
  type: TYPE,

  async discoverTournaments(config) {
    const { spreadsheetId } = config as AcademiaConfig
    const sheets = await listSheets(spreadsheetId)
    // El header (etapa/año) es el mismo en las hojas de la etapa vigente, pero la
    // planilla tiene hojas que NO lo traen (Rankings, plantillas vacías, sobras de
    // ediciones viejas con "EDICIÓN:" en vez de "ETAPA"). Escaneamos hasta encontrar
    // la primera hoja con un header de etapa válido.
    let header: AcademiaHeader | null = null
    for (const s of sheets) {
      header = parseHeader(parseCsv(await fetchSheetCsv(spreadsheetId, s.gid)))
      if (header) break
    }
    if (!header) throw new Error('No se pudo parsear la etapa/año en ninguna hoja de la planilla')
    const { identityKey, slug } = academiaIdentity(header.year, header.etapaNumber)
    const tournament: DiscoveredTournament = {
      identityKey,
      slug,
      name: `La Academia MG ${header.year} — Etapa ${header.etapaNumber}`,
      startDate: header.startDate,
      // sheets se reusa en discoverCategories (sin re-fetch); year/etapaNumber viajan
      // para filtrar en fetchBracket las hojas que son de OTRA etapa/edición.
      locator: { sheets, year: header.year, etapaNumber: header.etapaNumber },
    }
    return [tournament]
  },

  async discoverCategories(_config, tournament) {
    const { sheets, year, etapaNumber } = tournament.locator as {
      sheets: SheetMeta[]
      year: number
      etapaNumber: number
    }
    const used = new Set<string>()
    return sheets.map((s, i): DiscoveredCategory => {
      const base = slugify(s.title) || `cat-${i}`
      let slug = base
      let n = 2
      while (used.has(slug)) slug = `${base}-${n++}`
      used.add(slug)
      return { categoryName: s.title, slug, displayOrder: i, locator: { gid: s.gid, year, etapaNumber } }
    })
  },

  async fetchBracket(config, category) {
    const { spreadsheetId } = config as AcademiaConfig
    const { gid, year, etapaNumber } = category.locator as {
      gid: number
      year: number
      etapaNumber: number
    }
    const csv = await fetchSheetCsv(spreadsheetId, gid)
    const rows = parseCsv(csv)
    const normalized = parseBracket(rows)
    if (!normalized) return null // round-robin (SERIE) u otro → se omite en F1

    // Filtro por identidad: una hoja de bracket que trae el header de OTRA etapa/año
    // (sobra de una edición vieja) NO es categoría del torneo vigente → se omite. Solo
    // se descarta ante un header presente y distinto; sin header parseable se conserva
    // (parseBracket ya validó la geometría).
    const header = parseHeader(rows)
    if (header && (header.etapaNumber !== etapaNumber || header.year !== year)) return null

    // Nombre autoritativo del contenido (celda "Categoría:"); el slug/clave del
    // bracket lo aporta el discovery (category.slug, estable dentro del torneo).
    const categoryName = header?.categoryName || category.categoryName
    return { normalized, raw: csv, categoryName }
  },
}
