const ALPHA = 0.15

function clamp(v: number): number { return Math.min(2.0, Math.max(0.5, v)) }

export interface StrengthSnapshot {
  homeAttack: number; homeDefense: number;
  awayAttack: number; awayDefense: number;
}

export interface StrengthResult extends StrengthSnapshot {}

interface UpdateInput extends StrengthSnapshot {
  homeGoals: number; awayGoals: number;
}

export function updatedStrengths(input: UpdateInput): StrengthResult {
  const { homeAttack, homeDefense, awayAttack, awayDefense, homeGoals, awayGoals } = input

  const homeExpected = homeAttack * awayDefense
  const awayExpected = awayAttack * homeDefense

  const wHomeAtk = ALPHA * awayDefense
  const wHomeDef = ALPHA * awayAttack
  const wAwayAtk = ALPHA * homeDefense
  const wAwayDef = ALPHA * homeAttack

  return {
    homeAttack: clamp(homeAttack + wHomeAtk * (homeGoals - homeExpected)),
    homeDefense: clamp(homeDefense + wHomeDef * (awayGoals - awayExpected)),
    awayAttack: clamp(awayAttack + wAwayAtk * (awayGoals - awayExpected)),
    awayDefense: clamp(awayDefense + wAwayDef * (homeGoals - homeExpected)),
  }
}
