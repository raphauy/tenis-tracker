// Constantes del flujo Magic-link inverso por WhatsApp (Fase 2 whatsapp-kapso).
// Diseño en docs/PRPs/whatsapp-kapso-prp.md (Decisiones cerradas, revisión 2026-05-28)
// y ADR docs/adr/0002-magic-link-inverso-whatsapp.md.

// Charset sin caracteres confundibles (0/O/1/I/L). 32 chars → 32^6 ≈ 10^9.
export const PENDING_AUTH_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const PENDING_AUTH_CODE_LENGTH = 6
export const PENDING_AUTH_TTL_MINUTES = 10

// El texto prefijado del wa.me que ve el usuario. Debe ser estable: el regex
// principal del webhook lo busca con este formato. Cambiarlo exige cambiar el regex.
export const WA_LOGIN_PREFIX = 'Tenis Tracker login:'

// Regex con el que el webhook extrae el código del inbound.
// Principal: requiere el prefijo "login:" (case-insensitive); fallback acepta
// cualquier secuencia de 6 chars del charset por si el usuario editó y borró el prefijo.
export const AUTH_MESSAGE_REGEX = /login:\s*([A-HJ-NP-Z2-9]{6})/i
export const AUTH_FALLBACK_REGEX = /\b([A-HJ-NP-Z2-9]{6})\b/

// Rate limit del feedback al usuario tras un rechazo (evita spam si manda muchos codes malos).
// Por phone: máximo N respuestas en ventana de minutos. Tracking in-memory en la instancia.
export const WA_REJECTION_RATE_LIMIT_COUNT = 3
export const WA_REJECTION_RATE_LIMIT_WINDOW_MIN = 5

// Mensaje genérico que devolvemos por WA en cualquier rechazo (no filtra el motivo
// para evitar enumeración; el error específico lo ve el usuario en Tenis Tracker).
export const WA_REJECTION_MESSAGE =
  '❌ No pudimos verificar tu código. Pedí uno nuevo desde Tenis Tracker.'

// Acknowledge inmediato en éxito: el usuario está mirando WhatsApp al enviar el
// código y necesita un cierre visual + indicación de que el flujo continúa en la web.
// Copy neutro desktop/móvil: en móvil el wa.me abre la app de WhatsApp y "volvé a
// Tenis Tracker" remite al browser; en desktop, a la pestaña ya abierta.
// (Originalmente el diseño no mandaba nada acá; ajustado tras UX testing 2026-05-28.)
export const WA_SUCCESS_MESSAGE = '✅ ¡Listo! Volvé a Tenis Tracker.'
