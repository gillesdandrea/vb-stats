// team.id -> Sheet
export type TeamSheetsMap = Record<string, Sheet[]>;

export interface Sheet {
  id: string;
  isA: boolean;
  steam: SheetTeam;
  smatch: SheetMatch;
  csmatch: CSheetMatch;
}

//

export enum Roles {
  SET = 0, // setter
  OH1 = 1, // outside hitter
  MB1 = 2, // middle blocker
  OPP = 3, // opposite
  OH2 = 4, // outside hitter
  MB2 = 5, // middle blocker
}

export interface CSheetLicence {
  licences: Set<string>;
}

export interface CSheetMatch extends CSheetLicence {
  isA: boolean;
  count: number;
  sets: CSheetSet[];
}

export interface CSheetSet extends CSheetLicence {
  setA: number;
  setB: number;
  count: number;
  serve: boolean; // initial service
  rotations: number;
  points: CSheetPoint[];
}

export interface CSheetPoint extends CSheetLicence {
  scoreA: number;
  scoreB: number;
  count: number;
  serve: boolean;
  rotation: number;
  players: Licenced[];
}

export interface CSheetStat {
  matchs: number;
  matchWon: number;
  matchLost: number;
  sets: number;
  setWon: number;
  setLost: number;
  points: number;
  pointWon: number;
  pointLost: number;
  serves: number;
  serveWon: number;
  serveLost: number;
  positionWons: number[]; // count for each position, 0 is for libero
  positionLosts: number[];
}

export interface CSStats {
  total: CSheetStat;
  serve: CSheetStat;
  receive: CSheetStat;
  pserves: CSheetStat[];
  preceives: CSheetStat[];
}

//

// export type SheetMap = Record<string, SheetMatch>;

export interface SheetMatch {
  url?: string;
  match: string;
  day: string;
  description: string;
  date: string;
  teamA: SheetTeam;
  teamB: SheetTeam;
  approbation: {
    first: Referee;
    second: Referee;
    marker: Referee;
    assistant?: Referee;
    local?: Referee;
  };
  sets: SheetSet[];
}

export interface SheetTeam {
  name: string;
  players: Licenced[];
  liberos: Licenced[];
  officials: Licenced[];
}

export interface Licenced {
  number: string;
  name: string;
  licence: string;
}

export interface Referee {
  name: string;
  licence: string;
  league: string;
}

export interface SheetSet {
  positionA: Position[];
  positionB: Position[];
  pointsA: number[];
  pointsB: number[];
}

export interface Position {
  player: string;
  substitute?: string;
  scoreIn?: string;
  scoreOut?: string;
}
