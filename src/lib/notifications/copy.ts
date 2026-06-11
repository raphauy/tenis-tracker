// Copy centralizado de las notificaciones de resultados. Puro (sin Prisma ni React): lo usan
// los componentes de email, el dispatch de WhatsApp (texto libre in-window + params del
// template) y el resumen diario. Strings en español con tildes.
// Ver docs/PRPs/notificaciones-prp.md § Desenlaces.

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

function torneoLabel(n: NotificationView): string {
  return `${n.tournamentName} (${n.categoryName})`
}

function safe(value: string | null | undefined, fallback: string): string {
  const v = value?.trim()
  return v ? v : fallback
}

// Frase de una línea con el desenlace. Item del resumen y cuerpo del email inmediato.
export function notificationSummary(n: NotificationView): string {
  const score = n.score ? ` (${n.score})` : ''
  const vs = n.opponentName ? ` a ${n.opponentName}` : ''
  switch (n.outcome) {
    case 'CHAMPION':
      return `${n.playerName} se consagró campeón${score}`
    case 'FINALIST':
      return `${n.playerName} llegó a la final y quedó como finalista${score}`
    case 'WON': {
      const next = n.nextRoundLabel ? ` y avanza a ${n.nextRoundLabel}` : ' y avanza'
      return `${n.playerName} ganó en ${n.roundLabel}${vs}${next}${score}`
    }
    case 'LOST':
      return `${n.playerName} perdió en ${n.roundLabel}${vs} y quedó eliminado${score}`
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
  const resultado = safe(n.score, 'sin marcador')
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

// Mensaje de texto libre (in-window, gratis), equivalente al template. Incluye link al cuadro.
export function whatsappFreeText(n: NotificationView, bracketUrl: string): string {
  return `${notificationTitle(n)}\n\n${notificationSummary(n)}\n\nVer el cuadro: ${bracketUrl}`
}
