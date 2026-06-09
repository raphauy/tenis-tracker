// Resuelve el Adapter para un sourceType. Sumar un tipo nuevo = registrar acá.
import type { SourceAdapter } from '@/lib/cuadros/types'
import { googleSheetsAcademiaAdapter } from './google-sheets-academia'
import { murSupabaseAdapter } from './mur-supabase'

const ADAPTERS: Record<string, SourceAdapter> = {
  [googleSheetsAcademiaAdapter.type]: googleSheetsAcademiaAdapter,
  [murSupabaseAdapter.type]: murSupabaseAdapter,
}

export function adapterFor(type: string): SourceAdapter {
  const adapter = ADAPTERS[type]
  if (!adapter) throw new Error(`Adapter desconocido: ${type}`)
  return adapter
}
