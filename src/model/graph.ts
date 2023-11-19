import { Competition, Match, Score, Team, Victory } from './model';
import {
  getBoard,
  getDayDistance,
  getDayRanking,
  getFirstCountInPreviousDay,
  getTeamOpposition,
  getTeamRanking,
  getTeamStats,
} from './model-helpers';
import { Sorting } from './model-sorters';

const medals = ['-', '🥇', '🥈', '🥉'];
// const medals = ['', '1', '2', '2'];

const getColor = (match: Match) => {
  switch (match.victory) {
    case Victory.TieBreak:
      return 'royalblue'; // 'blue';
    case Victory.Medium:
      return 'mediumseagreen'; // 'green';
    case Victory.Large:
      return 'orange'; // 'orange';
    case Victory.Huge:
      return 'tomato'; // 'red';
    default:
      return 'mediumorchid'; // 'black';
  }
};

export const getTrophies = (competition: Competition, team: Team): string => {
  const rankings = Array(competition.lastDay)
    .fill(0)
    .map((_, index) => getDayRanking(competition, team, index + 1));
  const firsts = Array(competition.lastDay)
    .fill(0)
    .map((_, index) => getFirstCountInPreviousDay(competition, team, index + 1));
  const trophies =
    rankings.length > 0
      ? rankings
          .filter((rank) => rank > 0)
          .map(
            (rank, index) =>
              `J${index + 1}${getDayDistance(competition, team, index + 1)}${firsts[index] === 2 ? '*' : ''}${
                medals[rank]
              }`,
          )
          .join(' ')
      : ' ';
  return trophies;
};

const getTeamNode = (
  competition: Competition,
  team: Team,
  day: number,
  singleDay: boolean,
  qualified: boolean,
): string => {
  const isCDF = team.pools.length > 0;
  const stats = getTeamStats(team, day, !singleDay);
  const sratio = stats.setLost === 0 ? 'MAX' : (stats.setWon / stats.setLost).toFixed(2);
  const pratio = stats.pointLost === 0 ? 'MAX' : (stats.pointWon / stats.pointLost).toFixed(3);
  // const eliminated = countLastDayVictories(team) === 0;
  const trophies = getTrophies(competition, team);
  const dayRanking = getDayRanking(competition, team, Math.min(day, competition.lastDay));
  const eliminated = isCDF && dayRanking !== 1 && dayRanking !== 2;
  const pre = eliminated ? '<s>' : '';
  const post = eliminated ? '</s>' : '';
  const [mean, stdev] = getTeamOpposition(competition, team, day, !singleDay);
  const opposition = `difficulty: ${(100 * mean).toFixed(1)} ±${(100 * stdev).toFixed(1)}`;
  const ranking = getTeamRanking(team, day, singleDay, qualified);
  return (
    // `T${team.id} [label="${index + 1}\\n${team.name} (${stats.rating.mu.toFixed(3)})\\n\\n` +
    // `matchs: ${stats.matchWon}/${stats.matchCount}, sets: ${stats.setWon}/${stats.setLost}=${sratio}, points: ${stats.pointWon}/${stats.pointLost}=${pratio}"]`
    `T${team.id} [label=<` +
    `<font point-size="8pt">${trophies}</font><br/>` +
    `${pre}${ranking} ${team.name}${post}<br/>` +
    `<font point-size="8pt">` +
    `${team.department.num_dep} - ${team.department.region_name}` +
    `<br/>matchs: ${stats.matchWon}/${stats.matchCount} | sets: ${stats.setWon}/${stats.setLost}=${sratio} | points: ${stats.pointWon}/${stats.pointLost}=${pratio}` +
    `<br/>rating: ${stats.rating.mu.toFixed(3)} | ${opposition}` +
    `</font>` +
    `> fillcolor="${team.department.color}"]`
  );
};

const getMatchEdge = (competition: Competition, match: Match) => {
  const teamW = match.winner ? match.winner : Math.round(1000 * match.winProbability) < 500 ? match.teamB : match.teamA;
  const teamL = teamW === match.teamA ? match.teamB : match.teamA;
  const proba = 100 * (teamW === match.teamA ? match.winProbability : 1 - match.winProbability);
  const predicted = Math.round(10 * proba) < 500 ? ' fontcolor="tomato"' : '';
  const label = `J${match.day}: ${
    match.winner ? match.score.map((set: Score) => `${set.scoreA}-${set.scoreB}`).join(',') : match.date
  }\\n${proba.toFixed(1)}%`;
  const tooltip = `${match.teamA.name} - ${match.teamB.name}`;
  const style = match.winner ? '' : ' style="dashed"';
  const width = match.day === competition.lastDay ? ' penwidth=3' : '';
  const weight = `weight=${match.day}`;
  const dir = match.victory === Victory.Unplayed && Math.round(10 * proba) === 500 ? ' dir="none"' : '';
  return `T${teamW.id} -> T${teamL.id} [${weight} color="${getColor(
    match,
  )}" edgetooltip="${label}" label="${label}" labeltooltip="${tooltip}"${predicted}${width}${style}${dir}]`;
  // return `T${teamW.id} -> T${teamL.id} [color="${getColor(match)}" edgetooltip="${label}" taillabel="${label}"]`;
};

export const getGraph = (
  competition: Competition,
  day: number,
  singleDay: boolean,
  qualified: boolean,
  teamFilter: (team: Team, index: number) => boolean = () => true,
  matchFilter: (match: Match) => boolean = () => true,
) => {
  const title = `${competition.name} ${competition.category} ${competition.season}`;
  const qualifiedTeams = new Set<Team>();
  const teams: Team[] = getBoard(competition, Sorting.POINTS, day, singleDay, qualified).filter(teamFilter);
  teams.forEach((team) => qualifiedTeams.add(team));
  return `digraph {
  tooltip="${title}"
  node [fontname="Arial" shape="note" style="filled" fillcolor="white"]
  edge [fontname="Arial" fontsize="8pt" minlen=2 dir="both" arrowtail="dot" arrowsize=0.5]
 
${teams.map((team: Team, index: number) => `  ${getTeamNode(competition, team, day, singleDay, qualified)}`).join('\n')}

${competition.matchs
  .filter(matchFilter)
  .filter((match: Match) => qualifiedTeams.has(match.teamA) && qualifiedTeams.has(match.teamB))
  .map((match: Match) => `  ${getMatchEdge(competition, match)}`)
  .join('\n')}
}`;
};
