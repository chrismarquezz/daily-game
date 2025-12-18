import React from 'react'
import { Chessboard } from 'react-chessboard'
import type { PositionDataType } from 'react-chessboard'

type Props = {
  boardStyle: React.CSSProperties
  pieces: PositionDataType
  squareStyles: Record<string, React.CSSProperties>
  parHit: boolean
  onSquareClick: (square: string) => void
  onHint: () => void
  onReset: () => void
  canHint: boolean
  canReset: boolean
  hintMessage: string | null
}

export function BoardSection({
  boardStyle,
  pieces,
  squareStyles,
  parHit,
  onSquareClick,
  onHint,
  onReset,
  canHint,
  canReset,
  hintMessage,
}: Props) {
  return (
    <>
      <div className={`board-shell ${parHit ? 'par' : ''}`}>
        <Chessboard
          options={{
            id: 'daily-mix',
            position: pieces,
            allowDragging: false,
            boardStyle: boardStyle,
            squareStyles: squareStyles,
            darkSquareStyle: { backgroundColor: '#b58863' },
            lightSquareStyle: { backgroundColor: '#f0d9b5' },
            onSquareClick: ({ square }) => onSquareClick(square),
          }}
        />
      </div>
      <div className="board-actions">
        <button className="hint-btn wide" onClick={onHint} disabled={!canHint}>
          Hint
        </button>
        <button className="reset-btn wide" onClick={onReset} disabled={!canReset}>
          Undo
        </button>
      </div>
      {hintMessage && <p className="hint-inline">{hintMessage}</p>}
    </>
  )
}
