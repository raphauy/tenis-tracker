// Helpers de texto puros (usables en client y server).

// Partículas de nombres en español que van en minúscula (salvo al inicio).
const NAME_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e'])

// Capitaliza la primera letra de un segmento, preservando el resto (y las tildes).
function capitalize(segment: string): string {
  if (!segment) return segment
  return segment.charAt(0).toLocaleUpperCase('es') + segment.slice(1)
}

// Clave de match tolerante de un nombre: sin tildes/ñ, minúsculas, sin puntos,
// espacios colapsados. Para comparar nombres de cuadros de forma robusta (favoritos).
// "F. Echávarria " → "f echavarria". La misma función la usan el service (al guardar
// el favorito) y el cliente (al matchear cada slot), para que coincidan.
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Normaliza el nombre de un Jugador a Title Case en español:
// - cada palabra capitalizada; las partículas (de, del, la...) en minúscula salvo la primera palabra;
// - capitaliza también tras un guion (apellidos compuestos: "ana-maría" → "Ana-María");
// - colapsa espacios y preserva tildes. "JUAN DE LA CRUZ" → "Juan de la Cruz".
export function toPlayerNameCase(raw: string): string {
  return raw
    .trim()
    .toLocaleLowerCase('es')
    .split(/\s+/)
    .map((word, wordIndex) => {
      if (wordIndex > 0 && NAME_PARTICLES.has(word)) return word
      // Capitaliza cada segmento separado por guion.
      return word.split('-').map(capitalize).join('-')
    })
    .join(' ')
}
