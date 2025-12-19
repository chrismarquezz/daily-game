import { defaultPieces } from 'react-chessboard'
import type { Inventory, PieceType } from '../engine'
import { pieceToFen } from '../pieces'

type Props = {
  inventory: Inventory
  inventoryList: PieceType[]
  placedCounts: Record<PieceType, number>
  selected: PieceType
  onSelect: (type: PieceType) => void
}

export function InventoryBar({
  inventory,
  inventoryList,
  placedCounts,
  selected,
  onSelect,
}: Props) {
  const remainingOf = (type: PieceType) => (inventory[type] ?? 0) - (placedCounts[type] ?? 0)

  return (
    <section className="controls">
      <div className="inventory">
        {inventoryList.map((type) => {
          const remaining = remainingOf(type)
          const total = inventory[type] ?? 0
          const placed = placedCounts[type] ?? 0
          const Comp = defaultPieces[pieceToFen[type]]
          const done = placed >= total && total > 0
          return (
            <button
              key={type}
              className={`piece-chip ${selected === type ? 'selected' : ''}`}
              onClick={() => onSelect(type)}
              aria-label={type}
            >
              <span className="piece-icon">
                <Comp svgStyle={{ width: 48, height: 48 }} />
              </span>
              <span className={`count ${done ? 'done' : remaining <= 0 ? 'out' : ''}`}>
                {placed}/{total}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
