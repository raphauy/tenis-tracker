// Colores y estilos inline para los emails de Tenis Tracker.
// Derivados del tema "elegant-luxury" de la app (rojo vino + crema + dorado).
// Los valores oklch del theme se convirtieron a HEX para compatibilidad con clientes de email.

export const EMAIL_COLORS = {
  // Backgrounds
  pageBackground: '#faf7f5', // background (crema)
  cardBackground: '#ffffff',

  // Marca (rojo vino / primary)
  brand: '#9b2c2c', // primary

  // Texto
  textPrimary: '#1a1a1a', // foreground
  textSecondary: '#57534e', // muted-foreground
  textMuted: '#a8a29e', // stone-400
  textWhite: '#ffffff',

  // Bordes
  border: '#f5e8d2', // border

  // Estados (acento dorado)
  info: '#805500', // secondary-foreground (dorado)
  infoLight: '#fdf2d6', // secondary (dorado claro)

  // Secciones
  mutedSection: '#f0ebe8', // muted
  footerBackground: '#faf7f5', // background (crema)
} as const

// Tipografías del tema: serif (Libre Baskerville) para títulos, sans (Poppins) para texto.
const FONT_SERIF = "'Libre Baskerville', Georgia, 'Times New Roman', serif"
const FONT_SANS = "Poppins, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
const FONT_MONO = "'IBM Plex Mono', 'Courier New', monospace"

export const EMAIL_FONTS = { serif: FONT_SERIF, sans: FONT_SANS, mono: FONT_MONO } as const

export const EMAIL_STYLES = {
  pageContainer: {
    backgroundColor: EMAIL_COLORS.pageBackground,
    fontFamily: FONT_SANS,
  },

  cardContainer: {
    backgroundColor: EMAIL_COLORS.cardBackground,
    borderRadius: '6px',
    border: `1px solid ${EMAIL_COLORS.border}`,
    overflow: 'hidden' as const,
    boxShadow: '0 1px 16px -2px rgba(74, 20, 20, 0.12)',
  },

  headerSection: {
    backgroundColor: EMAIL_COLORS.brand,
    color: EMAIL_COLORS.textWhite,
    textAlign: 'center' as const,
    padding: '20px 0',
  },

  codeSection: {
    backgroundColor: EMAIL_COLORS.mutedSection,
    border: `2px dashed ${EMAIL_COLORS.border}`,
    borderRadius: '6px',
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
