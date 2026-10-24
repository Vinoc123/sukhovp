import { landingRow, supportIndex } from '../../engine/board.ts'
import type { GameState } from '../../engine/types.ts'

interface BoardProps {
  rows: number
  cols: number
  cells: number[]
  gravity: 1 | -1
  winLine?: number[] | null
  interactive?: boolean
  popMode?: boolean
  you?: 1 | 2 | null
  fallIndex?: number | null
  motion?: 'flip' | 'rotate' | null
  onColumn?: (col: number) => void
}

function ghostState(props: BoardProps): GameState {
  return {
    rules: { rows: props.rows, cols: props.cols, connect: 4, modifier: 'classic' },
    cells: props.cells as GameState['cells'],
    turn: props.you === 2 ? 2 : 1,
    plies: 0,
    gravity: props.gravity,
    rushLeft: 1,
    winner: 0,
    winLine: null,
  }
}

export function Board(props: BoardProps) {
  const { rows, cols, cells, gravity, winLine, interactive, popMode, onColumn, fallIndex, motion } = props
  const state = ghostState(props)
  return (
    <div className={`frame ${motion ? `motion-${motion}` : ''}`} style={{ ['--cols' as string]: cols }}>
      <div className="felt" style={{ ['--cols' as string]: String(cols) }}>
        {Array.from({ length: cols }, (_, col) => {
          const land = landingRow(state, col)
          const support = supportIndex(state, col)
          const canPop = Boolean(popMode && support !== null && cells[support] === state.turn)
          return (
            <button
              key={col}
              type="button"
              className="lane"
              disabled={!interactive}
              onClick={() => interactive && onColumn?.(col)}
              aria-label={`Столбец ${col + 1}`}
            >
              {Array.from({ length: rows }, (_, row) => {
                const index = row * cols + col
                const piece = cells[index] ?? 0
                const ghost = interactive && !popMode && land === row
                const popTarget = interactive && canPop && support === index
                const falling = fallIndex === index
                const distance = gravity === 1 ? -(row + 1) : rows - row
                return (
                  <span key={row} className="cell">
                    <span className="hole" />
                    {piece !== 0 && (
                      <span
                        className={`disc p${piece} ${winLine?.includes(index) ? 'win' : ''} ${falling ? 'fall' : ''} ${popTarget ? 'pop-target' : ''}`}
                        style={{ ['--signed' as string]: String(distance) }}
                      />
                    )}
                    {ghost && <span className={`disc ghost p${state.turn}`} />}
                  </span>
                )
              })}
            </button>
          )
        })}
      </div>
    </div>
  )
}
