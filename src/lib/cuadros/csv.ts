// Tokenizer CSV puro (RFC 4180-ish): respeta comillas dobles, comas y saltos de
// línea dentro de campos entrecomillados. Sin dependencias. Preserva el contenido
// de cada celda tal cual (el caller decide cómo limpiar/recortar) — la geometría
// del parser de Academia depende de la posición (fila, columna) exacta.
export function parseCsv(input: string): string[][] {
  const text = input.replace(/\r\n?/g, '\n') // normalizar saltos de línea
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"' // comilla escapada ("")
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }

  // Cerrar el último campo/fila solo si quedó contenido pendiente (evita una
  // fila vacía espuria cuando el archivo termina en salto de línea).
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}
