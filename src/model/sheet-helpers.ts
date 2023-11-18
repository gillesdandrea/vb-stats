import { Match, Sheet, Team } from './model';
import {
  CSheetLicence,
  CSStats,
  CSheetMatch,
  CSheetPoint,
  CSheetSet,
  CSheetStat,
  Licenced,
  Position,
  SheetMatch,
  SheetTeam,
  Roles,
} from './sheet';

const getDeltaPoints = (points: number[], idx: number) =>
  idx === 0 ? Math.max(0, points[0]) : points[idx] - Math.max(0, points[idx - 1]);

const getPlayers = (licenceds: Map<string, Licenced>, positions: Position[], scoreA: number, scoreB: number) => {
  const licences = positions.map((position) => {
    if (position.substitute) {
      const [scoreInA, scoreInB] = position.scoreIn?.split(':').map((score) => Number.parseInt(score)) || [];
      const [scoreOutA, scoreOutB] = position.scoreOut?.split(':').map((score) => Number.parseInt(score)) || [];
      if (
        scoreA >= scoreInA &&
        scoreB >= scoreInB &&
        (scoreOutA === undefined || scoreOutB === undefined || (scoreA < scoreOutA && scoreB < scoreOutB))
      ) {
        return position.substitute;
      }
    }
    return position.player;
  });
  return licences.map((licence) => licenceds.get(licence)) as Licenced[];
};

const getLicencedPosition = (position: Position, steam: SheetTeam, smatch: SheetMatch): Position => {
  const licence = steam.players.find((player) => player.number === position.player)?.licence;
  if (licence) {
    const substitute =
      position.substitute && steam.players.find((player) => player.number === position.substitute)?.licence;
    return {
      player: licence,
      substitute,
      scoreIn: position.scoreIn,
      scoreOut: position.scoreOut,
    };
  } else {
    throw new Error(`Can't find ${position.player} in match ${smatch.match}`);
  }
};

const createCSPoint = (
  delta: number,
  serve: boolean,
  players: Licenced[],
  rotation: number,
  isA: boolean,
  is1: boolean,
  score1: number,
  score2: number,
): CSheetPoint => {
  const cspoint: CSheetPoint = {
    scoreA: isA ? (is1 ? score1 : score2) : is1 ? score2 : score1,
    scoreB: isA ? (is1 ? score2 : score1) : is1 ? score1 : score2,
    count: delta > 0 ? 1 : -1,
    serve,
    rotation,
    players,
    // players: serve ? [players[rotation % 6]] : [],
    licences: new Set(),
  };
  players.forEach((player) => cspoint.licences.add(player.licence));
  return cspoint;
};

export const createSheet = (team: Team, match: Match, smatch: SheetMatch): Sheet => {
  // console.log(match.id);
  // console.log(sheetMatch.teamA);
  // console.log(sheetMatch.teamB);

  const isA = smatch.teamA.name === team.name;
  const csmatch: CSheetMatch = {
    isA,
    count: !match.winner ? 0 : match.winner === team ? +1 : -1,
    sets: [],
    licences: new Set(),
  };
  if (!isA && smatch.teamB.name !== team.name) {
    throw new Error(`Mismatch for team ${team.name} in match ${smatch.match}`);
  }
  const steam = isA ? smatch.teamA : smatch.teamB;
  const licenceds = new Map<string, Licenced>();
  steam.players.forEach((licenced) => licenceds.set(licenced.licence, licenced));

  let setA = 0;
  let setB = 0;
  smatch.sets.forEach((sset, index) => {
    // console.log(index, sset);
    const pointA = sset.pointsA[sset.pointsA.length - 1];
    const pointB = sset.pointsB[sset.pointsB.length - 1];
    const won = (isA && pointA > pointB) || (!isA && pointA < pointB);
    // setA += pointA > pointB ? 1 : 0;
    // setB += pointA < pointB ? 1 : 0;

    // set
    const { pointsA, pointsB } = sset;
    const iserve = isA ? pointsA[0] >= 0 : pointsB[0] >= 0;
    const csset: CSheetSet = {
      setA,
      setB,
      count: won ? 1 : -1,
      serve: iserve,
      rotations: 0,
      points: [],
      licences: new Set(),
    };
    setA += pointA > pointB ? 1 : 0;
    setB += pointA < pointB ? 1 : 0;
    const positions: Position[] = (isA ? sset.positionA : sset.positionB).map((position) =>
      getLicencedPosition(position, steam, smatch),
    );
    positions.forEach((position) => {
      csmatch.licences.add(position.player);
      position.substitute && csmatch.licences.add(position.substitute);
      csset.licences.add(position.player);
      position.substitute && csset.licences.add(position.substitute);
    });

    // points
    const is1 = pointsA[0] < 0 ? !isA : isA;
    const points1 = pointsA[0] < 0 ? pointsB : pointsA;
    const points2 = pointsA[0] < 0 ? pointsA : pointsB;
    let idx1 = 0;
    let idx2 = 0;
    let score1 = 0;
    let score2 = 0;
    let serving = iserve;
    let rotation = 0;
    while (idx1 < points1.length && idx2 < points2.length) {
      const points = getDeltaPoints(points1, idx1);
      const delta = is1 ? points : -points;
      for (let i = 0; i < points; i++) {
        const players = is1
          ? getPlayers(licenceds, positions, score1, score2)
          : getPlayers(licenceds, positions, score2, score1);
        const cspoint = createCSPoint(delta, serving, players, rotation, isA, is1, score1, score2);
        score1++;
        if (idx1 > 0 && i === 0) {
          serving = !serving;
          if (serving) {
            rotation++;
          }
        }
        // const cspoint = createCSPoint(delta, serving, players, rotation, isA, is1, score1, score2);
        csset.points.push(cspoint);
      }
      // console.log(`* ${points1[idx1]}:${Math.max(0, points2[idx2])}   (${delta})`);
      idx2++;

      if (idx2 < points2.length) {
        const points = getDeltaPoints(points2, idx2);
        const delta = is1 ? -points : points;
        for (let i = 0; i < points; i++) {
          const players = is1
            ? getPlayers(licenceds, positions, score1, score2)
            : getPlayers(licenceds, positions, score2, score1);
          const cspoint = createCSPoint(delta, serving, players, rotation, isA, is1, score1, score2);
          score2++;
          if (i === 0) {
            serving = !serving;
            if (serving) {
              rotation++;
            }
          }
          // const cspoint = createCSPoint(delta, serving, players, rotation, isA, is1, score1, score2);
          csset.points.push(cspoint);
        }
        // console.log(`  ${points1[idx1]}:${points2[idx2]} * (${delta})`);
        idx1++;
      }
    }
    csset.rotations = rotation;
    // assert
    const score = match.score[csmatch.sets.length];
    assert((isA ? pointA : pointB) === (team === match.teamA ? score.scoreA : score.scoreB));
    assert((isA ? pointB : pointA) === (team === match.teamA ? score.scoreB : score.scoreA));
    assert(csset.points.length === score.scoreA + score.scoreB);
    //
    csmatch.sets.push(csset);
    //
  });
  assert((isA ? setA : setB) === (team === match.teamA ? match.setA : match.setB));
  assert((isA ? setB : setA) === (team === match.teamA ? match.setB : match.setA));
  const sheet: Sheet = {
    id: smatch.match,
    isA: team === match.teamA,
    steam,
    smatch: smatch,
    csmatch,
  };
  return sheet;
};

const checkLicence = (licences: CSheetLicence, whitelic: string[] = [], blacklic: string[] = []): boolean => {
  const condition = (licence: string) => licences.licences.has(licence);
  return (blacklic.length === 0 || !blacklic.some(condition)) && (whitelic.length === 0 || whitelic.every(condition));
};

export const getSetter = (setters: string[], cspoint: CSheetPoint): string | undefined =>
  setters.find((setter) => cspoint.players.find((player) => player.licence === setter));

//

export type MatchSetAcceptor = (sheet: Sheet, csmatch: CSheetMatch, csset: CSheetSet) => boolean;

export const notMatch =
  (acceptor: MatchSetAcceptor): MatchSetAcceptor =>
  (sheet, csmatch, csset) =>
    !acceptor(sheet, csmatch, csset);

export const acceptMatchWon =
  (won = true) =>
  (sheet: Sheet, csmatch: CSheetMatch, csset: CSheetSet): boolean => {
    return won ? csmatch.count > 0 : csmatch.count < 0;
  };

export const acceptMatchs =
  (matchids: string[]) =>
  (sheet: Sheet, csmatch: CSheetMatch, csset: CSheetSet): boolean => {
    return matchids.some((matchid) => matchid.toLowerCase() === sheet.id.toLowerCase());
  };

export const acceptSetWon =
  (won = true) =>
  (sheet: Sheet, csmatch: CSheetMatch, csset: CSheetSet): boolean => {
    return won ? csset.count > 0 : csset.count < 0;
  };

export const filterMatchSetSheets = (sheets: Sheet[], accept: MatchSetAcceptor): Sheet[] => {
  // TODO is using reduce will be more readable than map+filter?
  const usheets: (Sheet | undefined)[] = sheets;
  return usheets.map((sheet) => filterMatchSetSheet(sheet as Sheet, accept)).filter(Boolean) as Sheet[];
};

export const filterMatchSetSheet = (sheet: Sheet, accept: MatchSetAcceptor): Sheet | undefined => {
  const { isA, steam, smatch, csmatch } = sheet;
  const sets = csmatch.sets.filter((set) => accept(sheet, csmatch, set));
  if (sets.length > 0) {
    const fcsm: CSheetMatch = {
      isA,
      count: csmatch.count,
      sets,
      licences: csmatch.licences,
    };
    return {
      id: smatch.match,
      isA,
      steam,
      smatch,
      csmatch: fcsm,
    };
  }
  return undefined;
};

//

export type PointAcceptor = (sheet: Sheet, csmatch: CSheetMatch, csset: CSheetSet, cspoint: CSheetPoint) => boolean;

export const notPoint =
  (acceptor: PointAcceptor): PointAcceptor =>
  (sheet, csmatch, csset, cspoint) =>
    !acceptor(sheet, csmatch, csset, cspoint);

export const acceptEveryPoint =
  (acceptors: PointAcceptor[]): PointAcceptor =>
  (sheet, csmatch, csset, cspoint) =>
    acceptors.every((acceptor) => acceptor(sheet, csmatch, csset, cspoint));

export const acceptSomePoint =
  (acceptors: PointAcceptor[]): PointAcceptor =>
  (sheet, csmatch, csset, cspoint) =>
    acceptors.some((acceptor) => acceptor(sheet, csmatch, csset, cspoint));

/** position starts 1 */
export const acceptPosition =
  (licence: string, position: number): PointAcceptor =>
  (sheet, csmatch, csset, cspoint) => {
    const index = cspoint.players.findIndex((player) => player.licence === licence);
    return index === (position - 1 + cspoint.rotation) % 6;
  };

export const acceptRole =
  (licence: string, role: Roles, setters: string[]): PointAcceptor =>
  (sheet, csmatch, csset, cspoint) => {
    const setter = getSetter(setters, cspoint);
    if (setter) {
      const setidx = cspoint.players.findIndex((player) => player.licence === setter);
      const licidx = cspoint.players.findIndex((player) => player.licence === licence);
      if (licidx >= 0) {
        return role === (6 + licidx - setidx) % 6;
      }
    }
    return false;
  };

export const acceptSetter =
  (setter: string, setters: string[]): PointAcceptor =>
  (sheet, csmatch, csset, cspoint) => {
    const psetter = getSetter(setters, cspoint);
    return psetter === setter;
  };

export const acceptSetterPosition =
  (setters: string[], position: number, setter?: string): PointAcceptor =>
  (sheet, csmatch, csset, cspoint) => {
    const psetter = getSetter(setters, cspoint);
    if (psetter && (setter === undefined || psetter)) {
      const index = cspoint.players.findIndex((player) => player.licence === psetter);
      return index === (position + cspoint.rotation) % 6;
    }
    return false;
  };

export const acceptLicences =
  (whitelic: string[] = [], blacklic: string[] = []): PointAcceptor =>
  (sheet, csmatch, csset, cspoint) =>
    checkLicence(cspoint, whitelic, blacklic);

export const acceptServe =
  (serve = true): PointAcceptor =>
  (sheet, csmatch, csset, cspoint) =>
    cspoint.serve === serve;

export const filterPointSheets = (sheets: Sheet[], accept: PointAcceptor): Sheet[] => {
  // TODO is using reduce will be more readable than map+filter?
  const usheets: (Sheet | undefined)[] = sheets;
  return usheets.map((sheet) => filterPointSheet(sheet as Sheet, accept)).filter(Boolean) as Sheet[];
};

export const filterPointSheet = (sheet: Sheet, accept: PointAcceptor): Sheet | undefined => {
  const { isA, steam, smatch, csmatch } = sheet;
  const fcsm: CSheetMatch = {
    isA,
    count: csmatch.count,
    sets: [],
    licences: csmatch.licences,
  };
  csmatch.sets.forEach((set: CSheetSet) => {
    const points = set.points.filter((point) => accept(sheet, csmatch, set, point));
    if (points.length > 0) {
      const { setA, setB, count, serve, rotations, licences } = set;
      const fset: CSheetSet = {
        setA,
        setB,
        count,
        serve,
        rotations,
        points,
        licences,
      };
      fcsm.sets.push(fset);
    }
  });
  return fcsm.sets.length > 0
    ? {
        id: smatch.match,
        isA,
        steam,
        smatch,
        csmatch: fcsm,
      }
    : undefined;
};

const assert = (value: boolean) => {
  if (!value) {
    throw new Error('assert failed');
  }
};

export const calcCSStats = (setters: string[], sheets: Sheet[], csstats = createCSStats()): CSStats => {
  sumCSheetStats(sheets, csstats.total);
  const servesheets = filterPointSheets(sheets, acceptServe());
  sumCSheetStats(servesheets, csstats.serve);
  const receivesheets = filterPointSheets(sheets, acceptServe(false));
  sumCSheetStats(receivesheets, csstats.receive);
  assert(csstats.total.points === csstats.serve.points + csstats.receive.points);

  let ssum = 0;
  csstats.pserves.forEach((css, index) => {
    const psheets = filterPointSheets(servesheets, acceptSetterPosition(setters, index));
    sumCSheetStats(psheets, css);
    ssum += css.points;
  });
  assert(ssum === csstats.serve.points);

  let rsum = 0;
  csstats.preceives.forEach((css, index) => {
    const psheets = filterPointSheets(receivesheets, acceptSetterPosition(setters, index));
    sumCSheetStats(psheets, css);
    rsum += css.points;
  });
  assert(rsum === csstats.receive.points);

  return csstats;
};

export const createCSStats = (): CSStats => ({
  total: createCSheetStat(),
  serve: createCSheetStat(),
  receive: createCSheetStat(),
  pserves: [
    createCSheetStat(),
    createCSheetStat(),
    createCSheetStat(),
    createCSheetStat(),
    createCSheetStat(),
    createCSheetStat(),
  ],
  preceives: [
    createCSheetStat(),
    createCSheetStat(),
    createCSheetStat(),
    createCSheetStat(),
    createCSheetStat(),
    createCSheetStat(),
  ],
});

export const sumCSheetStats = (sheets: Sheet[], stat: CSheetStat = createCSheetStat()): CSheetStat => {
  sheets.forEach((sheet) => sumCSheetStat(sheet, stat));
  return stat;
};

export const sumCSheetStat = (sheet: Sheet, stat: CSheetStat): CSheetStat => {
  const { csmatch } = sheet;
  stat.matchs++;
  stat.matchWon += csmatch.count > 0 ? +1 : 0;
  stat.matchLost += csmatch.count < 0 ? +1 : 0;
  csmatch.sets.forEach((set) => {
    stat.sets++;
    stat.setWon += set.count > 0 ? +1 : 0;
    stat.setLost += set.count < 0 ? +1 : 0;
    set.points.forEach((point, index) => {
      stat.points++;
      if (point.serve) {
        stat.serves++;
      }
      stat.pointWon += point.count > 0 ? point.count : 0;
      stat.pointLost += point.count < 0 ? -point.count : 0;
      stat.serveWon += point.serve ? (point.count > 0 ? point.count : 0) : 0;
      stat.serveLost += point.serve ? (point.count < 0 ? -point.count : 0) : 0;
    });
  });
  return stat;
};

export const createCSheetStat = (): CSheetStat => ({
  matchs: 0,
  matchWon: 0,
  matchLost: 0,
  sets: 0,
  setWon: 0,
  setLost: 0,
  points: 0,
  pointWon: 0,
  pointLost: 0,
  serves: 0,
  serveWon: 0,
  serveLost: 0,
  positionWons: [0, 0, 0, 0, 0, 0, 0],
  positionLosts: [0, 0, 0, 0, 0, 0, 0],
});

//

/** @deprecated */
export const addCSheetStat = (
  stat: CSheetStat,
  sheet: Sheet,
  whitelic: string[] = [],
  blacklic: string[] = [],
  accept: (csmatch: CSheetMatch, set: CSheetSet, point: CSheetPoint) => boolean = () => true,
): CSheetStat => {
  const check = (licences: CSheetLicence) => checkLicence(licences, whitelic, blacklic);

  const { csmatch } = sheet;
  stat.matchs++;
  if (check(csmatch)) {
    stat.matchWon += csmatch.count > 0 ? +1 : 0;
    stat.matchLost += csmatch.count < 0 ? +1 : 0;
  }
  csmatch.sets.forEach((set) => {
    stat.sets++;
    if (check(set)) {
      stat.setWon += set.count > 0 ? +1 : 0;
      stat.setLost += set.count < 0 ? +1 : 0;
    }
    set.points.forEach((point, index) => {
      stat.points++;
      if (point.serve) {
        stat.serves++;
      }

      if (check(point) && accept(csmatch, set, point)) {
        stat.pointWon += point.count > 0 ? point.count : 0;
        stat.pointLost += point.count < 0 ? -point.count : 0;
        if (whitelic.length === 0) {
          // we count all serve when there is no white list
          stat.serveWon += point.serve ? (point.count > 0 ? point.count : 0) : 0;
          stat.serveLost += point.serve ? (point.count < 0 ? -point.count : 0) : 0;
        } else {
          const positions = [point.players.findIndex((player) => player.licence === whitelic[0])]; // better to use only first player
          // const positions = whitelic.map((licence) => point.players.findIndex((player) => player.licence === licence));
          positions.forEach((position) => {
            const index = (position + point.rotation) % 6;
            if (point.serve && index === 0) {
              stat.serveWon += point.serve ? (point.count > 0 ? point.count : 0) : 0;
              stat.serveLost += point.serve ? (point.count < 0 ? -point.count : 0) : 0;
            }
            if (point.count > 0) {
              stat.positionWons[index + 1] += point.count;
            } else {
              stat.positionLosts[index + 1] -= point.count;
            }
          });
        }
      }
    });
  });
  return stat;
};

/** @deprecated */
export const getSheetsStats = (
  sheets: Sheet[],
  whitelic: string[] = [],
  blacklic: string[] = [],
  accept: (csmatch: CSheetMatch, set: CSheetSet, point: CSheetPoint) => boolean = () => true,
): CSheetStat => {
  const stat = createCSheetStat();
  sheets.forEach((sheet) => {
    addCSheetStat(stat, sheet, whitelic, blacklic, accept);
  });
  return stat;
};
