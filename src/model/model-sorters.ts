import { Team } from './model';
import { getTeamStats } from './model-helpers';

export enum Sorting {
  POINTS,
  RATING,
}

// Sorting.RATING
export const ratingSorter =
  (day: number, global = true) =>
  (a: Team, b: Team) => {
    // const astats = global ? a.gstats[day] : a.dstats[day];
    // const bstats = global ? b.gstats[day] : b.dstats[day];
    const astats = getTeamStats(a, day, global);
    const bstats = getTeamStats(b, day, global);
    if (astats.rating.mu === bstats.rating.mu) {
      return a.name.localeCompare(b.name);
    }
    return bstats.rating.mu - astats.rating.mu;
  };

// Sorting.POINTS
export const rankingSorter =
  (day: number, global = true) =>
  (a: Team, b: Team) => {
    const astats = getTeamStats(a, day, global);
    const bstats = getTeamStats(b, day, global);
    const apoints = astats.matchCount === 0 ? -1 : (astats.points * 2 * Math.min(day, a.lastDay)) / astats.matchCount;
    const bpoints = bstats.matchCount === 0 ? -1 : (bstats.points * 2 * Math.min(day, b.lastDay)) / bstats.matchCount;
    return apoints === bpoints ? setSorter(day, global)(a, b) : bpoints - apoints;
  };

export const setSorter =
  (day: number, global = true) =>
  (a: Team, b: Team) => {
    const astats = getTeamStats(a, day, global);
    const bstats = getTeamStats(b, day, global);
    const asratio =
      astats.matchCount === 0 ? -1 : astats.setLost === 0 ? Number.MAX_SAFE_INTEGER : astats.setWon / astats.setLost;
    const bsratio =
      astats.matchCount === 0 ? -1 : bstats.setLost === 0 ? Number.MAX_SAFE_INTEGER : bstats.setWon / bstats.setLost;
    return asratio === bsratio ? pointSorter(day, global)(a, b) : bsratio - asratio;
  };

export const pointSorter =
  (day: number, global = true) =>
  (a: Team, b: Team) => {
    const astats = getTeamStats(a, day, global);
    const bstats = getTeamStats(b, day, global);
    const apratio =
      astats.matchCount === 0
        ? -1
        : astats.pointLost === 0
        ? Number.MAX_SAFE_INTEGER
        : astats.pointWon / astats.pointLost;
    const bpratio =
      astats.matchCount === 0
        ? -1
        : bstats.pointLost === 0
        ? Number.MAX_SAFE_INTEGER
        : bstats.pointWon / bstats.pointLost;
    return apratio === bpratio ? ratingSorter(day, global)(a, b) : bpratio - apratio;
  };

export const poolSorter =
  (day: number, global = true) =>
  (a: Team, b: Team) => {
    const apool = a.pools[day];
    const bpool = b.pools[day];
    if (!apool && !bpool) {
      return rankingSorter(day, global)(a, b);
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

export const previousPoolSorter =
  (day: number, global = true) =>
  (a: Team, b: Team) => {
    const apool = a.pools[day];
    const bpool = b.pools[day];
    if (!apool && !bpool) {
      return rankingSorter(day, global)(a, b);
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
