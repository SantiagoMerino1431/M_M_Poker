// src/lib/config/settings.ts
export interface AppSettings {
  kellyFraction: number
  maxStakeFraction: number
  dailyExposureFraction: number
  minConfidence: number
  paperOnly: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  kellyFraction: 0.5,
  maxStakeFraction: 0.08,
  dailyExposureFraction: 0.15,
  minConfidence: 40,
  paperOnly: true,
}

export function mergeSettings(partial: Partial<AppSettings>): AppSettings {
  return { ...DEFAULT_SETTINGS, ...partial }
}

export function effectiveBetMode(requested: "real" | "paper", paperOnly: boolean): "real" | "paper" {
  return paperOnly ? "paper" : requested
}
