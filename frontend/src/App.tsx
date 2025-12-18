import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Chessboard, defaultPieces } from 'react-chessboard'
import type { PositionDataType } from 'react-chessboard'
import { evaluateConflicts, findSolvableBoard, inventoryForSeed, makeDailySeed, solveWithInventory } from './engine'
import type { Board, Inventory, PiecePlacement, PieceType } from './engine'
import './App.css'

const pieceToFen: Record<PieceType, string> = {
  queen: 'wQ',
  rook: 'wR',
  bishop: 'wB',
  knight: 'wN',
  pawn: 'wP',
  king: 'wK',
}

const TimerIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="8" />
    <path d="M12 12V8" />
    <path d="M12 12l3 2" />
  </svg>
)

function App() {
  const initialSeed = makeDailySeed()
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [board, setBoard] = useState<Board | null>(null)
  const [placements, setPlacements] = useState<PiecePlacement[]>([])
  const [selected, setSelected] = useState<PieceType>('queen')
  const [startTime, setStartTime] = useState<number | null>(null)
  const [endTime, setEndTime] = useState<number | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())
  const [showModal, setShowModal] = useState(false)
  const [modalDismissed, setModalDismissed] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const inv = inventoryForSeed(initialSeed)
    const { board: solvableBoard } = findSolvableBoard(initialSeed, inv)
    setInventory(inv)
    setBoard(solvableBoard)
    setSelected((Object.keys(inv) as PieceType[])[0])
    setLoading(false)
  }, [initialSeed])

  const inventoryList = useMemo(
    () => (inventory ? (Object.keys(inventory) as PieceType[]) : []),
    [inventory],
  )
  const totalPieces = useMemo(
    () =>
      inventoryList.reduce((sum, key) => sum + (inventory ? inventory[key] ?? 0 : 0), 0),
    [inventory, inventoryList],
  )

  const conflicts = useMemo(
    () => (board ? evaluateConflicts(board, placements) : { positions: new Set(), pairCount: 0 }),
    [board, placements],
  )
  const hasConflicts = conflicts.positions.size > 0

  const placedCounts = useMemo(() => {
    const counts: Record<PieceType, number> = {
      queen: 0,
      rook: 0,
      bishop: 0,
      knight: 0,
      pawn: 0,
      king: 0,
    }
    placements.forEach((p) => {
      counts[p.type] += 1
    })
    return counts
  }, [placements])

  const allPlaced =
    placements.length === totalPieces &&
    inventoryList.every((t) => placedCounts[t] === (inventory ? inventory[t] ?? 0 : 0))
  const parHit = allPlaced && !hasConflicts

  useEffect(() => {
    if (placements.length > 0 && startTime === null) {
      setStartTime(Date.now())
      setEndTime(null)
    }
    setShowHint(false)
  }, [placements.length, startTime])

  useEffect(() => {
    if (parHit && startTime && !endTime) {
      setEndTime(Date.now())
    }
    if (parHit && !modalDismissed) {
      setShowModal(true)
    }
    if (!parHit) {
      setShowModal(false)
      setModalDismissed(false)
    }
  }, [parHit, startTime, endTime, modalDismissed])

  useEffect(() => {
    if (!startTime || endTime) return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [startTime, endTime])

  const elapsedMs = startTime ? (endTime ?? now) - startTime : 0
  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const boardSize = useMemo(
    () => Math.min(520, (typeof window !== 'undefined' ? window.innerWidth : 520) * 0.9),
    [],
  )

  const boardStyle = useMemo(
    () => ({
      width: boardSize,
      height: boardSize,
      border: `3px solid ${parHit ? '#22c55e' : '#000'}`,
      borderRadius: '8px',
      boxSizing: 'border-box' as const,
      boxShadow: parHit ? '0 0 24px rgba(34,197,94,0.75)' : undefined,
    }),
    [boardSize, parHit],
  )

  const toSquare = (row: number, col: number) => {
    if (!board) return ''
    const file = String.fromCharCode(97 + col)
    const rank = board.height - row
    return `${file}${rank}`
  }

  const pieces: PositionDataType = useMemo(() => {
    const map: PositionDataType = {}
    placements.forEach((p) => {
      const square = toSquare(p.row, p.col)
      if (square) {
        map[square] = { pieceType: pieceToFen[p.type] }
      }
    })
    return map
  }, [placements, toSquare])

  const hintState = useMemo(() => {
    if (!showHint) return { wrong: null as string | null, suggest: null as string | null }
    if (hasConflicts) return { wrong: null, suggest: null }

    if (!board || !inventory) return { wrong: null, suggest: null }

    const solvedWithCurrent = solveWithInventory(board, inventory, placements)
    if (!solvedWithCurrent) {
      for (let i = 0; i < placements.length; i++) {
        const test = placements.filter((_, idx) => idx !== i)
        const stillSolvable = solveWithInventory(board, inventory, test)
        if (stillSolvable) {
          return { wrong: `${placements[i].row},${placements[i].col}`, suggest: null }
        }
      }
      return { wrong: null, suggest: null }
    }

    if (parHit) return { wrong: null, suggest: null }

    let suggest: string | null = null
    for (const p of solvedWithCurrent) {
      const key = `${p.row},${p.col}`
      if (!placements.find((pl) => pl.row === p.row && pl.col === p.col && pl.type === p.type)) {
        suggest = key
        break
      }
    }
    return { wrong: null, suggest }
  }, [showHint, hasConflicts, board, placements, parHit, inventory])

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {}
    if (!board) return styles
    board.cells.forEach((rowCells, row) =>
      rowCells.forEach((cell, col) => {
        const square = toSquare(row, col)
        if (!square) return
        if (cell === 'blocked') {
          styles[square] = {
            backgroundColor: '#000000',
            opacity: 0.92,
          }
        }
        if (conflicts.positions.has(`${row},${col}`)) {
          styles[square] = {
            ...styles[square],
            boxShadow: 'inset 0 0 0 3px #ef4444',
          }
        }
        if (hintState.wrong === `${row},${col}`) {
          styles[square] = {
            ...styles[square],
            boxShadow: 'inset 0 0 0 3px #f97316',
          }
        }
        if (hintState.suggest === `${row},${col}`) {
          styles[square] = {
            ...styles[square],
            boxShadow: 'inset 0 0 0 3px #22c55e',
          }
        }
      }),
    )
    return styles
  }, [board, conflicts.positions, hintState, toSquare])

  const remainingOf = (type: PieceType) =>
    (inventory ? inventory[type] ?? 0 : 0) - (placedCounts[type] ?? 0)

  const togglePlacement = (row: number, col: number) => {
    if (!board || !inventory) return
    if (board.cells[row][col] === 'blocked') return
    setPlacements((prev) => {
      const existingIndex = prev.findIndex((p) => p.row === row && p.col === col)
      if (existingIndex >= 0) {
        const next = [...prev]
        next.splice(existingIndex, 1)
        return next
      }
      if (remainingOf(selected) <= 0) return prev
      const next: PiecePlacement = { row, col, type: selected }
      return [...prev, next]
    })
  }

  const handleUndo = () => {
    setPlacements((prev) => prev.slice(0, -1))
  }

  const handleReset = () => {
    setPlacements([])
    setStartTime(null)
    setEndTime(null)
    setShowHint(false)
    setModalDismissed(false)
  }

  if (loading || !board || !inventory) {
    return (
      <div className="page">
        <header className="hero">
          <div>
            <h1>Daily Line of Sight</h1>
            <p className="lede">Preparing today&apos;s board and inventory...</p>
          </div>
        </header>
      </div>
    )
  }

  return (
    <div className="page">
      <section className="controls">
        <div className="inventory">
          {inventoryList.map((type) => {
            const remaining = remainingOf(type)
            const total = inventory[type] ?? 0
            const placed = placedCounts[type] ?? 0
            return (
              <button
                key={type}
                className={`piece-chip ${selected === type ? 'selected' : ''}`}
                onClick={() => setSelected(type)}
                aria-label={type}
              >
                <span className="piece-icon">
                  {(() => {
                    const Comp = defaultPieces[pieceToFen[type]]
                    return <Comp svgStyle={{ width: 48, height: 48 }} />
                  })()}
                </span>
                <span className={`count ${remaining <= 0 ? 'out' : ''}`}>{placed}/{total}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="board-wrap">
        <div className="timer-chip">
          <TimerIcon />
          <span>{formatTime(elapsedMs)}</span>
        </div>
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
              onSquareClick: ({ square }) => {
                const col = square.charCodeAt(0) - 97
                const rank = Number(square[1])
                const row = board.height - rank
                togglePlacement(row, col)
              },
            }}
          />
        </div>
        <div className="board-actions">
          <button className="undo-btn" onClick={handleUndo} disabled={placements.length === 0}>
            Undo
          </button>
          <button
            className="hint-btn"
            onClick={() => setShowHint(true)}
            disabled={placements.length === 0 || hasConflicts}
          >
            Hint
          </button>
          <button className="reset-btn" onClick={handleReset} disabled={placements.length === 0}>
            Reset
          </button>
        </div>
        {showHint && (
          <p className="hint-inline">
            {hintState.wrong
              ? 'Orange square marks a piece that cannot fit a solution.'
              : hintState.suggest
                ? 'Green square shows a needed placement.'
                : 'All current pieces can fit a solution.'}
          </p>
        )}
      </section>

      {showModal && (
        <div className="modal-overlay" role="alertdialog" aria-label="Puzzle solved">
          <div className="modal">
            <h2>Puzzle solved</h2>
            <p>You placed every piece without conflict. Nice work.</p>
            <button
              onClick={() => {
                setShowModal(false)
                setModalDismissed(true)
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
