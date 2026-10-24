const PALETTES = [
  ['#e23d2b', '#f3e6c8', '#e6b35a', '#7d2b22'],
  ['#f3e6c8', '#e23d2b', '#1a6b58', '#e6b35a'],
  ['#e6b35a', '#e23d2b', '#f6f1e7', '#3d2415'],
  ['#f6f1e7', '#e6b35a', '#e23d2b', '#0f3d34'],
]

export function hashName(name: string): number {
  let hash = 2166136261
  for (const char of name) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function Avatar({ name, size = 72 }: { name: string; size?: number }) {
  const hash = hashName(name || 'игрок')
  const colors = PALETTES[hash % PALETTES.length]
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 80 80" aria-hidden>
      <circle cx="40" cy="40" r="38" fill="#123f36" />
      <circle cx="40" cy="40" r="34" fill="#0c2c26" />
      {[0, 1, 2, 3].map((index) => (
        <circle
          key={index}
          cx={26 + (index % 2) * 28}
          cy={26 + Math.floor(index / 2) * 28}
          r={index === hash % 4 ? 12 : 9}
          fill={colors[(hash >> (index * 2)) % colors.length]}
        />
      ))}
    </svg>
  )
}
