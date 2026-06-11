import { describe, it, expect } from "vitest"
import { resolveMarket } from "../resolver"

describe("resolveMarket — 1X2", () => {
  it("selection 1 wins when home scores more", () => {
    expect(resolveMarket("1X2", "1", 2, 1)).toBe("win")
  })
  it("selection 1 loses when home scores less", () => {
    expect(resolveMarket("1X2", "1", 0, 1)).toBe("loss")
  })
  it("selection X wins on draw", () => {
    expect(resolveMarket("1X2", "X", 1, 1)).toBe("win")
  })
  it("selection X loses on non-draw", () => {
    expect(resolveMarket("1X2", "X", 2, 0)).toBe("loss")
  })
  it("selection 2 wins when away scores more", () => {
    expect(resolveMarket("1X2", "2", 0, 3)).toBe("win")
  })
  it("selection 2 loses when home scores more", () => {
    expect(resolveMarket("1X2", "2", 2, 1)).toBe("loss")
  })
})

describe("resolveMarket — Over/Under 2.5", () => {
  it("Over 2.5 wins when total > 2.5", () => {
    expect(resolveMarket("Over 2.5 Goals", "Over", 2, 1)).toBe("win")
  })
  it("Over 2.5 loses when total <= 2.5", () => {
    expect(resolveMarket("Over 2.5 Goals", "Over", 1, 1)).toBe("loss")
  })
  it("Under 2.5 wins when total <= 2.5", () => {
    expect(resolveMarket("Over 2.5 Goals", "Under", 1, 0)).toBe("win")
  })
})

describe("resolveMarket — BTTS", () => {
  it("BTTS Yes wins when both scored", () => {
    expect(resolveMarket("BTTS", "Yes", 1, 1)).toBe("win")
  })
  it("BTTS Yes loses when one team scored 0", () => {
    expect(resolveMarket("BTTS", "Yes", 0, 2)).toBe("loss")
  })
  it("BTTS No wins when one team scored 0", () => {
    expect(resolveMarket("BTTS", "No", 3, 0)).toBe("win")
  })
})

describe("resolveMarket — unknown market", () => {
  it("returns void for markets not handled", () => {
    expect(resolveMarket("Corner Kicks", "Over 9.5", 1, 0)).toBe("void")
  })
})
