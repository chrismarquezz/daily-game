export type CellState = 'valid' | 'blocked'

export type Board = {
  width: number
  height: number
  cells: CellState[][]
  seed: string
}

export type PieceType = 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn' | 'king'

export type PiecePlacement = {
  row: number
  col: number
  type: PieceType
}

export type Inventory = Partial<Record<PieceType, number>>

export const PIECE_VALUES: Record<PieceType, number> = {
  queen: 9,
  rook: 5,
  bishop: 3,
  knight: 3,
  pawn: 1,
  king: 0,
}

const DEFAULT_SIZE = 8
const DEFAULT_BLOCK_RATIO = 0.28
const MIN_VALID_RATIO = 0.45

export function makeDailySeed(date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}${month}${day}`
}

function hashSeed(seed: string): number {
  // Simple deterministic hash to feed the RNG.
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return (h ^ (h >>> 16)) >>> 0
}

function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateBoard(seed: string, size = DEFAULT_SIZE): Board {
  const rng = mulberry32(hashSeed(seed))
  const cells: CellState[][] = []
  let validCount = 0
  const total = size * size

  for (let row = 0; row < size; row++) {
    const rowCells: CellState[] = []
    for (let col = 0; col < size; col++) {
      const cell: CellState = rng() < DEFAULT_BLOCK_RATIO ? 'blocked' : 'valid'
      rowCells.push(cell)
      if (cell === 'valid') validCount++
    }
    cells.push(rowCells)
  }

  const minValid = Math.ceil(total * MIN_VALID_RATIO)
  if (validCount < minValid) {
    // Flip the earliest blocked cells to valid to ensure playability while staying deterministic.
    for (let row = 0; row < size && validCount < minValid; row++) {
      for (let col = 0; col < size && validCount < minValid; col++) {
        if (cells[row][col] === 'blocked') {
          cells[row][col] = 'valid'
          validCount++
        }
      }
    }
  }

  return { width: size, height: size, cells, seed }
}

export function isValidSquare(board: Board, row: number, col: number): boolean {
  return (
    row >= 0 &&
    col >= 0 &&
    row < board.height &&
    col < board.width &&
    board.cells[row][col] === 'valid'
  )
}

function pathClear(
  board: Board,
  from: PiecePlacement,
  to: PiecePlacement,
  occupied: Set<string>,
): boolean {
  const dr = Math.sign(to.row - from.row)
  const dc = Math.sign(to.col - from.col)
  let r = from.row + dr
  let c = from.col + dc
  while (r !== to.row || c !== to.col) {
    if (board.cells[r][c] === 'blocked') return false
    if (occupied.has(`${r},${c}`)) return false
    r += dr
    c += dc
  }
  return true
}

function piecesAttack(
  board: Board,
  a: PiecePlacement,
  b: PiecePlacement,
  occupied: Set<string>,
): boolean {
  const dr = b.row - a.row
  const dc = b.col - a.col
  const adr = Math.abs(dr)
  const adc = Math.abs(dc)

  switch (a.type) {
    case 'rook':
      if (dr === 0 || dc === 0) return pathClear(board, a, b, occupied)
      return false
    case 'bishop':
      if (adr === adc) return pathClear(board, a, b, occupied)
      return false
    case 'queen':
      if (dr === 0 || dc === 0 || adr === adc) return pathClear(board, a, b, occupied)
      return false
    case 'knight':
      return (adr === 2 && adc === 1) || (adr === 1 && adc === 2)
    case 'king':
      return adr <= 1 && adc <= 1 && (adr + adc > 0)
    case 'pawn': {
      // Pawns attack "up" the board (toward row -1).
      return dr === -1 && (dc === -1 || dc === 1)
    }
    default:
      return false
  }
}

export type ConflictResult = {
  positions: Set<string>
  pairCount: number
}

export function evaluateConflicts(
  board: Board,
  placements: PiecePlacement[],
): ConflictResult {
  const occupied = new Set(placements.map((p) => `${p.row},${p.col}`))
  const positions = new Set<string>()
  let pairCount = 0

  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i]
      const b = placements[j]
      if (piecesAttack(board, a, b, occupied) || piecesAttack(board, b, a, occupied)) {
        positions.add(`${a.row},${a.col}`)
        positions.add(`${b.row},${b.col}`)
        pairCount++
      }
    }
  }

  return { positions, pairCount }
}

export function isLegalPlacement(board: Board, placements: PiecePlacement[]): boolean {
  return evaluateConflicts(board, placements).positions.size === 0
}

function buildInventoryArray(inv: Inventory): PieceType[] {
  const list: PieceType[] = []
  ;(Object.keys(inv) as PieceType[]).forEach((type) => {
    const count = inv[type] ?? 0
    for (let i = 0; i < count; i++) list.push(type)
  })
  return list
}

export function solveWithInventory(
  board: Board,
  inventory: Inventory,
  preplaced: PiecePlacement[] = [],
): PiecePlacement[] | null {
  const placements: PiecePlacement[] = []
  const usedCounts: Record<PieceType, number> = {
    queen: 0,
    rook: 0,
    bishop: 0,
    knight: 0,
    pawn: 0,
    king: 0,
  }

  for (const p of preplaced) {
    if (!isValidSquare(board, p.row, p.col)) return null
    placements.push(p)
    usedCounts[p.type] += 1
    if ((inventory[p.type] ?? 0) < usedCounts[p.type]) return null
  }

  if (!isLegalPlacement(board, placements)) return null

  const remainingPieces = buildInventoryArray(inventory).filter(
    (type) => usedCounts[type] < (inventory[type] ?? 0),
  )

  // Order pieces by impact: queen, rook, bishop, knight, pawn, king.
  const priority: Record<PieceType, number> = {
    queen: 0,
    rook: 1,
    bishop: 2,
    knight: 3,
    pawn: 4,
    king: 5,
  }
  remainingPieces.sort((a, b) => priority[a] - priority[b])

  const occupied = new Set(placements.map((p) => `${p.row},${p.col}`))
  const cells: { row: number; col: number }[] = []
  for (let r = 0; r < board.height; r++) {
    for (let c = 0; c < board.width; c++) {
      if (board.cells[r][c] === 'valid') cells.push({ row: r, col: c })
    }
  }

  const backtrack = (idx: number): boolean => {
    if (idx === remainingPieces.length) return true
    const type = remainingPieces[idx]
    for (const cell of cells) {
      const key = `${cell.row},${cell.col}`
      if (occupied.has(key)) continue
      const candidate: PiecePlacement = { row: cell.row, col: cell.col, type }
      let safe = true
      for (const placed of placements) {
        if (
          piecesAttack(board, candidate, placed, occupied) ||
          piecesAttack(board, placed, candidate, occupied)
        ) {
          safe = false
          break
        }
      }
      if (!safe) continue
      placements.push(candidate)
      occupied.add(key)
      if (backtrack(idx + 1)) return true
      placements.pop()
      occupied.delete(key)
    }
    return false
  }

  const solved = backtrack(0)
  return solved ? placements : null
}

export function findSolvableBoard(
  baseSeed: string,
  inventory: Inventory,
  maxAttempts = 80,
): { board: Board; solution: PiecePlacement[] | null } {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptSeed = attempt === 0 ? baseSeed : `${baseSeed}-${attempt}`
    const board = generateBoard(attemptSeed)
    const solution = solveWithInventory(board, inventory)
    if (solution) return { board, solution }
  }
  const board = generateBoard(baseSeed)
  return { board, solution: null }
}

export function inventoryForSeed(seed: string): Inventory {
  const rng = mulberry32(hashSeed(seed))
  const roll = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min
  return {
    queen: roll(1, 2),
    rook: roll(3, 4),
    bishop: roll(2, 3),
    knight: roll(2, 3),
    pawn: roll(4, 6),
    king: 1,
  }
}
