import { describe, it, expect } from "vitest"
import { resolveMarket } from "../resolver"

describe("resolveMarket — 1X2", () => {
  it("home wins when home scores more", () => {
    expect(resolveMarket("1X2", "home", 2, 1)).toBe("win")
  })
  it("home loses when home scores less", () => {
    expect(resolveMarket("1X2", "home", 0, 1)).toBe("loss")
  })
  it("draw wins on equal score", () => {
    expect(resolveMarket("1X2", "draw", 1, 1)).toBe("win")
  })
  it("draw loses on non-draw", () => {
    expect(resolveMarket("1X2", "draw", 2, 0)).toBe("loss")
  })
  it("away wins when away scores more", () => {
    expect(resolveMarket("1X2", "away", 0, 3)).toBe("win")
  })
  it("away loses when home scores more", () => {
    expect(resolveMarket("1X2", "away", 2, 1)).toBe("loss")
  })
})

describe("resolveMarket — Over/Under", () => {
  it("over_2.5 wins when total > 2.5", () => {
    expect(resolveMarket("Over/Under", "over_2.5", 2, 1)).toBe("win")
  })
  it("over_2.5 loses when total <= 2.5", () => {
    expect(resolveMarket("Over/Under", "over_2.5", 1, 1)).toBe("loss")
  })
  it("under_2.5 wins when total <= 2.5", () => {
    expect(resolveMarket("Over/Under", "under_2.5", 1, 0)).toBe("win")
  })
  it("over_1.5 wins when total > 1.5", () => {
    expect(resolveMarket("Over/Under", "over_1.5", 1, 1)).toBe("win")
  })
})

describe("resolveMarket — BTTS", () => {
  it("yes wins when both scored", () => {
    expect(resolveMarket("BTTS", "yes", 1, 1)).toBe("win")
  })
  it("yes loses when one team scored 0", () => {
    expect(resolveMarket("BTTS", "yes", 0, 2)).toBe("loss")
  })
  it("no wins when one team scored 0", () => {
    expect(resolveMarket("BTTS", "no", 3, 0)).toBe("win")
  })
})

describe("resolveMarket — unknown market", () => {
  it("returns void for markets not handled", () => {
    expect(resolveMarket("Marcador Exacto", "1-0", 1, 0)).toBe("void")
  })
})
