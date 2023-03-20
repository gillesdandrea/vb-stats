import { rate_1vs1, Rating, TrueSkill, winProbability } from 'ts-trueskill';

import { Department, getDepartment } from './geography';

// mu, sigma, beta, tau, drawProbability
// this.mu = mu ?? 25;
// this.sigma = sigma ?? this.mu / 3;
// this.beta = beta ?? this.sigma / 2;
// this.tau = tau ?? this.sigma / 100;
// const mu = 25;
// const sigma = mu / 3;
// const ts = new TrueSkill(mu, sigma, sigma / 2, sigma / 100, 0);
const ts = new TrueSkill(undefined, undefined, undefined, undefined, 0);

// each set updates ts-ranking vs each match
const SET_RANKING = true;

export type CompetitionCollection = Record<string, Record<string, Competition>>;

export interface Competition {
  name: string;
  season: string;
  category: string;
  teams: Map<string, Team>;
  matchs: Match[];
  days: number;
}

export const createCompetition = (name: string, season: string, category: string): Competition => {
  const competition = {
    name,
    season,
    category,
    teams: new Map<string, Team>(),
    matchs: [],
    days: 0,
  };
  return competition;
};

export interface Stats {
  rating: Rating;
  points: number;
  matchCount: number;
  matchWon: number;
  matchLost: number;
  setWon: number;
  setLost: number;
  pointWon: number;
  pointLost: number;
  lastDay: number;
  ratings: Record<number, Rating>;
  rankings: Record<number, number>; // pool rankings per day
}

export interface Team {
  id: string;
  name: string;
  department: Department;
  matchs: Match[];
  stats: Stats;
}

export interface Score {
  scoreA: number;
  scoreB: number;
}

const MEDIUM = 1.25; // 25-20
const HIGH = 2.0; // <25-13

export enum Victory {
  Unplayed = 'Unplayed',
  TieBreak = 'Tie-Break',
  Medium = 'Medium',
  // 25-20
  Large = 'Large',
  // 25-13
  Huge = 'Huge',
}

export interface Match {
  id: string;
  day: number;
  date: string;
  time: string;
  teamA: Team;
  teamB: Team;
  winner?: Team;
  setA: number;
  setB: number;
  totalA: number;
  totalB: number;
  score: Score[];
  ratingA: Rating;
  ratingB: Rating;
  winProbability: number;
  victory: Victory;
}

// const teams = new Map<string, Team>();
// export const matchs: Match[] = [];
// export let days = 0;

export const defineRating = (team: Team, day: number, rating = team.stats.rating) => {
  if (!team.stats.ratings[day]) {
    team.stats.ratings[day] = rating;
  }
};

export const getRating = (team: Team, day: number) => {
  return team.stats.ratings[day]; // ?? team.stats.rating;
};

export const getPool = (competition: Competition, team: Team, day: number): Team[] => {
  const amatch = competition.matchs.find(
    (match: Match) => match.day === day && (match.teamA === team || match.teamB === team),
  );
  if (amatch) {
    const pmatchs: Match[] = competition.matchs.filter(
      (match: Match) =>
        match.day === day &&
        (match.teamA === amatch.teamA ||
          match.teamB === amatch.teamA ||
          match.teamA === amatch.teamB ||
          match.teamB === amatch.teamB),
    );
    if (pmatchs.length === 3) {
      const pool = [
        pmatchs[0].teamA,
        pmatchs[0].teamB,
        pmatchs[1].teamA === pmatchs[0].teamA || pmatchs[1].teamA === pmatchs[0].teamB
          ? pmatchs[1].teamB
          : pmatchs[1].teamA,
      ];
      return pool;
    }
  }

  return [];
};

export const getDayDistance = (competition: Competition, team: Team, day: number): string => {
  const pool = getPool(competition, team, day);
  if (pool.length === 3) {
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

export const getFirstCountInPreviousDay = (competition: Competition, team: Team, day: number) => {
  if (day <= 1) {
    return 0;
  }

  return getPool(competition, team, day)
    .map((team: Team) => getDayRanking(competition, team, day - 1))
    .filter((ranking) => ranking === 1).length;
};

export const getDayRanking = (competition: Competition, team: Team, day: number): number => {
  let ranking = team.stats.rankings[day];
  if (!ranking) {
    ranking = getUncachedDayRanking(competition, team, day);
    team.stats.rankings[day] = ranking;
  }

  return ranking;
};

export const getUncachedDayRanking = (competition: Competition, team1: Team, day: number): number => {
  const dmatchs: Match[] = competition.matchs.filter((match: Match) => match.day === day);
  const tmatchs: Match[] = dmatchs.filter((match: Match) => match.teamA === team1 || match.teamB === team1);
  if (tmatchs.length === 2) {
    const victoryCount = tmatchs.filter((match: Match) => match.winner === team1).length;
    if (victoryCount === 2) {
      return 1;
    }

    if (victoryCount === 0) {
      return 3;
    }

    const team2 = tmatchs[0].teamA === team1 ? tmatchs[0].teamB : tmatchs[0].teamA;
    const team3 = tmatchs[1].teamA === team1 ? tmatchs[1].teamB : tmatchs[1].teamA;
    const lmatchs: Match[] = dmatchs.filter(
      (match: Match) =>
        (match.teamA === team2 && match.teamB === team3) || (match.teamA === team3 && match.teamB === team2),
    );
    if (lmatchs.length === 1) {
      const m = {
        [team1.id]: {
          match: 0,
          set: 0,
          point: 0,
        },
        [team2.id]: {
          match: 0,
          set: 0,
          point: 0,
        },
        [team3.id]: {
          match: 0,
          set: 0,
          point: 0,
        },
      };
      const match3: Match[] = [...tmatchs, ...lmatchs];
      match3.forEach((match: Match) => {
        if (match.winner) {
          m[match.winner.id].match++;
          m[match.teamA.id].set += match.setA - match.setB;
          m[match.teamB.id].set += match.setB - match.setA;
          m[match.teamA.id].point += match.totalA - match.totalB;
          m[match.teamB.id].point += match.totalB - match.totalA;
        }
      });
      const teams: Team[] = [team1, team2, team3];
      teams.sort((teamA: Team, teamB: Team) => {
        const dmatch = m[teamB.id].match - m[teamA.id].match;
        const dset = m[teamB.id].set - m[teamA.id].set;
        const dpoint = m[teamB.id].point - m[teamA.id].point;
        return dmatch === 0 ? (dset === 0 ? dpoint : dset) : dmatch;
      });
      return teams.findIndex((team: Team) => team === team1) + 1;
    }
  }

  return 0;
};

// returns [mean, standard deviation] of opposition (chance to lose)
export const getTeamOpposition = (team: Team): [number, number] => {
  const oppositions = team.matchs.map((match: Match) =>
    match.teamA === team ? 1 - match.winProbability : match.winProbability,
  );
  // team.matchs.forEach((match: Match, index: number) => {
  //   console.log(
  //     oppositions[index].toFixed(3),
  //     match.winProbability.toFixed(3),
  //     match.teamA.name,
  //     match.ratingA.toString(),
  //     match.setA,
  //     '-',
  //     match.setB,
  //     match.ratingB.toString(),
  //     match.teamB.name,
  //   );
  // });
  const mean = oppositions.reduce((sum, opposition) => sum + opposition, 0) / oppositions.length;
  const variance =
    oppositions.map((opposition) => (opposition - mean) ** 2).reduce((sum, opposition) => sum + opposition, 0) /
    oppositions.length;
  return [mean, Math.sqrt(variance)];
};

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
    matchs: [],
    stats: {
      rating,
      points: 0,
      matchCount: 0,
      matchWon: 0,
      matchLost: 0,
      setWon: 0,
      setLost: 0,
      pointWon: 0,
      pointLost: 0,
      lastDay: 0,
      ratings: { 0: rating },
      rankings: { 0: 0 },
    },
  };
  competition.teams.set(id, newTeam);
  return newTeam;
};

enum Sorting {
  POINTS,
  RATING,
}

export const getBoard = (competition: Competition, sorting = Sorting.POINTS, lastDay?: number): Team[] => {
  const board = Array.from(competition.teams.values()).filter((team) => !lastDay || lastDay === team.stats.lastDay);
  if (sorting === Sorting.RATING) {
    // Sorting.RATING
    board.sort((a: Team, b: Team) => {
      if (a.stats.rating.mu === b.stats.rating.mu) {
        return a.name.localeCompare(b.name);
      }

      return a.stats.rating > b.stats.rating ? -1 : 1;
    });
  } else {
    // Sorting.POINTS
    board.sort((a: Team, b: Team) => {
      const apoints = (a.stats.points * 2 * a.stats.lastDay) / a.stats.matchCount;
      const bpoints = (b.stats.points * 2 * b.stats.lastDay) / b.stats.matchCount;
      if (apoints === bpoints) {
        const asratio = a.stats.setLost === 0 ? Number.MAX_SAFE_INTEGER : a.stats.setWon / a.stats.setLost;
        const bsratio = b.stats.setLost === 0 ? Number.MAX_SAFE_INTEGER : b.stats.setWon / b.stats.setLost;
        if (asratio === bsratio) {
          const apratio = a.stats.pointLost === 0 ? Number.MAX_SAFE_INTEGER : a.stats.pointWon / a.stats.pointLost;
          const bpratio = b.stats.pointLost === 0 ? Number.MAX_SAFE_INTEGER : b.stats.pointWon / b.stats.pointLost;
          return bpratio - apratio;
        }

        return bsratio - asratio;
      }

      return bpoints - apoints;
    });
  }

  return board;
};

export const createMatch = (competition: Competition, data: any): Match => {
  const teamA = getTeam(competition, data.EQA_no, data.EQA_nom);
  const teamB = getTeam(competition, data.EQB_no, data.EQB_nom);
  const day = Number(data.Jo);
  defineRating(teamA, day);
  defineRating(teamB, day);
  const [ssetA, ssetB] = data.Set ? data.Set.split('/') : ['0', '0'];
  const setA = ssetA === 'F' ? 0 : Number(ssetA);
  const setB = ssetB === 'F' ? 0 : Number(ssetB);
  const [stotalA, stotalB] = data.Total ? data.Total.split('-') : ['0', '0'];
  const totalA = Number(stotalA);
  const totalB = Number(stotalB);
  const score: Score[] = data.Score
    ? data.Score.split(',').map((set: string) => {
        const [sscoreA, sscoreB] = set ? set.split('-') : ['0', '0'];
        const scoreA = Number(sscoreA);
        const scoreB = Number(sscoreB);
        return { scoreA, scoreB };
      })
    : [];
  const unplayed = score.length === 0;
  const winner = unplayed ? undefined : setA > setB ? teamA : teamB;
  const ratio = unplayed ? 0 : winner === teamA ? totalA / (totalB || 1) : totalB / (totalA || 1);
  const match: Match = {
    id: data.Match,
    day,
    date: data.Date,
    time: data.Heure,
    teamA,
    teamB,
    winner,
    setA,
    setB,
    totalA,
    totalB,
    score,
    ratingA: teamA.stats.rating,
    ratingB: teamB.stats.rating,
    winProbability: winProbability([getRating(teamA, day)], [getRating(teamB, day)], ts),
    victory: unplayed
      ? Victory.Unplayed
      : Math.abs(setA - setB) < 2
      ? Victory.TieBreak
      : ratio <= MEDIUM
      ? Victory.Medium
      : ratio <= HIGH
      ? Victory.Large
      : Victory.Huge,
  };
  return match;
};

export const addMatch = (competition: Competition, match: Match) => {
  const { teamA, teamB, winner, setA, setB, day } = match;
  if (winner && competition.days < day) {
    competition.days = day;
  }

  competition.matchs.push(match);
  teamA.matchs.push(match);
  teamB.matchs.push(match);
  if (!winner) {
    return;
  }

  const statsA = teamA.stats;
  const statsB = teamB.stats;
  statsA.matchCount++;
  statsB.matchCount++;
  if (winner === teamA) {
    statsA.matchWon++;
    statsB.matchLost++;
    if (Math.abs(match.setA - match.setB) === 1) {
      statsA.points += 2;
      statsB.points += 1;
    } else {
      statsA.points += 3;
    }
  } else {
    statsA.matchLost++;
    statsB.matchWon++;
    if (Math.abs(match.setA - match.setB) === 1) {
      statsB.points += 2;
      statsA.points += 1;
    } else {
      statsB.points += 3;
    }
  }

  statsA.setWon += match.setA;
  statsB.setWon += match.setB;
  statsA.setLost += match.setB;
  statsB.setLost += match.setA;
  statsA.pointWon += match.totalA;
  statsB.pointWon += match.totalB;
  statsA.pointLost += match.totalB;
  statsB.pointLost += match.totalA;
  statsA.lastDay = match.day;
  statsB.lastDay = match.day;

  // update rating
  if (SET_RANKING) {
    match.score.forEach((set) => {
      if (set.scoreA > set.scoreB) {
        const [newAR, newBR] = rate_1vs1(statsA.rating, statsB.rating, undefined, undefined, ts);
        statsA.rating = newAR;
        statsB.rating = newBR;
      } else {
        const [newBR, newAR] = rate_1vs1(statsB.rating, statsA.rating, undefined, undefined, ts);
        statsA.rating = newAR;
        statsB.rating = newBR;
      }
    });
  } else {
    // eslint-disable-next-line no-lonely-if
    if (match.winner === teamA) {
      const [newAR, newBR] = rate_1vs1(statsA.rating, statsB.rating, undefined, undefined, ts);
      statsA.rating = newAR;
      statsB.rating = newBR;
    } else {
      const [newBR, newAR] = rate_1vs1(statsB.rating, statsA.rating, undefined, undefined, ts);
      statsA.rating = newAR;
      statsB.rating = newBR;
    }
  }
};
