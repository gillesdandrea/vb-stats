import {
  Competition,
  CompetitionDay,
  HIGH,
  MEDIUM,
  Match,
  Pool,
  SET_RANKING,
  Score,
  Stats,
  Team,
  Victory,
} from './model';
import {
  getDayTeamStats,
  getGlobalTeamStats,
  getTeam,
  getTeamMatch,
  getTeamRating,
  getWinProbability,
  isTeamInCourse,
  rateMatch,
} from './model-helpers';
import { rankingSorter } from './model-sorters';
import { createSheet } from './sheet-helpers';

export const createMatch = (competition: Competition, data: any): Match => {
  const teamA = getTeam(competition, data.EQA_no, data.EQA_nom);
  const teamB = getTeam(competition, data.EQB_no, data.EQB_nom);
  const day = Number(data.Jo);
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
  const winProbability = getWinProbability(teamA, teamB, day);
  const predicted =
    !winner || winProbability === 0.5
      ? undefined
      : (winner === teamA && winProbability > 0.5) || (winner === teamB && winProbability < 0.5);
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
    ratingA: getTeamRating(teamA, day),
    ratingB: getTeamRating(teamB, day),
    winProbability,
    predicted,
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

export const updateRating = (match: Match, statsA: Stats, statsB: Stats) => {
  // update rating
  if (SET_RANKING) {
    match.score.forEach((set) => {
      const deltaScore = Math.abs(set.scoreA - set.scoreB);
      if (set.scoreA > set.scoreB) {
        const [newAR, newBR] = rateMatch(statsA.rating, statsB.rating, deltaScore <= 2);
        statsA.rating = newAR;
        statsB.rating = newBR;
      } else {
        const [newBR, newAR] = rateMatch(statsB.rating, statsA.rating, deltaScore <= 2);
        statsA.rating = newAR;
        statsB.rating = newBR;
      }
    });
  } else {
    // eslint-disable-next-line no-lonely-if
    if (match.winner === match.teamA) {
      const [newAR, newBR] = rateMatch(statsA.rating, statsB.rating);
      statsA.rating = newAR;
      statsB.rating = newBR;
    } else {
      const [newBR, newAR] = rateMatch(statsB.rating, statsA.rating);
      statsA.rating = newAR;
      statsB.rating = newBR;
    }
  }
};

export const addTeamMatch = (team: Team, stats: Stats, match: Match) => {
  stats.matchs = [...stats.matchs, match];
  if (match.winner) {
    const tmatch = getTeamMatch(team, match);
    stats.matchCount++;
    stats.setWon += tmatch.setA;
    stats.setLost += tmatch.setB;
    tmatch.score.forEach((score: Score) => {
      stats.pointWon += score.scoreA;
      stats.pointLost += score.scoreB;
    });
    if (tmatch.winner === team) {
      stats.points += tmatch.setA - tmatch.setB > 1 ? 3 : 2;
      stats.matchWon++;
    } else {
      stats.points += tmatch.setB - tmatch.setA === 1 ? 1 : 0;
      stats.matchLost++;
    }
  }
};

export const addCompetitionMatch = (competition: Competition, match: Match) => {
  const { teamA, teamB, winner, day } = match;

  const lastDay = winner ? day : day - 1; // because some teams may skip a tour
  if (competition.lastDay < lastDay) {
    competition.lastDay = lastDay;
  }
  if (match.teamA.lastDay < lastDay) {
    match.teamA.lastDay = lastDay;
  }
  if (match.teamB.lastDay < lastDay) {
    match.teamB.lastDay = lastDay;
  }

  if (competition.sheets) {
    const sheetMatch = competition.sheets[match.day - 1]?.[match.id];
    if (sheetMatch) {
      const sheetA = createSheet(teamA, match, sheetMatch);
      teamA.sheets.push(sheetA);
      const sheetB = createSheet(teamB, match, sheetMatch);
      teamB.sheets.push(sheetB);
    }
  }

  competition.matchs.push(match); // = [...competition.matchs, match];
  competition.days[day].matchs.push(match); // idem
  // dstats and gstats are already inited
  addTeamMatch(teamA, teamA.dstats[day], match);
  addTeamMatch(teamA, teamA.gstats[day], match);
  addTeamMatch(teamB, teamB.dstats[day], match);
  addTeamMatch(teamB, teamB.gstats[day], match);

  updateRating(match, teamA.dstats[day], teamB.dstats[day]);
  updateRating(match, teamA.gstats[day], teamB.gstats[day]);
};

export const processCompetition = (competition: Competition, datas: any[][]) => {
  // @ts-ignore
  const isCDF = datas.length > 0 && datas[0][0]['Entit�'] === 'ACJEUNES';

  // reorder matchs based on results of the first matchs
  if (isCDF) {
    datas
      .filter((data: any) => data)
      .forEach((data: any[]) => {
        const poolCount = data.length / 3;
        for (let i = 0; i < poolCount; i++) {
          const m1 = data[3 * i];
          const m2 = data[3 * i + 1];
          const m3 = data[3 * i + 2];
          const [ssetA, ssetB] = m1.Set ? m1.Set.split('/') : ['0', '0'];
          const setA = ssetA === 'F' ? 0 : Number(ssetA);
          const setB = ssetB === 'F' ? 0 : Number(ssetB);
          const winner = setA > setB ? m1.EQA_no : m1.EQB_no;
          if (winner !== m2.EQA_no && winner !== m2.EQB_no) {
            data[3 * i + 1] = m3;
            data[3 * i + 2] = m2;
          }
        }
      });
  }

  datas
    .filter((data) => data)
    .map((data: any[]) => {
      // split multiple days in different arrays to support multiple days file
      const split: any[][] = [];
      data.forEach((match: any) => {
        const day = Number(match.Jo);
        if (!split[day]) {
          split[day] = data.filter((dayMatch: any) => dayMatch.Jo === match.Jo);
        }
      });
      return split;
      // return [data];
    })
    .forEach((daydata: any[][]) => {
      daydata.forEach((data: any[]) => {
        // add new day
        const day = Number(data[0].Jo);
        const dayCompetition: CompetitionDay = {
          day,
          teams: [],
          matchs: [],
          pools: new Map(),
        };
        competition.dayCount = day;
        competition.days[day] = dayCompetition;
        // lastDays are updated when adding a played match

        // process day
        if (!isCDF) {
          data.forEach((match: any) => {
            const teamA = getTeam(competition, match.EQA_no, match.EQA_nom);
            const teamB = getTeam(competition, match.EQB_no, match.EQB_nom);
            [teamA, teamB].forEach((team: Team) => {
              dayCompetition.teams.push(team);
              team.dayCount = day;
              // enforce stats creation
              getGlobalTeamStats(team, day);
              getDayTeamStats(team, day);
            });
          });
        } else {
          const teams: Set<Team> = new Set();
          Array.from(competition.teams.values())
            .filter((team) => isTeamInCourse(competition, team, day))
            .forEach((team) => {
              // capture all teams even if exempt of a tour
              teams.add(team);
              team.dayCount = day;
            });

          const poolCount = data.length / 3;
          for (let i = 0; i < poolCount; i++) {
            const m1 = data[3 * i];
            const m2 = data[3 * i + 1];
            // const m3 = data[3 * i + 2];

            // find pool;
            const teamA = getTeam(competition, m1.EQA_no, m1.EQA_nom);
            const teamB = getTeam(competition, m1.EQB_no, m1.EQB_nom);
            const teamC =
              m2.EQA_no === m1.EQA_no || m2.EQA_no === m1.EQB_no
                ? getTeam(competition, m2.EQB_no, m2.EQB_nom)
                : getTeam(competition, m2.EQA_no, m2.EQA_nom);
            const poolName = m1.Match.substring(1, 3);
            let pool: Pool | undefined = dayCompetition.pools.get(poolName);
            if (!pool) {
              pool = {
                name: poolName,
                teams: [teamA, teamB, teamC],
                matchs: [],
              };
              dayCompetition.pools.set(pool.name, pool);
            }
            [teamA, teamB, teamC].forEach((team: Team) => {
              teams.add(team);
              team.dayCount = day;
              team.pools[day] = pool as Pool;
              // enforce stats creation
              getGlobalTeamStats(team, day);
              getDayTeamStats(team, day);
            });
          }
          dayCompetition.teams.push(...Array.from(teams.values()));
        }

        // process matchs
        data.forEach((line: any) => {
          const match = createMatch(competition, line);
          if (isCDF) {
            match.teamA.pools[day].matchs.push(match);
          }
          addCompetitionMatch(competition, match);
        });

        // compute ranking
        const teams = Array.from(competition.teams.values());
        teams.sort(rankingSorter(day, true));
        teams.forEach((team, index) => {
          team.ranking.globals[day] = index + 1;
        });
        const dteams = [...competition.days[day].teams];
        dteams.sort(rankingSorter(day, false));
        dteams.forEach((team, index) => {
          team.ranking.days[day] = index + 1;
        });
        const running = [...competition.days[day].teams];
        running.sort(rankingSorter(day, true));
        running.forEach((team, index) => {
          team.ranking.qualifieds[day] = index + 1;
        });
        competition.days[day].pools.forEach((pool: Pool) => {
          const teams = [...pool.teams];
          teams.sort(rankingSorter(day, false));
          teams.forEach((team, index) => {
            team.ranking.pools[day] = index + 1;
          });
        });
        if (day > 1) {
          const teams = [...competition.days[day].teams];
          teams.sort(rankingSorter(day - 1, false));
          teams.forEach((team: Team, index: number) => {
            if (team.pools.length > 0 && team.pools[day] && team.pools[day].ranking === undefined) {
              team.pools[day].ranking = index + 1;
            }
          });
        }
      });
    });
};
