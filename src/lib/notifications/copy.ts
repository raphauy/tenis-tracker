// Copy centralizado de las notificaciones de resultados. Puro (sin Prisma ni React): lo usan
// los componentes de email, el dispatch de WhatsApp (texto libre in-window + params del
// template) y el resumen diario. Strings en español con tildes.
// Ver docs/PRPs/notificaciones-prp.md § Desenlaces.

import { shortCategoryLabel } from '@/lib/cuadros/category-label'

export type NotifyOutcomeKey = 'WON' | 'LOST' | 'CHAMPION' | 'FINALIST'

// Vista renderizable de una notificación, denormalizada (no depende del cuadro vivo).
export type NotificationView = {
  playerName: string
  outcome: NotifyOutcomeKey
  tournamentName: string
  categoryName: string
  roundLabel: string
  nextRoundLabel: string | null
  opponentName: string | null
  score: string | null
  tournamentSlug: string
  categorySlug: string
}

export function bracketPath(n: NotificationView): string {
  return `/cuadros/${n.tournamentSlug}/${n.categorySlug}`
}

// Torneo + categoría corta, como se habla en el día a día ("La Academia MG 2026 — Etapa 3
// (Categoría B)"). El label corto es el mismo de las pills de /cuadros (shortCategoryLabel).
function torneoLabel(n: NotificationView): string {
  return `${n.tournamentName} (Categoría ${shortCategoryLabel(n.categoryName)})`
}

function safe(value: string | null | undefined, fallback: string): string {
  const v = value?.trim()
  return v ? v : fallback
}

// El score se guarda con los sets separados por espacio ("6-2 3-6 10-1"); para mostrarlo
// los separamos por coma, igual que el cuadro (ver bracket-match § ScoreSets). null si vacío.
function formatScore(score: string | null | undefined): string | null {
  const v = score?.trim()
  return v ? v.split(/\s+/).join(', ') : null
}

// Frase de una línea con el desenlace. Item del resumen y cuerpo del email inmediato.
export function notificationSummary(n: NotificationView): string {
  const fScore = formatScore(n.score)
  const score = fScore ? ` (${fScore})` : ''
  // "le ganó a" pero "perdió con": en rioplatense se pierde CON el rival, no A el rival.
  const vsWon = n.opponentName ? ` a ${n.opponentName}` : ''
  const vsLost = n.opponentName ? ` con ${n.opponentName}` : ''
  switch (n.outcome) {
    case 'CHAMPION':
      return `${n.playerName} se consagró campeón${score}`
    case 'FINALIST':
      return `${n.playerName} llegó a la final y quedó como finalista${score}`
    case 'WON': {
      const next = n.nextRoundLabel ? ` y avanza a ${n.nextRoundLabel}` : ' y avanza'
      return `${n.playerName} ganó en ${n.roundLabel}${vsWon}${next}${score}`
    }
    case 'LOST':
      return `${n.playerName} perdió en ${n.roundLabel}${vsLost} y quedó eliminado${score}`
  }
}

// Título corto: subject del email inmediato y primera línea del WhatsApp.
export function notificationTitle(n: NotificationView): string {
  switch (n.outcome) {
    case 'CHAMPION':
      return `${n.playerName}, campeón en ${n.tournamentName}`
    case 'FINALIST':
      return `${n.playerName}, finalista en ${n.tournamentName}`
    case 'WON':
      return `${n.playerName} ganó en ${n.tournamentName}`
    case 'LOST':
      return `${n.playerName} quedó eliminado en ${n.tournamentName}`
  }
}

export type WhatsappTemplateSpec = {
  name: string
  bodyParams: Array<{ name: string; text: string }>
}

const TEMPLATE_BY_OUTCOME: Record<NotifyOutcomeKey, string> = {
  WON: 'player_match_won',
  LOST: 'player_match_lost',
  CHAMPION: 'player_champion',
  FINALIST: 'player_finalist',
}

// Valores NAMED del template de WhatsApp, por desenlace. Los NOMBRES de las variables deben
// coincidir con los templates creados en Meta:
//   player_match_won:  jugador, ronda, torneo, siguiente, resultado
//   player_match_lost: jugador, ronda, torneo, resultado
//   player_champion:   jugador, torneo, resultado
//   player_finalist:   jugador, torneo, resultado
export function whatsappTemplateSpec(n: NotificationView): WhatsappTemplateSpec {
  const name = TEMPLATE_BY_OUTCOME[n.outcome]
  const torneo = torneoLabel(n)
  const resultado = safe(formatScore(n.score), 'sin marcador')
  switch (n.outcome) {
    case 'WON':
      return {
        name,
        bodyParams: [
          { name: 'jugador', text: n.playerName },
          { name: 'ronda', text: n.roundLabel },
          { name: 'torneo', text: torneo },
          { name: 'siguiente', text: safe(n.nextRoundLabel, 'la próxima ronda') },
          { name: 'resultado', text: resultado },
        ],
      }
    case 'LOST':
      return {
        name,
        bodyParams: [
          { name: 'jugador', text: n.playerName },
          { name: 'ronda', text: n.roundLabel },
          { name: 'torneo', text: torneo },
          { name: 'resultado', text: resultado },
        ],
      }
    case 'CHAMPION':
    case 'FINALIST':
      return {
        name,
        bodyParams: [
          { name: 'jugador', text: n.playerName },
          { name: 'torneo', text: torneo },
          { name: 'resultado', text: resultado },
        ],
      }
  }
}

// Mensaje de texto libre (in-window, gratis). Espeja el tono de los templates (emoji + torneo
// con categoría corta), pero más rico: nombra al rival y cierra con el link al cuadro (en vez
// del "Seguilo en Tenis Tracker." del template). Omite la línea de resultado si no hay marcador.
export function whatsappFreeText(n: NotificationView, bracketUrl: string): string {
  const torneo = torneoLabel(n)
  const fScore = formatScore(n.score)
  const resultado = (label: string) => (fScore ? `\n${label}: ${fScore}.` : '')
  const rival = n.opponentName
  let head: string
  switch (n.outcome) {
    case 'WON': {
      const vs = rival ? ` le ganó a ${rival}` : ' ganó'
      const next = n.nextRoundLabel ? ` y avanza a ${n.nextRoundLabel}` : ' y avanza'
      head = `🎾 ${n.playerName}${vs} en ${n.roundLabel} de ${torneo}${next}.${resultado('Resultado')}`
      break
    }
    case 'LOST': {
      const vs = rival ? ` perdió con ${rival}` : ' perdió'
      head = `👎 ${n.playerName}${vs} en ${n.roundLabel} de ${torneo} y quedó afuera.${resultado('Resultado')}`
      break
    }
    case 'CHAMPION':
      head = `🏆 ${n.playerName} se consagró campeón de ${torneo}.${resultado('Resultado de la final')} ¡Felicitaciones!`
      break
    case 'FINALIST':
      head = `🥈 ${n.playerName} llegó a la final de ${torneo} y quedó como finalista.${resultado('Resultado')}`
      break
  }
  return `${head}\n\nVer el cuadro: ${bracketUrl}`
}
