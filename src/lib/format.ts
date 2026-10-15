const employeePalette = [
  '#167a5a',
  '#28678f',
  '#956a2d',
  '#76559a',
  '#ac5b4f',
  '#23827f',
  '#486f3e',
  '#a44d7a',
  '#657b9a',
  '#b2743b',
]

export function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function colorForEmployee(name: string): string {
  let hash = 0
  for (const char of normalizeKey(name)) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return employeePalette[Math.abs(hash) % employeePalette.length]
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value)
}

export function formatDistance(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${formatNumber(value, 1)} km`
}

export function formatArea(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${formatNumber(value, 0)} ha`
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const minutes = Math.round(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${minutes} min`
  if (rest === 0) return `${hours} h`
  return `${hours} h ${rest} min`
}

export function formatCoordinates(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('pt-BR') ?? '').join('') || '—'
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return map[char]
  })
}
