// Colores y estilos inline para los emails de Tenis Tracker.

export const EMAIL_COLORS = {
  brand: '#15803d', // verde cancha
  textPrimary: '#18181b',
  textSecondary: '#52525b',
  textWhite: '#ffffff',
  background: '#f4f4f5',
  card: '#ffffff',
  border: '#e4e4e7',
} as const

export const EMAIL_STYLES = {
  pageContainer: {
    backgroundColor: EMAIL_COLORS.background,
    margin: 0,
    padding: '24px 0',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  card: {
    backgroundColor: EMAIL_COLORS.card,
    border: `1px solid ${EMAIL_COLORS.border}`,
    borderRadius: '12px',
    overflow: 'hidden' as const,
  },
  header: {
    backgroundColor: EMAIL_COLORS.brand,
    padding: '20px 24px',
  },
  code: {
    fontSize: '32px',
    fontWeight: 700 as const,
    letterSpacing: '8px',
    color: EMAIL_COLORS.brand,
    textAlign: 'center' as const,
    margin: '8px 0 16px 0',
  },
} as const
