import { CheckCircleTwoTone, CloseCircleTwoTone, InfoCircleOutlined, QuestionCircleTwoTone } from '@ant-design/icons';
import { Avatar, Card, Collapse, CollapseProps } from 'antd';
import cx from 'classnames';

import { Competition, Match, Team } from '../../model/model';
import {
  getDayRanking,
  getTeamMatch,
  getTeamOpposition,
  getTeamRanking,
  getTeamStats,
  isTeamInCourse,
} from '../../model/model-helpers';
import MatchSheetLink from '../MatchSheetLink/MatchSheetLink';
import Trophies from '../Trophies/Trophies';

import './TeamInfo.scss';

const medals = ['', '🥇', '🥈', '🥉'];

const renderTeam = ({ competition, team, day, displayRanking }: TeamInfoProps) => {
  const stats = getTeamStats(team, day);
  const sratio = stats.setLost === 0 ? 'MAX' : (stats.setWon / stats.setLost).toFixed(2);
  const pratio = stats.pointLost === 0 ? 'MAX' : (stats.pointWon / stats.pointLost).toFixed(3);
  const [mean, stdev] = getTeamOpposition(competition, team, day, true);
  const opposition = `difficulty: ${(100 * mean).toFixed(1)} ±${(100 * stdev).toFixed(1)}`;
  const eliminated = !isTeamInCourse(competition, team, Math.min(day + 1, competition.dayCount));
  const ranking = getTeamRanking(team, day, false, true);
  const previous = getTeamRanking(team, day - 1, false, true);
  const delta =
    previous && !isNaN(ranking)
      ? ranking === previous
        ? ''
        : ranking < previous
          ? ` ⏶ ${previous - ranking}`
          : ` ⏷ ${ranking - previous}`
      : '';
  const dayCount = Math.min(day, team.lastDay);

  return (
    <div className={cx('vb-card-header-content', { eliminated })}>
      {ranking && (
        <Avatar size="large" className={cx('ranking', { 'ranking-low': !displayRanking })}>
          {ranking}
        </Avatar>
      )}
      <div className="vb-card-split">
        <div className="vb-card-left">
          <div className="vb-legend">
            {`CDF ${competition.category} ${competition.season.substring(competition.season.length - 4)}`}
          </div>
        </div>
        <div className="vb-card-right">
          <div className="title">
            {'🏐'}
            &nbsp;
            <span className={eliminated ? 'strikethrough' : ''}>{team.name}</span>
          </div>
          <div className="subtitle">
            <div>
              {team.department.num_dep} - {team.department.region_name}
            </div>
            <Trophies competition={competition} team={team} />
            <div className="small-text">
              <div>
                ranking: {ranking ?? '-'} / {competition.days[day].teams.length} <small>{delta}</small> | points:{' '}
                {Math.round((stats.points * 2 * dayCount) / stats.matchCount)} / {6 * dayCount}
                {2 * dayCount !== stats.matchCount ? '*' : ''}
              </div>
              <div>
                matchs: {stats.matchWon}/{stats.matchCount} | sets: {stats.setWon}/{stats.setLost}={sratio} | points:{' '}
                {stats.pointWon}/{stats.pointLost}={pratio}
              </div>
              <div>
                rating: {stats.rating.mu.toFixed(3)} | {opposition}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const renderMatchs = (
  team: Team,
  competition: Competition,
  matchs: Match[],
  day: number,
  pushModalTeam?: (team: Team) => void,
) => {
  const items: CollapseProps['items'] = matchs.map((match) => {
    const { teamB } = match;
    const stats = getTeamStats(teamB, day);
    const sratio = stats.setLost === 0 ? 'MAX' : (stats.setWon / stats.setLost).toFixed(2);
    const pratio = stats.pointLost === 0 ? 'MAX' : (stats.pointWon / stats.pointLost).toFixed(3);
    const [mean, stdev] = getTeamOpposition(competition, teamB, day, false);
    const opposition = `difficulty: ${(100 * mean).toFixed(1)} ±${(100 * stdev).toFixed(1)}`;
    const eliminated = !isTeamInCourse(competition, teamB, Math.min(day + 1, competition.dayCount));
    const ranking = getTeamRanking(teamB, day, false, true);
    const previous = getTeamRanking(teamB, day - 1, false, true);
    const delta =
      previous && !isNaN(ranking)
        ? ranking === previous
          ? ''
          : ranking < previous
            ? ` ⏶ ${previous - ranking}`
            : ` ⏷ ${ranking - previous}`
        : '';
    const dayCount = Math.min(day, teamB.lastDay);

    return {
      key: match.id,
      label: (
        <div className={cx('vb-match', { eliminated })}>
          <span className="match-icon">
            {match.winner === undefined ? (
              <QuestionCircleTwoTone />
            ) : match.winner === team ? (
              <CheckCircleTwoTone twoToneColor="green" />
            ) : (
              <CloseCircleTwoTone twoToneColor="red" />
            )}
            &nbsp;
            <span className="vb-tag">
              {match.setA} - {match.setB}
            </span>
            &nbsp;
            <span className="vb-score-points">
              {match.score.map((score) => `${score.scoreA}-${score.scoreB}`).join(' ; ')}
            </span>
            &nbsp;
            <span
              className={cx('vb-score', {
                'vb-match-lost': match.winProbability < 0.5 || match.winner === teamB,
                'vb-match-unpredicted': match.predicted === false,
                'vb-match-tight': Math.abs(match.winProbability - 0.5) < 0.05,
              })}
            >
              {`(${(100 * match.winProbability).toFixed(1)}%)`}
            </span>
            <MatchSheetLink competition={competition} match={match} />
          </span>
          <div className="subtitle">
            <div className={cx({ strikethrough: !isTeamInCourse(competition, match.teamB, competition.lastDay + 1) })}>
              <span>
                {teamB.name} ({teamB.department.num_dep})
              </span>
              {pushModalTeam && (
                <a className="vb-team-link" onClick={() => pushModalTeam(teamB)}>
                  <InfoCircleOutlined />
                </a>
              )}
            </div>
            <Trophies competition={competition} team={teamB} />
          </div>
        </div>
      ),
      children: (
        <div className={cx('subtitle', { eliminated })}>
          <div>
            ranking: {ranking ?? '-'} / {competition.days[day].teams.length} <small>{delta}</small> | points:{' '}
            {Math.round((stats.points * 2 * dayCount) / stats.matchCount)} / {6 * dayCount}
            {2 * dayCount !== stats.matchCount ? '*' : ''}
          </div>
          <div>
            matchs: {stats.matchWon}/{stats.matchCount} | sets: {stats.setWon}/{stats.setLost}={sratio} | points:{' '}
            {stats.pointWon}/{stats.pointLost}={pratio}
          </div>
          <div>
            rating: {stats.rating.mu.toFixed(3)} | {opposition}
          </div>
        </div>
      ),
    };
  });
  return (
    <div className="vb-match">
      <Collapse ghost collapsible="icon" expandIconPosition="end" items={items} />
    </div>
  );
};

interface TeamInfoProps {
  competition: Competition;
  team: Team;
  day: number;
  displayRanking?: boolean;
  pushModalTeam?: (team: Team) => void;
}

const TeamInfo = ({ competition, team, day, displayRanking = true, pushModalTeam }: TeamInfoProps) => {
  return (
    <Card className="vb-team-info">
      <div className="vb-card">
        <div className="vb-card-header">
          {renderTeam({
            competition,
            team,
            day,
            displayRanking,
            pushModalTeam,
          })}
        </div>
        <div className="vb-card-footer">
          {team.pools.map((pool, index) => {
            return (
              <div className="vb-card-split" key={`J${index}${pool.name}`}>
                <div className="vb-card-left">
                  <div className="vb-tag">{`J${index}`}</div>
                  <div className="medal">{medals[getDayRanking(competition, team, index)]}</div>
                </div>
                <div className="vb-card-right">
                  {renderMatchs(
                    team,
                    competition,
                    pool.matchs
                      .filter((match) => match.teamA === team || match.teamB === team)
                      .map((match) => getTeamMatch(team, match)),
                    day,
                    pushModalTeam,
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

export default TeamInfo;
