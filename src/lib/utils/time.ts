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
