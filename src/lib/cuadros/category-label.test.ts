import { describe, it, expect } from 'vitest'
import { shortCategoryLabel } from './category-label'

describe('shortCategoryLabel', () => {
  it('extrae el sufijo corto tras el guion (Academia)', () => {
    expect(shortCategoryLabel('SINGLES CABALLEROS - B')).toBe('B')
    expect(shortCategoryLabel('SINGLES CABALLEROS - E')).toBe('E')
    expect(shortCategoryLabel('SINGLES DAMAS – A')).toBe('A')
  })

  it('dobles sin sufijo → "Dobles"', () => {
    expect(shortCategoryLabel('DOBLES CABALLEROS')).toBe('Dobles')
  })

  it('nombres sin guion → Title Case completo (MUR)', () => {
    expect(shortCategoryLabel('SEXTA')).toBe('Sexta')
    expect(shortCategoryLabel('quinta')).toBe('Quinta')
  })

  it('un sufijo largo tras el guion no se recorta', () => {
    expect(shortCategoryLabel('SINGLES DAMAS - SERIE A')).toBe('Singles Damas - Serie A')
  })
})
