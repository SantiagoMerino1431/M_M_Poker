// src/lib/db/settings-store.ts
import { db } from "./client"
import { type AppSettings, DEFAULT_SETTINGS, mergeSettings } from "../config/settings"

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.execute("SELECT value FROM settings WHERE key = 'app'")
  const r = rows.rows[0] as any
  if (!r) return DEFAULT_SETTINGS
  try {
    return mergeSettings(JSON.parse(r.value))
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings()
  const next = mergeSettings({ ...current, ...patch })
  await db.execute({
    sql: `INSERT INTO settings (key, value, updated_at) VALUES ('app', ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [JSON.stringify(next), new Date().toISOString()],
  })
  return next
}
