import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma, withRetry } from '@/lib/prisma'
import { SOURCES } from '@/lib/cuadros/sources'
import { adapterFor } from '@/lib/cuadros/adapters'
import type { NormalizedBracket } from '@/lib/cuadros/types'
import { getSuperadminEmails } from '@/services/user-service'
import { sendSyncAlertEmail } from '@/services/email-service'

// Única capa Prisma de la feature cuadros. Los adapters/parsers (src/lib/cuadros/)
// son puros; acá vive la persistencia y el orquestador del sync.

// ---------- Tipos de lectura ----------

export type ExternalTournamentListItem = Prisma.ExternalTournamentGetPayload<{
  include: { _count: { select: { brackets: true } } }
}>

export type ExternalTournamentWithBrackets = Prisma.ExternalTournamentGetPayload<{
  include: { brackets: true }
}>

// ---------- Data access ----------

export async function upsertTournament(
  identityKey: string,
  input: { sourceType: string; slug: string; name: string; startDate: Date | null }
) {
  return withRetry(() =>
    prisma.externalTournament.upsert({
      where: { identityKey },
      create: {
        identityKey,
        sourceType: input.sourceType,
        slug: input.slug,
        name: input.name,
        startDate: input.startDate,
        status: 'LIVE',
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
      update: {
        slug: input.slug,
        name: input.name,
        startDate: input.startDate,
        status: 'LIVE',
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
    })
  )
}

export async function upsertBracket(
  tournamentId: string,
  slug: string,
  input: {
    categoryName: string
    data: NormalizedBracket
    rawHash: string
    rawSnapshot: string
    displayOrder: number
  }
) {
  const data = input.data as unknown as Prisma.InputJsonValue
  return withRetry(() =>
    prisma.externalBracket.upsert({
      where: { tournamentId_slug: { tournamentId, slug } },
      create: {
        tournamentId,
        slug,
        categoryName: input.categoryName,
        format: 'BRACKET',
        data,
        rawHash: input.rawHash,
        rawSnapshot: input.rawSnapshot,
        displayOrder: input.displayOrder,
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
      update: {
        categoryName: input.categoryName,
        data,
        rawHash: input.rawHash,
        rawSnapshot: input.rawSnapshot,
        displayOrder: input.displayOrder,
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
    })
  )
}

// Flip: torneos de la fuente que ya no aparecen → ARCHIVED (congelados). NUNCA
// archivar sin discovery válido (seenKeys vacío = no se descubrió nada).
export async function archiveMissing(sourceType: string, seenKeys: string[]) {
  if (seenKeys.length === 0) return undefined
  return withRetry(() =>
    prisma.externalTournament.updateMany({
      where: { sourceType, status: 'LIVE', identityKey: { notIn: seenKeys } },
      data: { status: 'ARCHIVED' },
    })
  )
}

// Reconciliación por categoría dentro de un torneo: borra los brackets cuya hoja ya no
// aparece en la fuente (eliminada o renombrada → cambió el slug), evitando categorías
// fantasma. `seenSlugs` son TODAS las categorías descubiertas (incluidas las que solo
// fallaron el fetch este ciclo → conservan su último cuadro bueno). NUNCA borrar sin
// discovery válido (seenSlugs vacío) para no vaciar el torneo por un fallo transitorio.
export async function deleteMissingBrackets(tournamentId: string, seenSlugs: string[]) {
  if (seenSlugs.length === 0) return undefined
  return withRetry(() =>
    prisma.externalBracket.deleteMany({
      where: { tournamentId, slug: { notIn: seenSlugs } },
    })
  )
}

export async function recordTournamentSyncError(sourceType: string, message: string) {
  return withRetry(() =>
    prisma.externalTournament.updateMany({
      where: { sourceType, status: 'LIVE' },
      data: { lastSyncError: message },
    })
  )
}

export async function recordBracketSyncError(tournamentId: string, slug: string, message: string) {
  return withRetry(() =>
    prisma.externalBracket.updateMany({
      where: { tournamentId, slug },
      data: { lastSyncError: message },
    })
  )
}

// ¿La fuente venía sana (sin error en sus torneos vivos) antes de este intento?
// LIMITACIÓN CONOCIDA: el dedup de alertas se apoya en persistir el error en una fila de
// torneo LIVE. Si la fuente está rota ANTES del primer sync exitoso (no hay ningún torneo
// en DB), recordTournamentSyncError actualiza 0 filas → esto devuelve true en cada corrida
// y se alerta cada ciclo hasta el primer sync OK. Aceptado: solo ocurre con fuente rota
// desde cero (algo que igual conviene avisar). Tras el primer sync exitoso, dedup correcto.
async function sourceWasHealthy(sourceType: string): Promise<boolean> {
  const errored = await withRetry(() =>
    prisma.externalTournament.count({
      where: { sourceType, status: 'LIVE', lastSyncError: { not: null } },
    })
  )
  return errored === 0
}

// ---------- Lectura para la UI ----------

export async function listTournaments(): Promise<ExternalTournamentListItem[]> {
  return withRetry(() =>
    prisma.externalTournament.findMany({
      orderBy: [{ startDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      include: { _count: { select: { brackets: true } } },
    })
  )
}

export async function getTournamentBySlug(
  slug: string
): Promise<ExternalTournamentWithBrackets | null> {
  return withRetry(() =>
    prisma.externalTournament.findUnique({
      where: { slug },
      include: { brackets: { orderBy: { displayOrder: 'asc' } } },
    })
  )
}

export async function getBracketBySlug(tournamentSlug: string, categorySlug: string) {
  return withRetry(async () => {
    const tournament = await prisma.externalTournament.findUnique({
      where: { slug: tournamentSlug },
    })
    if (!tournament) return null
    const bracket = await prisma.externalBracket.findUnique({
      where: { tournamentId_slug: { tournamentId: tournament.id, slug: categorySlug } },
    })
    if (!bracket) return null
    return { tournament, bracket }
  })
}

export async function listForAdmin(): Promise<ExternalTournamentWithBrackets[]> {
  return withRetry(() =>
    prisma.externalTournament.findMany({
      orderBy: [{ status: 'asc' }, { startDate: { sort: 'desc', nulls: 'last' } }],
      include: { brackets: { orderBy: { displayOrder: 'asc' } } },
    })
  )
}

// ---------- Orquestador del sync ----------

export type SyncReport = {
  tournaments: number
  brackets: number
  skipped: number
  archived: number
  removedBrackets: number
  errors: { source: string; message: string }[]
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

// Sincroniza todas las fuentes. Un fallo de una fuente NO aborta las demás.
// - Falla de discovery → no archiva, registra error, alerta (solo en transición ok→fallo).
// - Falla de UNA categoría → se omite, conserva su último cuadro bueno, registra error.
export async function syncExternalBrackets(): Promise<SyncReport> {
  const report: SyncReport = { tournaments: 0, brackets: 0, skipped: 0, archived: 0, removedBrackets: 0, errors: [] }

  for (const source of SOURCES) {
    try {
      const adapter = adapterFor(source.type)
      const tournaments = await adapter.discoverTournaments(source.config)
      const seenKeys: string[] = []

      for (const t of tournaments) {
        seenKeys.push(t.identityKey)
        const row = await upsertTournament(t.identityKey, {
          sourceType: source.type,
          slug: t.slug,
          name: t.name,
          startDate: t.startDate,
        })
        report.tournaments++

        const categories = await adapter.discoverCategories(source.config, t)
        const seenSlugs: string[] = []
        for (const c of categories) {
          try {
            const res = await adapter.fetchBracket(source.config, c)
            if (!res) {
              // null = round-robin / otra etapa / no-bracket: NO es categoría de este
              // torneo. Se omite de seenSlugs para que la reconciliación borre un bracket
              // viejo guardado bajo este slug (no se "conserva" como cuadro bueno).
              report.skipped++
              continue
            }
            await upsertBracket(row.id, c.slug, {
              categoryName: res.categoryName,
              data: res.normalized,
              rawHash: sha256(res.raw),
              rawSnapshot: res.raw,
              displayOrder: c.displayOrder,
            })
            seenSlugs.push(c.slug)
            report.brackets++
          } catch (e) {
            seenSlugs.push(c.slug) // fetch falló (transitorio): conservar el último cuadro bueno
            await recordBracketSyncError(row.id, c.slug, errMsg(e))
            report.errors.push({ source: `${source.type}/${c.slug}`, message: errMsg(e) })
          }
        }

        // Reconcilia: borra brackets cuya hoja desapareció/renombró (categorías fantasma).
        const removed = await deleteMissingBrackets(row.id, seenSlugs)
        report.removedBrackets += removed?.count ?? 0
      }

      const archived = await archiveMissing(source.type, seenKeys)
      report.archived += archived?.count ?? 0
    } catch (e) {
      const message = errMsg(e)
      const wasHealthy = await sourceWasHealthy(source.type)
      await recordTournamentSyncError(source.type, message)
      report.errors.push({ source: source.type, message })
      if (wasHealthy) {
        // El fallo del envío de alerta no debe tumbar el sync.
        try {
          const to = await getSuperadminEmails()
          await sendSyncAlertEmail({ to, source: source.type, error: message })
        } catch (mailErr) {
          report.errors.push({ source: `${source.type}/alerta`, message: errMsg(mailErr) })
        }
      }
    }
  }

  return report
}
