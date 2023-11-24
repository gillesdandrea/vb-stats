import { ChangeEventHandler, useEffect, useMemo, useState } from 'react';

import { gray, presetDarkPalettes } from '@ant-design/colors';
import { Affix, Avatar, Card, Col, Empty, Progress, Row, Tag } from 'antd';
import Search from 'antd/es/input/Search';
import cx from 'classnames';
import debounce from 'lodash/debounce';

import { Competition, Match, Pool, Team } from '../../model/model';
import {
  getDayRanking,
  getPoolProbabilities,
  getTeamOpposition,
  getTeamRanking,
  getTeamStats,
  poolId2Name,
} from '../../model/model-helpers';
import { getTrophies } from '../CompetitionBoard/CompetitionBoard';
import Help from '../Help/Help';

import './CompetitionPools.scss';

interface Props {
  competition: Competition;
  day: number;
  singleDay: boolean;
  qualified: boolean;
  className?: string | string[];
}

const medals = ['🏐', '🥇', '🥈', '🥉'];

const renderTeam = ({
  competition,
  team,
  day,
  probability,
  rank,
}: {
  competition: Competition;
  team: Team;
  day: number;
  probability: number;
  rank: number;
}) => {
  // console.log(presetDarkPalettes);
  const { blue, green, gold, red } = presetDarkPalettes;
  const stats = getTeamStats(team, day);
  const sratio = stats.setLost === 0 ? 'MAX' : (stats.setWon / stats.setLost).toFixed(2);
  const pratio = stats.pointLost === 0 ? 'MAX' : (stats.pointWon / stats.pointLost).toFixed(3);
  const [mean, stdev] = getTeamOpposition(competition, team, day, false);
  const opposition = `difficulty: ${(100 * mean).toFixed(1)} ±${(100 * stdev).toFixed(1)}`;
  const dayRanking = getDayRanking(competition, team, day);
  const eliminated = dayRanking === 3;
  const predicted = rank === 1 && dayRanking === 1;
  const unpredicted = rank === 1 && dayRanking === 3;
  const outsider = rank === 3 && dayRanking === 1;
  const color =
    probability < 17 //
      ? red[5]
      : probability < 33 //
      ? gold[6]
      : probability < 66 //
      ? blue[6]
      : green[6];
  const ranking = getTeamRanking(team, day, false, true);
  const previous = getTeamRanking(team, day - 1, false, true);
  const delta = previous
    ? ranking === previous
      ? ''
      : ranking < previous
      ? ` ⏶ ${previous - ranking}`
      : ` ⏷ ${ranking - previous}`
    : '';
  const dayCount = Math.min(day, team.lastDay);

  return (
    <div
      className="vb-card-row"
      key={team.id}
      style={{
        color: predicted ? green[6] : unpredicted ? red[4] : outsider ? gold[6] : eliminated ? gray[4] : '',
      }}
    >
      <div className="title">
        {medals[dayRanking]}
        &nbsp;
        <span className={eliminated ? 'strikethrough' : ''}>{team.name}</span>
      </div>

      <div className="vb-card-content">
        <div className="vb-card-text">
          <div className="subtitle">
            <div>
              {team.department.num_dep} - {team.department.region_name}
            </div>
            <div>{getTrophies(competition, team)}</div>
            <div className="small-text">
              <div>
                ranking: {ranking} / {competition.days[day].teams.length} <small>{delta}</small> | points:{' '}
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

        <div className="vb-card-chart">
          <Progress type="dashboard" percent={probability} size={88} strokeColor={color} strokeWidth={8} />
        </div>
      </div>
    </div>
  );
};

const renderMatch = ({ competition, match }: { competition: Competition; match: Match }) => {
  return (
    <div key={match.id}>
      <div className="vb-match">
        <div
          className={cx('vb-team-a', {
            'vb-match-lost': match.winner ? match.winner !== match.teamA : match.winProbability < 0.5,
          })}
        >
          {match.teamA.name}
        </div>
        <div
          className={cx('vb-score', {
            'vb-match-lost': match.winProbability < 0.5 || match.winner === match.teamB,
            'vb-match-unpredicted': match.predicted === false,
            'vb-match-tight': Math.abs(match.winProbability - 0.5) < 0.05,
          })}
        >
          {/*match.winner ? `${match.setA} - ${match.setB}` :*/ `${(100 * match.winProbability).toFixed(1)}%`}
        </div>
        <div
          className={cx('vb-team-b', {
            'vb-match-lost': match.winner ? match.winner !== match.teamB : match.winProbability > 0.5,
          })}
        >
          {match.teamB.name}
        </div>
      </div>
      {match.winner ? (
        <div className="vb-score-details">
          <div className="vb-score-sets">
            <span className="vb-tag">
              {match.setA} - {match.setB}
            </span>
          </div>
          <div className="vb-score-points">
            {match.score.map((score) => `${score.scoreA}-${score.scoreB}`).join(' ; ')}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const renderPool = ({ competition, pool, day }: { competition: Competition; pool: Pool; day: number }) => {
  const { gold, volcano } = presetDarkPalettes;
  const [probabilities, orders] = getPoolProbabilities(competition, pool, day);
  const firstCount = pool.teams.filter((team) => team.ranking.pools[day - 1] === 1).length;
  const thirdCount = pool.teams.filter((team) => team.ranking.pools[day - 1] === 3).length;
  return (
    <Col xs={24} sm={24} md={24} lg={12} xl={12} xxl={8} key={pool.name}>
      <Card>
        <div className="vb-card-body">
          <div className="vb-card-left">
            <Avatar style={{ backgroundColor: firstCount > 1 ? gold[3] : thirdCount > 0 ? volcano[2] : '' }}>
              {poolId2Name(pool.name)}
            </Avatar>
            <div className="vb-legend">
              {`CDF ${competition.category} ${competition.season.substring(competition.season.length - 4)}`}
              &nbsp;
              <Tag>J{day}</Tag>
              <small>{pool.matchs[0].date}</small>
            </div>
          </div>
          <div className="vb-card-right">
            {pool.teams.map((team, index) =>
              renderTeam({
                competition,
                team,
                day,
                probability: Math.round(100 * probabilities[index]),
                rank: orders[index],
              }),
            )}
          </div>
        </div>
        <div className="vb-card-footer">{pool.matchs.map((match) => renderMatch({ competition, match }))}</div>
      </Card>
    </Col>
  );
};

const CompetitionPools = ({ competition, day, singleDay, qualified, className }: Props) => {
  const [tokens, setTokens] = useState<string[]>([]);
  const handleSearch: ChangeEventHandler<HTMLInputElement> = (event) => {
    setTokens(
      event.target.value
        .toLocaleLowerCase()
        .split(' ')
        .filter((token) => token),
    );
  };
  const debouncedSearchHandler = useMemo(() => debounce(handleSearch, 300), []);
  // Stop the invocation of the debounced function after unmounting
  useEffect(() => {
    return () => {
      debouncedSearchHandler.cancel();
    };
  }, []);

  const cday = competition.days[day];
  if (!cday || !cday.pools || cday.pools.size === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }
  const pools = Array.from(cday.pools.values()).filter((pool: Pool) =>
    pool.teams.some((team: Team) => {
      return (
        tokens.length === 0 ||
        tokens.some((token) => {
          if (team.name.toLocaleLowerCase().includes(token)) return true;
          const local = `${team.department.num_dep} ${team.department.dep_name} ${team.department.region_name}`;
          if (local.toLocaleLowerCase().includes(token)) return true;
          return false;
        })
      );
    }),
  );

  return (
    <div className={cx('vb-pools', className)}>
      <Affix offsetTop={81}>
        <div className="vb-search">
          <Search placeholder="Filter teams..." allowClear onChange={debouncedSearchHandler} />
        </div>
      </Affix>
      <Row gutter={[24, 24]}>
        {tokens.length > 0 ? null : (
          <Col xs={24} sm={24} md={24} lg={12} xl={12} xxl={8} key={'stats'}>
            <Card>
              <Help competition={competition} day={day} singleDay={singleDay} qualified={qualified} />
            </Card>
          </Col>
        )}
        {pools.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: 'auto' }} />
        ) : (
          pools.map((pool: Pool) => {
            return pool ? renderPool({ competition, pool, day }) : null;
          })
        )}
      </Row>
    </div>
  );
};

export default CompetitionPools;
