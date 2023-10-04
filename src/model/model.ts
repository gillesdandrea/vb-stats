import { Rating } from 'ts-trueskill';

import { Department } from './geography';
import { CSheetMatch, SheetMap, SheetMatch } from './sheet';

// each set updates ts-ranking vs each match
export const SET_RANKING = true;

export type CompetitionCollection = Record<string, Record<string, Competition>>;
export type SheetCollection = Record<string, Record<string, SheetMap[]>>;

export interface Competition {
  readonly name: string;
  readonly season: string;
  readonly category: string;
  readonly teams: Map<string, Team>;
  readonly matchs: Match[];
  readonly days: CompetitionDay[];
  readonly sheets?: SheetMap[];
  dayCount: number;
  lastDay: number; // last played day
}

export interface Pool {
  readonly name: string;
  readonly teams: Team[];
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
  readonly sheets: Sheet[];
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
  readonly victory: Victory;
}
export interface Sheet {
  isA: boolean;
  match: Match;
  smatch: SheetMatch;
  csmatch: CSheetMatch;
}
