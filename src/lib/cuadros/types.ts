// Cuadro normalizado: contrato común que producen los Adapters y se guarda en
// ExternalBracket.data (JSON). Desacoplado del enum Round del dominio privado
// para tolerar tamaños variables, byes y play-ins. Ver docs/PRPs/cuadros-prp.md.

export type BracketSlot = {
  name: string // display name; en dobles, "A. Pérez / B. López" (opaco)
  seed?: number
  sourceId?: string // id estable en la fuente (uuid MUR); ausente en Academia
  bye?: boolean // slot de BYE (rival ausente): se muestra "BYE", no es un jugador real
}

export type MatchOutcome = 'normal' | 'walkover' | 'retiro'

export type NormalizedMatch = {
  slot: number // posición dentro de la ronda (0-indexed; alimenta los conectores)
  p1?: BracketSlot // ausente = posición de relleno (fuera del draw)
  p2?: BracketSlot
  winner?: 1 | 2 // por posición (fuzzy, tolera typos); ausente si no se jugó
  score?: string // string crudo de la fuente; ausente si no se jugó
  outcome?: MatchOutcome
  status: 'pending' | 'played' | 'bye' // 'bye' = un jugador pasa sin jugar (rival BYE)
}

export type NormalizedRound = {
  index: number // 0 = primera ronda
  label: string // re-etiquetada por geometría ("32avos" … "Final"), no por el header de la fuente
  matches: NormalizedMatch[]
}

export type NormalizedBracket = {
  format: 'bracket'
  drawSize: number // entrantes de la primera ronda (potencia de 2 tras padding con byes)
  rounds: NormalizedRound[]
}

// --- Descubrimiento: lo que devuelve cada Adapter antes de persistir ---

export type DiscoveredTournament = {
  identityKey: string // 'academia-mg:2026-etapa-3' | 'mur:<uuid>'
  slug: string // 'academia-mg-2026-etapa-3' (derivado del identityKey, URL-safe)
  name: string // label completo a mostrar
  startDate: Date | null
  locator: unknown // dato interno del adapter para llegar a sus categorías (ej. lista de hojas)
}

export type DiscoveredCategory = {
  categoryName: string
  slug: string
  displayOrder: number
  locator: unknown // dato interno (ej. gid de la hoja)
}

export type FetchedBracket = {
  normalized: NormalizedBracket
  raw: string // crudo (CSV/JSON) para snapshot + hash
  categoryName: string // nombre autoritativo a mostrar (del contenido, no del tab)
}

// Adapter de una fuente. Puro respecto de Prisma (vive en src/lib/cuadros/);
// puede hacer fetch + leer env (API keys), pero nunca toca la DB. `config` es
// `unknown` porque el registry es por string: cada adapter lo narrowa a su tipo.
export interface SourceAdapter {
  type: string
  // Cuándo un torneo de esta fuente pasa a `archived`:
  //  - 'flip' (default): cuando deja de aparecer en la fuente (Academia reusa la planilla).
  //  - 'completion': cuando su cuadro está completo (MUR no flipea: UUID estables, las
  //    etapas viven para siempre; se archivan al jugarse todas las finales). Ver glosario.
  archivePolicy?: 'flip' | 'completion'
  // Torneos/etapas vivos de la fuente. Si la fuente no se puede leer, LANZA
  // (la guarda de discovery del orquestador lo captura y NO archiva nada).
  discoverTournaments(config: unknown): Promise<DiscoveredTournament[]>
  discoverCategories(
    config: unknown,
    tournament: DiscoveredTournament
  ): Promise<DiscoveredCategory[]>
  // null = formato no soportado en el MVP (round-robin) → se omite la categoría.
  fetchBracket(
    config: unknown,
    category: DiscoveredCategory
  ): Promise<FetchedBracket | null>
}
