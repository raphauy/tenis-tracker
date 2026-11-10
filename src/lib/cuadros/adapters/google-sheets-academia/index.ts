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
import {
  academiaIdentity,
  mastersIdentity,
  mastersStartDate,
  parseBracket,
  parseHeader,
  parseMastersSheet,
  type AcademiaHeader,
  type MastersBlock,
} from './parser'
import { recordResponse, recordThrown } from '@/services/health-service'

const TYPE = 'google-sheets-academia'

type SheetMeta = { gid: number; title: string }

// Locators internos (viajan en memoria entre discovery y fetch; no se persisten). La planilla
// expone dos tipos de torneo: la etapa vigente (una hoja = una categoría) y el Masters (UNA
// hoja con un cuadro por divisional, ya parseados en el discovery).
type EtapaTournamentLocator = { kind: 'etapa'; sheets: SheetMeta[]; year: number; etapaNumber: number }
type MastersTournamentLocator = { kind: 'masters'; blocks: MastersBlock[] }
type EtapaCategoryLocator = { kind: 'etapa'; gid: number; year: number; etapaNumber: number }
type MastersCategoryLocator = { kind: 'masters'; block: MastersBlock }

// Pestaña candidata a ser la del Masters; se confirma por contenido (bloques con jugadores).
const MASTERS_TAB = /masters|maestros/i

// Slugs únicos dentro de un torneo a partir de nombres visibles.
function uniqueSlugs(names: string[]): string[] {
  const used = new Set<string>()
  return names.map((name, i) => {
    const base = slugify(name) || `cat-${i}`
    let slug = base
    let n = 2
    while (used.has(slug)) slug = `${base}-${n++}`
    used.add(slug)
    return slug
  })
}

function apiKey(): string {
  const key = process.env.GOOGLE_SHEETS_API_KEY
  if (!key) throw new Error('GOOGLE_SHEETS_API_KEY no configurado')
  return key
}

// Enumera las hojas (gid + título) vía Sheets API v4 (key gratis para hojas públicas).
async function listSheets(spreadsheetId: string): Promise<SheetMeta[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)&key=${apiKey()}`
  const res = await sheetsFetch(url, 'sheets-api')
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
  const res = await sheetsFetch(url, 'csv-export')
  if (!res.ok) throw new Error(`CSV export ${res.status}: no se pudo bajar la hoja gid=${gid}`)
  return res.text()
}

/**
 * Las dos salidas a Google pasan por acá para dejar la señal del Componente
 * `google-sheets` que el /health le reporta a Cimarrón (ver health-service).
 *
 * Un 404 —planilla borrada o gid que ya no existe— no cuenta como fallo de Google:
 * es la config de la fuente que quedó vieja, y el sync lo reporta por su lado.
 */
async function sheetsFetch(url: string, context: string): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, { cache: 'no-store' })
  } catch (error) {
    await recordThrown('google-sheets', error, context)
    throw error
  }
  await recordResponse('google-sheets', res, { context })
  return res
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
    // Cache por gid dentro del discovery: las pestañas del Masters suelen ir ANTES de la
    // primera hoja de etapa, así que este escaneo ya las bajó.
    const csvByGid = new Map<number, string>()
    const csvOf = async (gid: number) => {
      const cached = csvByGid.get(gid)
      if (cached !== undefined) return cached
      const csv = await fetchSheetCsv(spreadsheetId, gid)
      csvByGid.set(gid, csv)
      return csv
    }
    let header: AcademiaHeader | null = null
    for (const s of sheets) {
      header = parseHeader(parseCsv(await csvOf(s.gid)))
      if (header) break
    }
    if (!header) throw new Error('No se pudo parsear la etapa/año en ninguna hoja de la planilla')
    const { identityKey, slug } = academiaIdentity(header.year, header.etapaNumber)
    const etapaLocator: EtapaTournamentLocator = {
      kind: 'etapa',
      sheets,
      year: header.year,
      etapaNumber: header.etapaNumber,
    }
    const tournament: DiscoveredTournament = {
      identityKey,
      slug,
      name: `La Academia MG ${header.year} — Etapa ${header.etapaNumber}`,
      startDate: header.startDate,
      // sheets se reusa en discoverCategories (sin re-fetch); year/etapaNumber viajan
      // para filtrar en fetchBracket las hojas que son de OTRA etapa/edición.
      locator: etapaLocator,
    }
    const tournaments = [tournament]

    // Masters ("Torneo de Maestros"): torneo APARTE de la misma planilla. La hoja no trae año
    // → se toma el de la etapa vigente. Solo existe si algún bloque tiene jugadores. Si la
    // hoja no se puede bajar, LANZA (como cualquier fallo de discovery): tragarse el error
    // haría que archiveMissing archive —sin vuelta— un Masters vivo por un fallo transitorio.
    // Se leen TODAS las pestañas candidatas (puede haber otra con "Masters" en el título que
    // no sea el cuadro, o el Masters repartido en dos); las que aportan cuadros salen de las
    // hojas de la etapa para no volver a bajarlas como categoría.
    const blocks: MastersBlock[] = []
    const mastersGids = new Set<number>()
    for (const s of sheets.filter((s) => MASTERS_TAB.test(s.title))) {
      const found = parseMastersSheet(parseCsv(await csvOf(s.gid)))
      if (found.length === 0) continue
      blocks.push(...found)
      mastersGids.add(s.gid)
    }
    if (blocks.length > 0) {
      etapaLocator.sheets = sheets.filter((s) => !mastersGids.has(s.gid))
      tournaments.push({
        ...mastersIdentity(header.year),
        name: `La Academia MG ${header.year} — Masters`,
        startDate: mastersStartDate(header.year), // la hoja no trae fecha: noviembre
        locator: { kind: 'masters', blocks } satisfies MastersTournamentLocator,
      })
    }
    return tournaments
  },

  async discoverCategories(_config, tournament) {
    const locator = tournament.locator as EtapaTournamentLocator | MastersTournamentLocator
    if (locator.kind === 'masters') {
      const slugs = uniqueSlugs(locator.blocks.map((b) => b.categoryName))
      return locator.blocks.map(
        (block, i): DiscoveredCategory => ({
          categoryName: block.categoryName,
          slug: slugs[i],
          displayOrder: i,
          locator: { kind: 'masters', block } satisfies MastersCategoryLocator,
        })
      )
    }
    const { sheets, year, etapaNumber } = locator
    const slugs = uniqueSlugs(sheets.map((s) => s.title))
    return sheets.map(
      (s, i): DiscoveredCategory => ({
        categoryName: s.title,
        slug: slugs[i],
        displayOrder: i,
        locator: { kind: 'etapa', gid: s.gid, year, etapaNumber } satisfies EtapaCategoryLocator,
      })
    )
  },

  async fetchBracket(config, category) {
    const { spreadsheetId } = config as AcademiaConfig
    const locator = category.locator as EtapaCategoryLocator | MastersCategoryLocator
    // Masters: el bloque ya vino parseado del discovery (misma hoja para todos los cuadros).
    if (locator.kind === 'masters') {
      const { bracket, raw, categoryName } = locator.block
      return { normalized: bracket, raw, categoryName }
    }
    const { gid, year, etapaNumber } = locator
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
