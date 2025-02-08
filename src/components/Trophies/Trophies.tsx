import { CheckCircleTwoTone, CloseCircleTwoTone, QuestionCircleTwoTone } from '@ant-design/icons';

import { Competition, Match, Score, Team } from '@/model/model';
import {
  getDayDistance,
  getDayRanking,
  getFirstCountInPreviousDay,
  getGlobalTeamStats,
  getWinProbability,
} from '@/model/model-helpers';

import './Trophies.scss';

const medals = [' -', '🥇', '🥈', '🥉'];

const getMatch = (match: Match, selected: Team) => {
  const proba = 100 * (selected === match.teamA ? match.winProbability : 1 - match.winProbability);
  const probaText = `${proba.toFixed(1)}%`;
  if (match.teamA === selected) {
    return `${match.score.map((set: Score) => `${set.scoreA}-${set.scoreB}`).join(',')} (${probaText})`;
  }
  return `${match.score.map((set: Score) => `${set.scoreB}-${set.scoreA}`).join(', ')} ((${probaText}))`;
};

interface TrophiesProps {
  competition: Competition;
  team: Team;
  selected?: Team;
}

const Trophies = ({ competition, team, selected }: TrophiesProps) => {
  const rankings = Array(competition.lastDay)
    .fill(0)
    .map((_, index) => getDayRanking(competition, team, index + 1));
  const firsts = Array(competition.lastDay)
    .fill(0)
    .map((_, index) => getFirstCountInPreviousDay(competition, team, index + 1));
  if (selected && selected !== team) {
    const matchs = getGlobalTeamStats(selected).matchs.filter(
      (match: Match) => match.teamA === team || match.teamB === team,
    );
    const pool = matchs.length > 0 && selected.pools.length > 0 ? selected.pools[matchs[0].day].teams : [];
    const host = pool.length === 3 ? pool[0].name : undefined;

    if (selected && matchs.length === 0) {
      return `(${(getWinProbability(selected, team, competition.dayCount) * 100).toFixed(1)}%)`;
    }

    return matchs.map((match) => (
      <div key={match.id} className="match">
        {`J${match.day}`}
        {getDayDistance(competition, selected, match.day)}
        {firsts[match.day - 1] === 2 ? '*' : ''}
        &nbsp;
        {match.winner === undefined ? (
          <QuestionCircleTwoTone />
        ) : match.winner === selected ? (
          <CheckCircleTwoTone twoToneColor="green" />
        ) : (
          <CloseCircleTwoTone twoToneColor="red" />
        )}
        &nbsp;
        {getMatch(match, selected)}
        {` ${match.date} ${host ? `@${host}` : team === match.teamA ? '' : '✈️'}`}
      </div>
    ));
  }
  const trophies =
    rankings.length > 0
      ? rankings
          .filter((rank, index) => index < team.lastDay)
          .map((rank, index) => (
            <div key={`${team.id}J${index + 1}`} className="trophy">{`J${index + 1}${getDayDistance(
              competition,
              team,
              index + 1,
            )}${firsts[index] === 2 ? '*' : ''}${medals[rank]}`}</div>
          ))
      : null;
  return <div className="vb-trophies">{trophies}</div>;
};

export default Trophies;
