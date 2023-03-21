import { Match } from './model';

export interface MetaStats {
  low: number;
  high: number;
  predicted: number;
  played: number;
}

const createMeta = (low: number, high: number): MetaStats => {
  return {
    low: low / 100.0,
    high: high / 100.0,
    predicted: 0,
    played: 0,
  };
};

const globalMeta = createMeta(0, 100);

const metas = [
  createMeta(50, 60),
  createMeta(60, 70),
  createMeta(70, 80),
  createMeta(80, 90),
  createMeta(90, 100),
  //
  // createMeta(50, 55),
  // createMeta(55, 60),
  // createMeta(60, 65),
  // createMeta(65, 70),
  // createMeta(70, 75),
  // createMeta(75, 80),
  // createMeta(80, 85),
  // createMeta(85, 90),
  // createMeta(90, 95),
  // createMeta(95, 100),
];

export const addMatchMeta = (match: Match) => {
  if (!match.winner) {
    return;
  }

  const proba = match.winner === match.teamA ? match.winProbability : 1 - match.winProbability;
  const predicted = proba >= 0.5;
  const slot = predicted ? proba : 1 - proba;
  const meta: MetaStats | undefined = metas.find((meta) => meta.low <= slot && slot < meta.high);
  if (meta) {
    meta.played++;
    globalMeta.played++;
    if (predicted) {
      meta.predicted++;
      globalMeta.predicted++;
    }
  } else {
    // console.log('Cannot find a meta stat for match', match);
  }
};

export const metaToString = (): string => {
  return `Globally predicted ${globalMeta.predicted}/${globalMeta.played} (${(
    (100 * globalMeta.predicted) /
    globalMeta.played
  ).toFixed(1)})%\n${metas
    .map(
      (meta) =>
        `Expected ${100 * meta.low}-${100 * meta.high}% predicted ${((100 * meta.predicted) / meta.played).toFixed(
          1,
        )}% (${meta.predicted}/${meta.played})`,
    )
    .join('\n')}`;
};
