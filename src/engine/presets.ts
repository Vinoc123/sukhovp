import type { BoardPreset, Modifier, ModifierInfo, Rules, TimeControl } from './types.ts'

export const BOARD_PRESETS: BoardPreset[] = [
  { id: 'mini', label: 'Мини', hint: '5×4', rows: 4, cols: 5, connect: 4 },
  { id: 'classic', label: 'Классика', hint: '7×6', rows: 6, cols: 7, connect: 4 },
  { id: 'square', label: 'Квадрат', hint: '8×8', rows: 8, cols: 8, connect: 4 },
  { id: 'big', label: 'Большая', hint: '9×7 · пять в ряд', rows: 7, cols: 9, connect: 5 },
]

export const MODIFIERS: ModifierInfo[] = [
  { id: 'classic', label: 'Классика', text: 'Фишка падает вниз' },
  { id: 'flip', label: 'Переворот', text: 'Каждые четыре полухода гравитация меняется' },
  { id: 'pop', label: 'Выталкивание', text: 'Можно вынуть свою нижнюю фишку' },
  { id: 'rotate', label: 'Поворот', text: 'Каждые четыре полухода поле крутится на 90°' },
  { id: 'rush', label: 'Двойной', text: 'Две фишки за один ход' },
]

export const TIME_CONTROLS: TimeControl[] = [
  { id: 'inf', label: 'Без лимита', initialMs: 0, incrementMs: 0, perMove: false },
  { id: '10+5', label: '10+5', initialMs: 600_000, incrementMs: 5_000, perMove: false },
  { id: '5+3', label: '5+3', initialMs: 300_000, incrementMs: 3_000, perMove: false },
  { id: '3+2', label: '3+2', initialMs: 180_000, incrementMs: 2_000, perMove: false },
  { id: '1+0', label: '1+0', initialMs: 60_000, incrementMs: 0, perMove: false },
  { id: '30s', label: '30 с/ход', initialMs: 30_000, incrementMs: 0, perMove: true },
]

export function isUnlimited(time: Pick<TimeControl, 'initialMs' | 'perMove'>): boolean {
  return !time.perMove && time.initialMs === 0
}

export function rulesFromPreset(presetId: string, modifier: Modifier): Rules | null {
  const preset = BOARD_PRESETS.find((item) => item.id === presetId)
  if (!preset) return null
  if (!MODIFIERS.some((item) => item.id === modifier)) return null
  return { rows: preset.rows, cols: preset.cols, connect: preset.connect, modifier }
}

export function matchSettings(input: {
  presetId?: string
  modifier?: string
  timeId?: string
}): { rules: Rules; time: TimeControl } | null {
  if (!input.presetId || !input.modifier || !input.timeId) return null
  const rules = rulesFromPreset(input.presetId, input.modifier as Modifier)
  const time = TIME_CONTROLS.find((item) => item.id === input.timeId)
  if (!rules || !time) return null
  return { rules, time }
}

export function presetIdFor(rules: Pick<Rules, 'rows' | 'cols' | 'connect'>): string | null {
  return BOARD_PRESETS.find((item) => item.rows === rules.rows && item.cols === rules.cols && item.connect === rules.connect)?.id ?? null
}
