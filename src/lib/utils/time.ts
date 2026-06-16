const TZ = "America/Bogota"
const LOCALE = "es-CO"

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(LOCALE, {
    timeZone: TZ,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString(LOCALE, {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString(LOCALE, {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function todayLabel(): string {
  return new Date().toLocaleDateString(LOCALE, {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

// Bogotá es UTC-5 sin horario de verano. Devuelve los límites UTC del día
// calendario de Bogotá que contiene `now`.
export function bogotaDayRangeUtc(now: Date = new Date()): { startUtc: string; endUtc: string } {
  const offsetMs = 5 * 60 * 60 * 1000 // UTC-5
  const local = new Date(now.getTime() - offsetMs)
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()
  const d = local.getUTCDate()
  const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0) + offsetMs)
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000)
  return { startUtc: startUtc.toISOString(), endUtc: endUtc.toISOString() }
}
