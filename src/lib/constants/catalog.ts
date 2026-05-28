// Datos semilla del catálogo curado (Fase 0). Ver docs/PRPs/tenis-tracker-prp.md § Seeds.

export const SUPERADMIN_EMAIL = 'rapha.uy@rapha.uy'
export const SUPERADMIN_NAME = 'Raphael'
// Identidad primaria de auth (Fase 2 whatsapp-kapso). El owner se seedea con phone
// y ambas verificaciones (phone + email) ya completas — su login va por WhatsApp
// pero conserva email backup operativo desde el día 1.
export const SUPERADMIN_PHONE = '+59898353507'

// Sedes reales que juega el dueño.
export const SEED_VENUES = ['Los Horneros Raquet Club', 'Academia MG'] as const

// Categorías curadas. El vocabulario depende del organizador (etiquetas planas).
export const SEED_CATEGORIES = [
  // Grados AUT (Los Horneros)
  '2da',
  '3ra',
  '4ta',
  '5ta',
  '6ta',
  '7ma',
  // Academia MG
  'A',
  'B',
  'C',
  'D',
  'E',
] as const
