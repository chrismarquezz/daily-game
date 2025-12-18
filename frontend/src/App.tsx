import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PositionDataType } from 'react-chessboard'
import './App.css'
import { BoardSection } from './components/BoardSection'
import { InventoryBar } from './components/InventoryBar'
import { TimerDisplay } from './components/TimerDisplay'
import {
  evaluateConflicts,
  findSolvableBoard,
  inventoryForSeed,
  makeDailySeed,
  solveWithInventory,
} from './engine'
import type { Board, Inventory, PiecePlacement, PieceType } from './engine'
import { pieceToFen } from './pieces'

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
  const [showHowTo, setShowHowTo] = useState(false)
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showHowTo || loading || inventoryList.length === 0) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const keys = ['a', 'A', 'ArrowLeft', 'd', 'D', 'ArrowRight']
      if (!keys.includes(e.key)) return
      e.preventDefault()
      setSelected((prev) => {
        const idx = inventoryList.indexOf(prev)
        const delta = e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft' ? -1 : 1
        const nextIndex = ((idx >= 0 ? idx : 0) + delta + inventoryList.length) % inventoryList.length
        return inventoryList[nextIndex]
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inventoryList, loading, showHowTo])

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

  const toSquare = useCallback(
    (row: number, col: number) => {
      if (!board) return ''
      const file = String.fromCharCode(97 + col)
      const rank = board.height - row
      return `${file}${rank}`
    },
    [board],
  )

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

  const handleSquareClick = (square: string) => {
    if (!board) return
    const col = square.charCodeAt(0) - 97
    const rank = Number(square[1])
    const row = board.height - rank
    togglePlacement(row, col)
  }

  const hintMessage = showHint
    ? hintState.wrong
      ? 'Orange square marks a piece that cannot fit a solution.'
      : hintState.suggest
        ? 'Green square shows a needed placement.'
        : 'All current pieces can fit a solution.'
    : null

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
      <InventoryBar
        inventory={inventory}
        inventoryList={inventoryList}
        placedCounts={placedCounts}
        selected={selected}
        onSelect={setSelected}
      />

      <section className="board-wrap">
        <div className="board-card">
          <div className="board-card-header">
            <TimerDisplay timeLabel={formatTime(elapsedMs)} />
          </div>
          <BoardSection
            boardStyle={boardStyle}
            pieces={pieces}
          squareStyles={squareStyles}
          parHit={parHit}
          onSquareClick={handleSquareClick}
          onHint={() => setShowHint(true)}
          onReset={() => setPlacements((prev) => prev.slice(0, -1))}
          canHint={placements.length > 0 && !hasConflicts}
          canReset={placements.length > 0}
          hintMessage={hintMessage}
        />
        </div>
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

      {showHowTo && (
        <div className="modal-overlay" role="dialog" aria-label="How to play">
          <div className="modal">
            <h2>How to play</h2>
            <ul className="howto-list">
              <li>Select a piece from the top bar, then tap a valid square to place it.</li>
              <li>Pieces follow normal chess attacks. Blocked squares stop sliding pieces and can’t hold pieces.</li>
              <li>You must place all given pieces so none attack each other.</li>
              <li>Use Hint to spot one incorrect piece or a needed square; Undo/Reset to adjust.</li>
            </ul>
            <button onClick={() => setShowHowTo(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
