import { describe, it, expect, beforeAll } from "vitest"
import { saveBet, getBets, deleteBet, updateBet } from "../kelly/tracker"
import { migrate } from "../db/schema"

const base = {
  fixtureId: 98010, market: "1X2", selection: "home", ourProbability: 0.5,
  bookmakerProbability: 0.48, oddsUsed: 2.1, oddsClosing: null, amount: 5000,
  kellySuggested: 0.04, EV: 0.05, edge: 0.02, result: null, profitLoss: null,
  mode: "paper" as const, confidenceAtTime: 60, createdAt: new Date().toISOString(), settledAt: null,
}

describe("tracker CRUD", () => {
  beforeAll(async () => { await migrate() })
  it("elimina una apuesta", async () => {
    const id = await saveBet(base)
    await deleteBet(id)
    const remaining = (await getBets({ mode: "paper" })).filter(b => b.id === id)
    expect(remaining.length).toBe(0)
  })
  it("edita monto y cuota", async () => {
    const id = await saveBet(base)
    await updateBet(id, { amount: 8000, oddsUsed: 2.5 })
    const bet = (await getBets({ mode: "paper" })).find(b => b.id === id)!
    expect(bet.amount).toBe(8000)
    expect(bet.oddsUsed).toBe(2.5)
    await deleteBet(id)
  })
})
