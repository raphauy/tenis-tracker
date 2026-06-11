// Etiqueta corta de una categoría para el switcher de pills del cuadro:
// "SINGLES CABALLEROS - C" → "C", "DOBLES CABALLEROS" → "Dobles", "SEXTA" → "Sexta".
// Heurística sobre el nombre opaco que entrega la fuente; ante un formato desconocido
// cae al nombre completo en Title Case (la pill simplemente queda más ancha).
export function shortCategoryLabel(name: string): string {
  const clean = name.trim()
  // Sufijo corto tras un guion: la letra/número de la categoría ("... - C", "... - 5").
  const suffix = clean.match(/[-–—]\s*([\p{L}\d]{1,3})\s*$/u)
  if (suffix) return suffix[1].toUpperCase()
  if (/dobles/i.test(clean)) return 'Dobles'
  return titleCase(clean)
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s/])\p{L}/gu, (c) => c.toUpperCase())
}
