import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma, withRetry } from '@/lib/prisma'
import { SOURCES } from '@/lib/cuadros/sources'
import { adapterFor } from '@/lib/cuadros/adapters'
import { isBracketComplete } from '@/lib/cuadros/bracket-status'
import type { NormalizedBracket } from '@/lib/cuadros/types'

// Tras este lapso desde startDate, un torneo 'completion' se archiva aunque su final no
// figure jugada (fallback ante metadata floja de la fuente; evita re-sincronizar para siempre).
const COMPLETION_FALLBACK_MS = 30 * 24 * 60 * 60 * 1000
import { getSuperadminEmails } from '@/services/user-service'
import { sendSyncAlertEmail } from '@/services/email-service'
import { normalizeName } from '@/lib/text'
import { detectNewResults, type DetectedResult } from '@/lib/cuadros/detect-results'
import { findByNameKeys, type FavoriteForNotification } from '@/services/favorite-service'
import {
  dispatchPendingNotifications,
  effectiveEmailMode,
  effectiveWhatsappMode,
  recordResults,
  type RecordResultInput,
} from '@/services/notification-service'
import type { NotifyOutcome } from '@prisma/client'

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
      // En update NO se pisan `slug` ni `status`: el slug se fija al crear (URLs estables
      // aunque la fuente renombre) y el status lo gobiernan archiveMissing / completitud.
      update: {
        name: input.name,
        startDate: input.startDate,
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
    })
  )
}

// Lookup liviano por identityKey (para saber si un torneo ya está archivado y congelarlo).
export async function findTournamentByIdentityKey(identityKey: string) {
  return withRetry(() =>
    prisma.externalTournament.findUnique({
      where: { identityKey },
      select: { id: true, status: true },
    })
  )
}

export async function setTournamentStatus(id: string, status: 'LIVE' | 'ARCHIVED') {
  return withRetry(() =>
    prisma.externalTournament.update({ where: { id }, data: { status } })
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

// Solo torneos En curso (LIVE, no archivados) — para el acceso destacado de la landing.
export async function listLiveTournaments(): Promise<ExternalTournamentListItem[]> {
  return withRetry(() =>
    prisma.externalTournament.findMany({
      where: { status: 'LIVE' },
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
    // `siblings` = todas las categorías del torneo (livianas), para el switcher de la page.
    const [bracket, siblings] = await Promise.all([
      prisma.externalBracket.findUnique({
        where: { tournamentId_slug: { tournamentId: tournament.id, slug: categorySlug } },
      }),
      prisma.externalBracket.findMany({
        where: { tournamentId: tournament.id },
        select: { slug: true, categoryName: true },
        orderBy: { displayOrder: 'asc' },
      }),
    ])
    if (!bracket) return null
    return { tournament, bracket, siblings }
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

// ---------- Motor de notificaciones (enganchado al sync) ----------

// Snapshot viejo del bracket ANTES del upsert (para diffear) + flag de baseline.
async function getBracketForSync(tournamentId: string, slug: string) {
  return withRetry(() =>
    prisma.externalBracket.findUnique({
      where: { tournamentId_slug: { tournamentId, slug } },
      select: { id: true, data: true, rawHash: true, notificationsBaselineAt: true },
    })
  )
}

async function markBracketBaselined(bracketId: string) {
  return withRetry(() =>
    prisma.externalBracket.update({
      where: { id: bracketId },
      data: { notificationsBaselineAt: new Date() },
    })
  )
}

type DetectContext = {
  tournamentId: string
  tournamentName: string
  tournamentSlug: string
  categoryName: string
  categorySlug: string
}

type ExistingBracket = {
  id: string
  data: unknown
  rawHash: string
  notificationsBaselineAt: Date | null
}

// Baseline (cuadro nuevo o preexistente sin baseline) → registrar SIN notificar. Si ya
// baselined y el crudo cambió → diff old↔new → cruce con favoritos → bandeja. NEW-ONLY.
async function detectAndRecord(
  existing: ExistingBracket | null,
  bracketId: string,
  newData: NormalizedBracket,
  newHash: string,
  ctx: DetectContext
): Promise<void> {
  if (!existing || existing.notificationsBaselineAt == null) {
    await markBracketBaselined(bracketId)
    return
  }
  if (existing.rawHash === newHash) return // sin cambios → nada que detectar
  const events = detectNewResults(existing.data as NormalizedBracket, newData)
  if (events.length === 0) return

  const names = new Set<string>()
  for (const e of events) {
    names.add(normalizeName(e.winnerName))
    if (e.loserName) names.add(normalizeName(e.loserName))
  }
  const favs = await findByNameKeys([...names])
  if (favs.length === 0) return

  const byKey = new Map<string, FavoriteForNotification[]>()
  for (const f of favs) {
    const list = byKey.get(f.nameKey) ?? []
    list.push(f)
    byKey.set(f.nameKey, list)
  }

  const inputs: RecordResultInput[] = []
  for (const e of events) {
    for (const f of byKey.get(normalizeName(e.winnerName)) ?? []) {
      if (couldDeliver(f)) {
        inputs.push(buildInput(e, f, 'winner', e.isFinal ? 'CHAMPION' : 'WON', bracketId, ctx))
      }
    }
    if (e.loserName) {
      for (const f of byKey.get(normalizeName(e.loserName)) ?? []) {
        if (couldDeliver(f)) {
          inputs.push(buildInput(e, f, 'loser', e.isFinal ? 'FINALIST' : 'LOST', bracketId, ctx))
        }
      }
    }
  }
  await recordResults(inputs)
}

// ¿Algún canal podría entregar el aviso? (toggle del favorito + modo del dueño). Evita crear
// filas muertas para "rivales" silenciados o usuarios con todos los canales apagados.
function couldDeliver(f: FavoriteForNotification): boolean {
  const emailOk = f.notifyEmail && effectiveEmailMode(f.user) !== 'OFF'
  const whatsappOk = f.notifyWhatsapp && effectiveWhatsappMode(f.user) !== 'OFF'
  return emailOk || whatsappOk
}

function buildInput(
  e: DetectedResult,
  f: FavoriteForNotification,
  role: 'winner' | 'loser',
  outcome: NotifyOutcome,
  bracketId: string,
  ctx: DetectContext
): RecordResultInput {
  const isWinner = role === 'winner'
  return {
    userId: f.userId,
    nameKey: f.nameKey,
    playerName: isWinner ? e.winnerName : (e.loserName ?? f.name),
    tournamentId: ctx.tournamentId,
    bracketId,
    roundIndex: e.roundIndex,
    matchSlot: e.matchSlot,
    outcome,
    tournamentName: ctx.tournamentName,
    categoryName: ctx.categoryName,
    roundLabel: e.roundLabel,
    nextRoundLabel: outcome === 'WON' ? e.nextRoundLabel : null,
    opponentName: isWinner ? e.loserName : e.winnerName,
    score: e.score,
    tournamentSlug: ctx.tournamentSlug,
    categorySlug: ctx.categorySlug,
  }
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

      const completion = adapter.archivePolicy === 'completion'

      for (const t of tournaments) {
        seenKeys.push(t.identityKey)

        // Fuentes 'completion' (MUR no flipea): un torneo ya archivado se CONGELA — no se
        // re-baja ni se re-toca (ni lastSyncedAt), conservando su último snapshot.
        if (completion) {
          const existing = await findTournamentByIdentityKey(t.identityKey)
          if (existing?.status === 'ARCHIVED') continue
        }

        const row = await upsertTournament(t.identityKey, {
          sourceType: source.type,
          slug: t.slug,
          name: t.name,
          startDate: t.startDate,
        })
        report.tournaments++

        const categories = await adapter.discoverCategories(source.config, t)
        const seenSlugs: string[] = []
        let bracketsBuilt = 0
        let allComplete = true // se vuelve false ante un bracket incompleto o un error
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
            const existingBracket = await getBracketForSync(row.id, c.slug)
            const newHash = sha256(res.raw)
            const bracket = await upsertBracket(row.id, c.slug, {
              categoryName: res.categoryName,
              data: res.normalized,
              rawHash: newHash,
              rawSnapshot: res.raw,
              displayOrder: c.displayOrder,
            })
            seenSlugs.push(c.slug)
            report.brackets++
            bracketsBuilt++
            if (!isBracketComplete(res.normalized)) allComplete = false

            // Motor de notificaciones: baseline / diff old↔new → bandeja (NEW-ONLY).
            await detectAndRecord(existingBracket, bracket.id, res.normalized, newHash, {
              tournamentId: row.id,
              tournamentName: row.name,
              tournamentSlug: row.slug,
              categoryName: res.categoryName,
              categorySlug: c.slug,
            })
          } catch (e) {
            seenSlugs.push(c.slug) // fetch falló (transitorio): conservar el último cuadro bueno
            allComplete = false // sin confirmar todas las finales → no archivar todavía
            await recordBracketSyncError(row.id, c.slug, errMsg(e))
            report.errors.push({ source: `${source.type}/${c.slug}`, message: errMsg(e) })
          }
        }

        // Reconcilia: borra brackets cuya hoja desapareció/renombró (categorías fantasma).
        const removed = await deleteMissingBrackets(row.id, seenSlugs)
        report.removedBrackets += removed?.count ?? 0

        // Archivado por completitud (fuentes 'completion'): todas las finales jugadas, o
        // fallback de antigüedad si la fuente nunca marca la final. Al archivar, el próximo
        // sync lo congela (no se vuelve a bajar).
        if (completion && bracketsBuilt > 0) {
          const old = !!t.startDate && Date.now() - t.startDate.getTime() > COMPLETION_FALLBACK_MS
          if (allComplete || old) {
            await setTournamentStatus(row.id, 'ARCHIVED')
            report.archived++
          }
        }
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

  // Dispatch inmediato de los avisos creados en este run. No tumba el sync si falla; los
  // pendientes/fallidos se reintentan el próximo run (o el digest, para email DIGEST).
  try {
    const d = await dispatchPendingNotifications()
    if (d.sent || d.failed) {
      console.log(`[notif] dispatch: ${d.sent} enviados, ${d.failed} fallidos, ${d.skipped} omitidos`)
    }
  } catch (e) {
    report.errors.push({ source: 'notificaciones/dispatch', message: errMsg(e) })
  }

  return report
}
