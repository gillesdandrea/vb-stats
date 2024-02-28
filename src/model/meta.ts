import { Match } from './model';

export interface MetaSlot {
  low: number;
  high: number;
  expected: number;
  predicted: number;
  played: number;
  skipped: number;
}

export interface MetaStats {
  global: MetaSlot;
  slots: MetaSlot[];
}

const createSlot = (low: number, high: number): MetaSlot => {
  return {
    low: low / 100.0,
    high: high / 100.0,
    expected: 0,
    predicted: 0,
    played: 0,
    skipped: 0,
  };
};

export const createMetaStats = (): MetaStats => {
  return {
    global: createSlot(0, 100),
    slots: [
      createSlot(50, 60),
      createSlot(60, 70),
      createSlot(70, 80),
      createSlot(80, 90),
      createSlot(90, 100),
      //
      // createSlot(50, 55),
      // createSlot(55, 60),
      // createSlot(60, 65),
      // createSlot(65, 70),
      // createSlot(70, 75),
      // createSlot(75, 80),
      // createSlot(80, 85),
      // createSlot(85, 90),
      // createSlot(90, 95),
      // createSlot(95, 100),
    ],
  };
};

export const metaAddMatch = (meta: MetaStats, match: Match) => {
  if (!match.winner) {
    return;
  }
  if (match.predicted === undefined) {
    meta.global.skipped++;
    return;
  }

  const probability = match.winProbability >= 0.5 ? match.winProbability : 1 - match.winProbability;
  const slot: MetaSlot | undefined = meta.slots.find((slot) => slot.low <= probability && probability < slot.high);
  if (slot) {
    slot.played++;
    slot.expected += probability;
    meta.global.played++;
    meta.global.expected += probability;
    if (match.predicted) {
      slot.predicted++;
      meta.global.predicted++;
    }
  } else {
    console.log('Cannot find a slot stat for match', match);
  }
};

export const metaToString = (meta: MetaStats): string => {
  return `Globally expected: ${((100 * meta.global.expected) / meta.global.played).toFixed(1)}% predicted: ${(
    (100 * meta.global.predicted) /
    meta.global.played
  ).toFixed(1)}% (${meta.global.predicted}/${meta.global.played}), skipped ${
    meta.global.skipped
  } (no previous ranking).\n${meta.slots
    .map(
      (slot) =>
        `Range: ${(100 * slot.low).toFixed(0)}-${(100 * slot.high).toFixed(0)}% | expected: ${(
          (100 * slot.expected) /
          slot.played
        ).toFixed(1)}% | predicted: ${((100 * slot.predicted) / slot.played).toFixed(1)}% (${slot.predicted}/${
          slot.played
        }) | proportion: ${((100 * slot.played) / meta.global.played).toFixed(1)}%`,
    )
    .join('\n')}`;
};
