import { type Team } from './model';
import { getTeamStats } from './model-helpers';

export enum Sorting {
  POINTS,
  RATING,
}

export type SorterParams = [day: number, global?: boolean, pf?: boolean, slidingMaxDays?: number];
export type TeamSorter = (...params: SorterParams) => (a: Team, b: Team) => number;

// Sorting.RATING
export const ratingSorter: TeamSorter =
  (day, global = true, pf = false, slidingMaxDays = 4) =>
  (a: Team, b: Team) => {
    const astats = getTeamStats(a, day, global, pf, slidingMaxDays);
    const bstats = getTeamStats(b, day, global, pf, slidingMaxDays);
    if (astats.rating.mu === bstats.rating.mu) {
      return a.name.localeCompare(b.name);
    }
    return bstats.rating.mu - astats.rating.mu;
  };

// Sorting.POINTS
export const rankingSorter: TeamSorter =
  (day, global = true, pf = false, slidingMaxDays = 4) =>
  (a: Team, b: Team) => {
    const astats = getTeamStats(a, day, global, pf, slidingMaxDays);
    const bstats = getTeamStats(b, day, global, pf, slidingMaxDays);
    const aIsCDF = a.pools.length > 0;
    const acoef = aIsCDF ? 2 : 1;
    const adayCount = global ? Math.min(day, a.lastDay) : 1;
    const apoints = astats.matchCount === 0 ? -1 : (astats.points * acoef * adayCount) / astats.matchCount;
    const bIsCDF = b.pools.length > 0;
    const bcoef = bIsCDF ? 2 : 1;
    const bdayCount = global ? Math.min(day, b.lastDay) : 1;
    const bpoints = bstats.matchCount === 0 ? -1 : (bstats.points * bcoef * bdayCount) / bstats.matchCount;
    return apoints === bpoints ? setSorter(day, global, pf, slidingMaxDays)(a, b) : bpoints - apoints;
  };

export const matchSorter: TeamSorter =
  (day, global = true, pf = false, slidingMaxDays = 4) =>
  (a: Team, b: Team) => {
    const astats = getTeamStats(a, day, global, pf, slidingMaxDays);
    const bstats = getTeamStats(b, day, global, pf, slidingMaxDays);
    const asratio =
      astats.matchCount === 0
        ? -1
        : astats.matchLost === 0
          ? Number.MAX_SAFE_INTEGER
          : astats.matchWon / astats.matchLost;
    const bsratio =
      bstats.matchCount === 0
        ? -1
        : bstats.matchLost === 0
          ? Number.MAX_SAFE_INTEGER
          : bstats.matchWon / bstats.matchLost;
    return asratio === bsratio ? setSorter(day, global, pf, slidingMaxDays)(a, b) : bsratio - asratio;
  };

export const setSorter: TeamSorter =
  (day, global = true, pf = false, slidingMaxDays = 4) =>
  (a: Team, b: Team) => {
    const astats = getTeamStats(a, day, global, pf, slidingMaxDays);
    const bstats = getTeamStats(b, day, global, pf, slidingMaxDays);
    const asratio =
      astats.matchCount === 0 ? -1 : astats.setLost === 0 ? Number.MAX_SAFE_INTEGER : astats.setWon / astats.setLost;
    const bsratio =
      bstats.matchCount === 0 ? -1 : bstats.setLost === 0 ? Number.MAX_SAFE_INTEGER : bstats.setWon / bstats.setLost;
    return asratio === bsratio ? pointSorter(day, global, pf, slidingMaxDays)(a, b) : bsratio - asratio;
  };

export const pointSorter: TeamSorter =
  (day, global = true, pf = false, slidingMaxDays = 4) =>
  (a: Team, b: Team) => {
    const astats = getTeamStats(a, day, global, pf, slidingMaxDays);
    const bstats = getTeamStats(b, day, global, pf, slidingMaxDays);
    const apratio =
      astats.matchCount === 0
        ? -1
        : astats.pointLost === 0
          ? Number.MAX_SAFE_INTEGER
          : astats.pointWon / astats.pointLost;
    const bpratio =
      bstats.matchCount === 0
        ? -1
        : bstats.pointLost === 0
          ? Number.MAX_SAFE_INTEGER
          : bstats.pointWon / bstats.pointLost;
    return apratio === bpratio ? ratingSorter(day, global, pf, slidingMaxDays)(a, b) : bpratio - apratio;
  };

export const poolSorter: TeamSorter =
  (day, global = true, pf = false, slidingMaxDays = 4) =>
  (a: Team, b: Team) => {
    const apool = a.pools[day];
    const bpool = b.pools[day];
    if (!apool && !bpool) {
      return rankingSorter(day, global, pf, slidingMaxDays)(a, b);
    }
    if (!apool) {
      return +1;
    }
    if (!bpool) {
      return -1;
    }
    if (apool === bpool) {
      const aindex = apool.teams.findIndex((team) => team === a);
      const bindex = apool.teams.findIndex((team) => team === b);
      return aindex - bindex;
    }
    return apool.name.localeCompare(bpool.name);
  };

export const previousPoolSorter: TeamSorter =
  (day, global = true, pf = false, slidingMaxDays = 4) =>
  (a: Team, b: Team) => {
    const apool = a.pools[day];
    const bpool = b.pools[day];
    if (!apool && !bpool) {
      return rankingSorter(day, global, pf, slidingMaxDays)(a, b);
    }
    if (!apool) {
      return +1;
    }
    if (!bpool) {
      return -1;
    }
    if (apool === bpool) {
      if (day === 1) {
        const aindex = apool.teams.findIndex((team) => team === a);
        const bindex = apool.teams.findIndex((team) => team === b);
        return aindex - bindex;
      }
      return rankingSorter(day - 1, false)(a, b);
    }
    return apool.ranking && bpool.ranking ? apool.ranking - bpool.ranking : apool.name.localeCompare(bpool.name);
  };
