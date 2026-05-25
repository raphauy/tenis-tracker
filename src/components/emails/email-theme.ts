// Colores y estilos inline para los emails de Tenis Tracker.
// Estructura basada en los emails de OnMind, con la marca verde cancha.

export const EMAIL_COLORS = {
  // Backgrounds
  pageBackground: '#f4f4f5', // zinc-100
  cardBackground: '#ffffff',

  // Marca (verde cancha)
  brand: '#15803d', // green-700

  // Texto
  textPrimary: '#18181b', // zinc-900
  textSecondary: '#71717a', // zinc-500
  textMuted: '#a1a1aa', // zinc-400
  textWhite: '#ffffff',

  // Bordes
  border: '#e4e4e7', // zinc-200

  // Estados
  info: '#15803d', // green-700
  infoLight: '#f0fdf4', // green-50

  // Secciones
  mutedSection: '#f4f4f5', // zinc-100
  footerBackground: '#fafafa', // zinc-50
} as const

export const EMAIL_STYLES = {
  pageContainer: {
    backgroundColor: EMAIL_COLORS.pageBackground,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },

  cardContainer: {
    backgroundColor: EMAIL_COLORS.cardBackground,
    borderRadius: '8px',
    border: `1px solid ${EMAIL_COLORS.border}`,
    overflow: 'hidden' as const,
  },

  headerSection: {
    backgroundColor: EMAIL_COLORS.brand,
    color: EMAIL_COLORS.textWhite,
    textAlign: 'center' as const,
    padding: '16px 0',
  },

  codeSection: {
    backgroundColor: EMAIL_COLORS.mutedSection,
    border: `2px dashed ${EMAIL_COLORS.border}`,
    borderRadius: '8px',
    padding: '12px 16px',
    textAlign: 'center' as const,
  },

  infoAlert: {
    backgroundColor: EMAIL_COLORS.infoLight,
    border: `1px solid ${EMAIL_COLORS.info}`,
    borderRadius: '6px',
    padding: '12px',
  },

  footerSection: {
    backgroundColor: EMAIL_COLORS.footerBackground,
    borderTop: `1px solid ${EMAIL_COLORS.border}`,
    padding: '12px 16px',
  },
} as const
