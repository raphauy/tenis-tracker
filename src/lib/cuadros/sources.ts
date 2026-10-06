// Registro en código de las fuentes de cuadros externos. La entrada es la
// FUENTE/contenedor ({ type, config }), no un torneo: los torneos se descubren
// en el sync. Sumar un torneo del mismo tipo = nueva entrada acá (sin migración
// ni tocar la UI). Las credenciales (API keys) viven en env, nunca acá.
//
// UNA sola entrada por `type`: el orquestador archiva por sourceType (archiveMissing), así
// que dos entradas del mismo tipo se archivarían —y congelarían— los torneos entre sí.
// Para sumar torneos de MUR con otro nombre, agregar el patrón a `nameFilters`.

export type AcademiaConfig = { spreadsheetId: string }
// `nameFilters`: patrones (ilike, sin comodines) sobre el nombre del torneo; matchea cualquiera.
export type MurConfig = { baseUrl: string; nameFilters: string[] }

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
    config: {
      baseUrl: 'https://tsxzhdnyykknmivdpyzv.supabase.co/rest/v1',
      nameFilters: ['grados', 'babolat'],
    },
  },
]
