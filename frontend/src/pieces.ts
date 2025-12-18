import type { PieceType } from './engine'

export const pieceToFen: Record<PieceType, string> = {
  queen: 'wQ',
  rook: 'wR',
  bishop: 'wB',
  knight: 'wN',
  pawn: 'wP',
  king: 'wK',
}

export const pieceLabel: Record<PieceType, string> = {
  queen: 'Queen',
  rook: 'Rook',
  bishop: 'Bishop',
  knight: 'Knight',
  pawn: 'Pawn',
  king: 'King',
}
