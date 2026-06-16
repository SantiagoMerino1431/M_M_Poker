import { describe, it, expect } from "vitest"
import { bogotaDayRangeUtc } from "../utils/time"

describe("bogotaDayRangeUtc", () => {
  it("a las 21:00 de Bogotá (02:00Z del día siguiente) el día sigue siendo el anterior", () => {
    // 2026-06-15T02:00:00Z === 2026-06-14 21:00 en Bogotá (UTC-5)
    const r = bogotaDayRangeUtc(new Date("2026-06-15T02:00:00Z"))
    expect(r.startUtc).toBe("2026-06-14T05:00:00.000Z")
    expect(r.endUtc).toBe("2026-06-15T05:00:00.000Z")
  })
  it("a mediodía de Bogotá el rango cubre ese día calendario", () => {
    // 2026-06-15T17:00:00Z === 2026-06-15 12:00 en Bogotá
    const r = bogotaDayRangeUtc(new Date("2026-06-15T17:00:00Z"))
    expect(r.startUtc).toBe("2026-06-15T05:00:00.000Z")
    expect(r.endUtc).toBe("2026-06-16T05:00:00.000Z")
  })
})
