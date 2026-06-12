// Peso del modelo en la mezcla con el consenso de-viggeado del mercado.
// El consenso de 20+ bookmakers es el mejor predictor público; un modelo
// amateur debe anclarse a él y apostar solo una fracción del desacuerdo.
// Calibrable contra data/closing_odds.csv (ver scripts/calibrate.ts).
export const MODEL_WEIGHT = 0.35

export function blendProbability(modelProb: number, marketProb: number | null): number {
  if (marketProb === null) return modelProb
  return MODEL_WEIGHT * modelProb + (1 - MODEL_WEIGHT) * marketProb
}
