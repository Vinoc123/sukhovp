export type Cell = 0 | 1 | 2
export type Player = 1 | 2
export type Modifier = 'classic' | 'flip' | 'pop' | 'rotate' | 'rush'
export type BotLevel = 'easy' | 'medium' | 'hard'

export interface Rules {
  rows: number
  cols: number
  connect: number
  modifier: Modifier
}

export interface Action {
  type: 'drop' | 'pop'
  col: number
}

export interface GameState {
  rules: Rules
  cells: Cell[]
  turn: Player
  plies: number
  gravity: 1 | -1
  rushLeft: number
  winner: 0 | Player | 3
  winLine: number[] | null
}

export interface BoardPreset {
  id: string
  label: string
  hint: string
  rows: number
  cols: number
  connect: number
}

export interface TimeControl {
  id: string
  label: string
  initialMs: number
  incrementMs: number
  perMove: boolean
}

export interface ModifierInfo {
  id: Modifier
  label: string
  text: string
}
