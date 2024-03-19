import type { Rating } from 'ts-trueskill';

import { Department } from './geography';

// each set updates ts-ranking vs each match
export const SET_RANKING = true;

// export const seasons = [2024];
// export const categories = ['M15M'];
export const seasons = [2024, 2023, 2022];
export const categories = ['M13M', 'M15M', 'M18M', 'M21M', 'M13F', 'M15F', 'M18F', 'M21F'];
export const getResourceName = (season: number, category: string) => `FFVB-${season}-CDF-${category}.CSV`;

export const defaultSeason = 2024;
export const defaultCategory = 'M15M';
export const seasonToString = (season: number) => `${season - 1}/${season}`;
export const seasonToNumber = (season: string) => Number.parseInt(season.substring(5));

export interface Competition {
  readonly name: string;
  readonly season: string;
  readonly category: string;
  readonly teams: Map<string, Team>;
  readonly matchs: Match[];
  readonly days: CompetitionDay[];
  dayCount: number;
  lastDay: number; // last played day
}

export interface Pool {
  readonly name: string;
  readonly teams: Team[];
  readonly matchs: Match[];
  ranking?: number;
}

export interface CompetitionDay {
  readonly day: number;
  readonly teams: Team[];
  readonly matchs: Match[];
  readonly pools: Map<string, Pool>;
}

export interface Ranking {
  globals: number[];
  qualifieds: number[]; // global ranking of teams still in course
  days: number[];
  pools: number[]; // 1, 2, 3
}

export interface Team {
  readonly id: string;
  readonly name: string;
  readonly department: Department;
  readonly ranking: Ranking;
  readonly gstats: Stats[];
  readonly dstats: Stats[];
  readonly pools: Pool[];
  dayCount: number;
  lastDay: number; // last played day
}

export interface Stats {
  rating: Rating; // rating after the stats period
  difficulty: [mean: number, stdev: number]; // based on matchs difficulty of the stats period
  points: number;
  matchCount: number;
  matchWon: number;
  matchLost: number;
  setWon: number;
  setLost: number;
  pointWon: number;
  pointLost: number;
  matchs: Match[];
}

export interface Score {
  readonly scoreA: number;
  readonly scoreB: number;
}

export const MEDIUM = 1.25; // 25-20
export const HIGH = 2.0; // <25-13

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
  readonly id: string;
  readonly day: number;
  readonly date: string;
  readonly time: string;
  readonly teamA: Team;
  readonly teamB: Team;
  readonly winner?: Team;
  readonly setA: number;
  readonly setB: number;
  readonly totalA: number;
  readonly totalB: number;
  readonly score: Score[];
  readonly ratingA: Rating; // before match
  readonly ratingB: Rating; // before match
  readonly winProbability: number;
  readonly predicted?: boolean;
  readonly victory: Victory;
}
