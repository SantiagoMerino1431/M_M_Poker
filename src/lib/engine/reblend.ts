import { devig } from "../model/devig"
import { blendProbability } from "../model/blend"

const TYPICAL_OVERROUND = 1.05

export function reblendSelection(
  modelProbability: number,
  odds: number,
  oppositeOdds: number | null,
): { marketProbability: number; ourProbability: number } {
  let marketProbability: number
  if (oppositeOdds != null && oppositeOdds > 1) {
    const probs = devig([odds, oppositeOdds])
    marketProbability = probs[0]
  } else {
    marketProbability = (1 / odds) / TYPICAL_OVERROUND
  }
  return {
    marketProbability,
    ourProbability: blendProbability(modelProbability, marketProbability),
  }
}
