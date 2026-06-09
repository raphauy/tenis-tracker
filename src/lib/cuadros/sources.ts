// Registro en código de las fuentes de cuadros externos. La entrada es la
// FUENTE/contenedor ({ type, config }), no un torneo: los torneos se descubren
// en el sync. Sumar un torneo del mismo tipo = nueva entrada acá (sin migración
// ni tocar la UI). Las credenciales (API keys) viven en env, nunca acá.

export type AcademiaConfig = { spreadsheetId: string }
export type MurConfig = { baseUrl: string; nameFilter: string }

export type SourceInstance =
  | { type: 'google-sheets-academia'; config: AcademiaConfig }
  | { type: 'mur-supabase'; config: MurConfig }

export const SOURCES: SourceInstance[] = [
  {
    type: 'google-sheets-academia',
    config: { spreadsheetId: '1JpCOXQf9IUobOre6LgqyWjluD6BEdNJ0W9I02lpiWEo' },
  },
  {
    type: 'mur-supabase',
    config: { baseUrl: 'https://tsxzhdnyykknmivdpyzv.supabase.co/rest/v1', nameFilter: 'grados' },
  },
]
