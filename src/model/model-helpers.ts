import { Rating, TrueSkill, rate_1vs1, winProbability } from 'ts-trueskill';

import { getDepartment } from './geography';
import { Competition, Match, Pool, Stats, Team } from './model';
import { Sorting, rankingSorter, ratingSorter } from './model-sorters';
import { SheetMap } from './sheet';

// mu, sigma, beta, tau, drawProbability
// this.mu = mu ?? 25;
// this.sigma = sigma ?? this.mu / 3;
// this.beta = beta ?? this.sigma / 2;
// this.tau = tau ?? this.sigma / 100;
// const mu = 25;
// const sigma = mu / 3;
// const ts = new TrueSkill(mu, sigma, sigma / 2, sigma / 100, 0);
const ts = new TrueSkill(undefined, undefined, undefined, undefined, 0);

export const rateMatch = (ratingWinner: Rating, ratingLoser: Rating): [Rating, Rating] =>
  rate_1vs1(ratingWinner, ratingLoser, undefined, undefined, ts);

export const rateWinPropability = (ratingWinner: Rating, ratingLoser: Rating): number =>
  winProbability([ratingWinner], [ratingLoser], ts);

export const getWinProbability = (teamA: Team, teamB: Team, day: number): number => {
  return day === 1 ? 0.5 : winProbability([getTeamRating(teamA, day - 1)], [getTeamRating(teamB, day - 1)], ts);
};

export const createCompetition = (name: string, season: string, category: string, sheets: SheetMap[]): Competition => {
  const competition = {
    name,
    season,
    category,
    teams: new Map<string, Team>(),
    matchs: [],
    days: [],
    sheets,
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
    dstats: [],
    pools: [],
    sheets: [],
    dayCount: 0,
    lastDay: 0,
  };
  competition.teams.set(id, newTeam);
  return newTeam;
};

export const getGlobalTeamStats = (team: Team, day = team.dayCount): Stats => {
  if (!team.gstats[day]) {
    // console.log(`Creating Global ${day} Team Stats for ${team.name}`);
    const prevStats = getGlobalTeamStats(team, day - 1); // team.gstats[0] is already defined
    team.gstats[day] = { ...prevStats };
  }
  return team.gstats[day];
};

export const getDayTeamStats = (team: Team, day: number): Stats => {
  if (!team.dstats[day]) {
    // console.log(`Creating Day ${day} Team Stats for ${team.name}`);
    team.dstats[day] = createStats(getGlobalTeamStats(team, day).rating);
  }
  return team.dstats[day];
};

export const getTeamStats = (team: Team, day: number, global = true): Stats => {
  return global ? getGlobalTeamStats(team, day) : getDayTeamStats(team, day);
};

export const getTeamRating = (team: Team, day: number): Rating => {
  return team.dstats[day]?.rating ?? getGlobalTeamStats(team, day).rating;
};

export const getTeamRanking = (team: Team, day: number, daily: boolean, qualified: boolean) => {
  return daily ? team.ranking.days[day] : qualified ? team.ranking.qualifieds[day] : team.ranking.globals[day];
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

export const getPoolProbabilities = (competition: Competition, pool: Pool, day: number): number[][] => {
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
  // const orders = [1, 2, 3].sort((a, b) => {
  //   const pa = probabilities[a - 1];
  //   const pb = probabilities[b - 1];
  //   return pa < pb ? -1 : 1;
  // });
  // hack to make sorting works...
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
  return day > competition.lastDay ? 0 : team.ranking.pools[day] ?? 0;
};

export const getFirstCountInPreviousDay = (competition: Competition, team: Team, day: number): number => {
  if (day <= 1) {
    return 0;
  }
  return team.pools[day - 1]?.teams.filter((team) => team.ranking.pools[day] === 1).length;
};

export const getDayDistance = (competition: Competition, team: Team, day: number): string => {
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

export const isTeamInCourse = (competition: Competition, team: Team, day: number): boolean => {
  // console.log(day, team.stats.dayCount, team.name);
  if (day === 1 || team.dayCount >= day) {
    return true;
  }
  if (day > 1) {
    const previousDayRanking = getDayRanking(competition, team, day - 1);
    return previousDayRanking === 1 || previousDayRanking === 2;
  }
  return false;
};

export const getBoard = (
  competition: Competition,
  sorting = Sorting.POINTS,
  day: number,
  daily: boolean, // for sorting
  qualified: boolean, // for filtering
): Team[] => {
  const board = qualified ? competition.days[day]?.teams ?? [] : Array.from(competition.teams.values());
  if (sorting === Sorting.RATING) {
    board.sort(ratingSorter(day, !daily));
  } else {
    board.sort(rankingSorter(day, !daily));
  }

  return board;
};

// returns [mean, standard deviation] of opposition (chance to lose)
export const getTeamOpposition = (
  competition: Competition,
  team: Team,
  day: number = competition.dayCount,
  global = true,
): [number, number] => {
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
