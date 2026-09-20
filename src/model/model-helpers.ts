import { Rating, TrueSkill, winProbability } from 'ts-trueskill';

import { getDepartment } from './geography';
import { type Competition, type Entity, type Match, type Pool, type Stats, type Team } from './model';
import { matchSorter, rankingSorter, ratingSorter, Sorting } from './model-sorters';

// mu, sigma, beta, tau, drawProbability
// this.mu = mu ?? 25;
// this.sigma = sigma ?? this.mu / 3;
// this.beta = beta ?? this.sigma / 2;
// this.tau = tau ?? this.sigma / 100;
// const mu = 25;
// const sigma = mu / 3;
// const ts = new TrueSkill(mu, sigma, sigma / 2, sigma / 100, 0);
const ts = new TrueSkill(undefined, undefined, undefined, undefined, 0);
const TIGHT_FACTOR = 4 / 5; // 1 to disable tight score management
const MIN_DELTA = 0.0001;

export const filterTeam = (team: Team, tokens: string[]) =>
  tokens.length === 0 ||
  tokens.some((token) => {
    const rtoken = token.replaceAll('_', ' ');
    const name = team.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase();
    if (name.includes(rtoken)) return true;
    const local = `${team.department.num_dep} ${team.department.dep_name} ${team.department.region_name}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase();
    if (local.includes(rtoken)) return true;
    return false;
  });

export const rateMatch = (ratingWinner: Rating, ratingLoser: Rating, tightScore = false): [Rating, Rating] => {
  const ranks = [0, 1];
  const weights = [[1], [tightScore ? TIGHT_FACTOR : 1]];
  const teams = ts.rate([[ratingWinner], [ratingLoser]], ranks, weights, MIN_DELTA);
  return [teams[0][0] as Rating, teams[1][0] as Rating];
};

export const rateWinPropability = (ratingWinner: Rating, ratingLoser: Rating): number =>
  winProbability([ratingWinner], [ratingLoser], ts);

export const getWinProbability = (teamA: Team, teamB: Team, day: number): number => {
  return day === 1 ? 0.5 : winProbability([getTeamRating(teamA, day - 1)], [getTeamRating(teamB, day - 1)], ts);
};

export const createCompetition = (name: string, season: string, entity: Entity, category: string): Competition => {
  const competition = {
    name,
    season,
    entity,
    category,
    teams: new Map<string, Team>(),
    matchs: [],
    days: [],
    dayCount: 0,
    lastDay: 0,
  };
  return competition;
};

export const createStats = (rating: Rating): Stats => ({
  rating,
  difficulty: [-1, -1],
  points: 0,
  matchCount: 0,
  matchWon: 0,
  matchLost: 0,
  setWon: 0,
  setLost: 0,
  pointWon: 0,
  pointLost: 0,
  matchs: [],
});

//
// Team

export const getTeam = (competition: Competition, id: string, name?: string): Team => {
  const team = competition.teams.get(id);
  if (team) {
    return team;
  }

  const rating = new Rating();
  const newTeam: Team = {
    id,
    name: name ?? id,
    department: getDepartment(id.substring(1, 3)) ?? 'N/A',
    ranking: {
      globals: [],
      qualifieds: [],
      days: [],
      pools: [],
      // dayCount: 0,
    },
    gstats: [createStats(rating)],
    sstats: new Map<string, Stats>(),
    dstats: [],
    pools: [],
    dayCount: 0,
    lastDay: 0,
  };
  competition.teams.set(id, newTeam);
  return newTeam;
};

export const getGlobalTeamStats = (team: Team, day = team.dayCount): Stats => {
  if (!team.gstats[day]) {
    const prevStats = getGlobalTeamStats(team, day - 1); // team.gstats[0] is already defined
    team.gstats[day] = { ...prevStats };
  }
  return team.gstats[day];
};

export const getSlidingTeamStats = (team: Team, day = team.dayCount, maxDays = 4): Stats => {
  const key = `${day}:${maxDays}`;
  const cached = team.sstats.get(key);
  if (cached) return cached;
  let stats = createStats(getGlobalTeamStats(team, day).rating);
  for (let i = Math.max(1, day - maxDays); i < day; i++) {
    const istats = getDayTeamStats(team, i);
    stats = {
      ...stats,
      points: stats.points + istats.points,
      matchCount: stats.matchCount + istats.matchCount,
      matchWon: stats.matchWon + istats.matchWon,
      matchLost: stats.matchLost + istats.matchLost,
      setWon: stats.setWon + istats.setWon,
      setLost: stats.setLost + istats.setLost,
      pointWon: stats.pointWon + istats.pointWon,
      pointLost: stats.pointLost + istats.pointLost,
      matchs: [...stats.matchs, ...istats.matchs],
    };
  }
  team.sstats.set(key, stats);
  return stats;
};

export const getDayTeamStats = (team: Team, day: number): Stats => {
  if (!team.dstats[day]) {
    team.dstats[day] = createStats(getGlobalTeamStats(team, day).rating);
  }
  return team.dstats[day];
};

export const getTeamStats = (team: Team, day: number, global = true, pf = false, slidingMaxDays = 4): Stats => {
  if (!global) return getDayTeamStats(team, day);
  if (pf) return getSlidingTeamStats(team, day, slidingMaxDays);
  return getGlobalTeamStats(team, day);
};

export const getTeamRating = (team: Team, day: number): Rating => {
  return team.dstats[day]?.rating ?? getGlobalTeamStats(team, day).rating;
};

export const getTeamRanking = (team: Team, day: number, daily: boolean, qualified: boolean): number | undefined => {
  if (daily) return team.ranking.days[day];
  if (qualified) return team.ranking.qualifieds[day];
  return team.ranking.globals[day];
};

export const getTeamMatch = (team: Team, match: Match): Match => {
  if (match.teamA === team) {
    return match;
  }
  return {
    ...match,
    teamA: match.teamB,
    teamB: match.teamA,
    winner: match.winner,
    setA: match.setB,
    setB: match.setA,
    totalA: match.totalB,
    totalB: match.totalA,
    score: match.score.map((score) => ({ scoreA: score.scoreB, scoreB: score.scoreA })),
    ratingA: match.ratingB,
    ratingB: match.ratingA,
    winProbability: 1 - match.winProbability,
  };
};

const chars = '-123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const poolId2Name = (id: string): string => {
  if (id < 'X') {
    return id.substring(1, 2);
  }
  return '' + ((id.charCodeAt(0) - 'X'.charCodeAt(0)) * 35 + chars.indexOf(id.charAt(1)));
};

export const getPoolProbabilities = (pool: Pool, day: number): number[][] => {
  if (day === 1) {
    return [
      [1 / 3.0, 1 / 3.0, 1 / 3.0],
      [0, 0, 0],
    ];
  }
  const pt0 =
    getWinProbability(pool.teams[0], pool.teams[1], day) * getWinProbability(pool.teams[0], pool.teams[2], day);
  const pt1 =
    getWinProbability(pool.teams[1], pool.teams[0], day) * getWinProbability(pool.teams[1], pool.teams[2], day);
  const pt2 =
    getWinProbability(pool.teams[2], pool.teams[0], day) * getWinProbability(pool.teams[2], pool.teams[1], day);
  const total = pt0 + pt1 + pt2;
  const probabilities = [pt0 / total, pt1 / total, pt2 / total];
  const orders = [0, 1, 2];
  const swap = (a: number, b: number) => {
    if (probabilities[orders[a]] < probabilities[orders[b]]) {
      const oa = orders[a];
      orders[a] = orders[b];
      orders[b] = oa;
    }
  };
  swap(0, 1);
  swap(1, 2);
  swap(0, 1);
  if (probabilities[orders[0]] < probabilities[orders[1]]) throw new Error('0-1');
  if (probabilities[orders[1]] < probabilities[orders[2]]) throw new Error('1-2');
  const index: number[] = [];
  index[orders[0]] = 1;
  index[orders[1]] = 2;
  index[orders[2]] = 3;
  return [probabilities, index];
};

export const getMatchPool = (competition: Competition, match: Match): Pool | undefined => {
  return competition.days[match.day].pools.get(match.id.substring(1, 3));
};

export const getDayRanking = (competition: Competition, team: Team, day: number) => {
  return day > competition.lastDay ? 0 : (team.ranking.pools[day] ?? 0);
};

export const getFirstCountInCurrentDay = (team: Team, day: number): number => {
  if (day <= 1) {
    return 0;
  }
  return team.pools[day - 1]?.teams.filter((t) => t.ranking.pools[day] === 1).length;
};

export const getDayDistance = (team: Team, day: number): string => {
  const pool = team.pools[day]?.teams;
  if (pool?.length === 3) {
    const host = pool[0];
    if (host === team) {
      return 'L';
    }

    if (host.department === team.department) {
      return 'D';
    }

    if (host.department.region_name === team.department.region_name) {
      return 'R';
    }

    return 'N';
  }

  return '';
};

export const isDayPlayed = (competition: Competition, day: number): boolean => {
  const dayData = competition.days[day];
  if (!dayData || dayData.pools.size === 0) return false;
  return Array.from(dayData.pools.values()).every((pool) => pool.matchs.every((match) => match.winner));
};

export const filterThirdPlace = (teams: Team[], day: number): Team[] => {
  const thirdPlace = teams.filter((t) => t.ranking.pools[day] === 3);
  const others = teams.filter((t) => t.ranking.pools[day] !== 3);
  const deficit = others.length % 3;
  if (deficit === 0) return others;
  const toKeep = 3 - deficit;
  thirdPlace.sort(rankingSorter(day, false));
  return [...others, ...thirdPlace.slice(0, toKeep)];
};

export const isTeamInCourse = (competition: Competition, team: Team, day: number): boolean => {
  if (day === 1 || team.dayCount >= day) {
    return true;
  }
  if (day > 1) {
    const previousDayRanking = getDayRanking(competition, team, day - 1);
    return previousDayRanking === 1 || previousDayRanking === 2;
  }
  return false;
};

/**
 * Computes the adjusted day for sliding window stats (last 4 pool days).
 * Skips PF day by using the previous day as the effective last pool day.
 */
export const getSlidingDay = (competition: Competition, day: number): number => {
  const effectiveDay = competition.days[day]?.pf ? day - 1 : Math.min(day, competition.lastDay);
  return effectiveDay + 1;
};

export const getVirtualPoolName = (index: number): string => {
  if (index < 26) return String.fromCharCode(65 + index); // A-Z
  return String(index - 25); // 1, 2, 3, ...
};

export const compareVirtualPoolNames = (a: string, b: string): number => {
  const aIsLetter = /^[A-Z]$/.test(a);
  const bIsLetter = /^[A-Z]$/.test(b);
  if (aIsLetter && bIsLetter) return a.localeCompare(b);
  if (aIsLetter) return -1; // letters before numbers
  if (bIsLetter) return 1;
  return Number(a) - Number(b); // natural numeric sort
};

export const computeVirtualPools = (teams: Team[]): Map<string, string> => {
  const numPools = Math.floor(teams.length / 3);
  const poolMap = new Map<string, string>();
  for (let i = 0; i < numPools * 3; i++) {
    const row = Math.floor(i / numPools);
    const posInRow = i % numPools;
    const poolIndex = row % 2 === 0 ? posInRow : numPools - 1 - posInRow;
    poolMap.set(teams[i].id, getVirtualPoolName(poolIndex));
  }
  return poolMap;
};

export const getBoard = (
  competition: Competition,
  sorting = Sorting.POINTS,
  day: number,
  daily: boolean, // for sorting
  qualified: boolean, // for filtering
  sliding = 0,
): Team[] => {
  const isPFday = (d: number) => competition.days[d]?.pf;
  const board =
    qualified || sliding > 0 ? [...(competition.days[day]?.teams ?? [])] : Array.from(competition.teams.values());

  if (sliding > 0) {
    let teams = board;
    if (!isPFday(day) && isDayPlayed(competition, day)) {
      teams = filterThirdPlace(teams, day);
    }
    teams.sort(matchSorter(getSlidingDay(competition, day), true, true, sliding));
    return teams;
  } else if (sorting === Sorting.RATING) {
    board.sort(ratingSorter(day, !daily));
  } else {
    if (isPFday(day)) board.sort(matchSorter(day, !daily, true));
    else board.sort(rankingSorter(day, !daily));
  }

  return board;
};

// returns [mean, standard deviation] of opposition (chance to lose)
export const getTeamOpposition = (
  competition: Competition,
  team: Team,
  mday: number = competition.dayCount,
  global = true,
): [number, number] => {
  const day = Math.min(team.dayCount, mday);
  const stats = getTeamStats(team, day, global);
  const [mean, stdev] = stats.difficulty;
  if (mean < 0 && stdev < 0) {
    stats.difficulty = getUncachedTeamOpposition(team, day, global);
  }
  return stats.difficulty;
};

const getUncachedTeamOpposition = (team: Team, day: number, global: boolean): [number, number] => {
  const stats = getTeamStats(team, day, global);
  const oppositions = stats.matchs
    .filter((match) => global || match.day === day)
    .map((match) => {
      const teamB = match.teamA === team ? match.teamB : match.teamA;
      const ratingA = getGlobalTeamStats(team, match.day - 1).rating;
      const ratingB = getGlobalTeamStats(teamB, match.day - 1).rating;
      // console.log(global, rateWinPropability(ratingB, ratingA), team.name, teamB.name);
      return rateWinPropability(ratingB, ratingA);
    });
  const mean = oppositions.reduce((sum, opposition) => sum + opposition, 0) / oppositions.length;
  const variance =
    oppositions.map((opposition) => (opposition - mean) ** 2).reduce((sum, opposition) => sum + opposition, 0) /
    oppositions.length;
  return [mean, Math.sqrt(variance)];
};
