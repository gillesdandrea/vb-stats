import { presetDarkPalettes, gray } from '@ant-design/colors';
import { Avatar, Card, Col, Progress, Row } from 'antd';
import cx from 'classnames';

import { getTrophies } from '../../model/graph';
import { Competition, Pool, Team } from '../../model/model';
import {
  getDayRanking,
  getPoolProbabilities,
  getTeamOpposition,
  getTeamRanking,
  getTeamStats,
  poolId2Name,
} from '../../model/model-helpers';

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

const renderPool = ({ competition, pool, day }: { competition: Competition; pool: Pool; day: number }) => {
  const { gold, volcano } = presetDarkPalettes;
  const [probabilities, orders] = getPoolProbabilities(competition, pool, day);
  const firstCount = pool.teams.filter((team) => team.ranking.pools[day - 1] === 1).length;
  const thirdCount = pool.teams.filter((team) => team.ranking.pools[day - 1] === 3).length;
  return (
    <Col xs={24} sm={24} md={24} lg={12} xl={12} xxl={8} key={pool.name}>
      <Card>
        <div className="vb-card-left">
          <Avatar style={{ backgroundColor: firstCount > 1 ? gold[3] : thirdCount > 0 ? volcano[2] : '' }}>
            {poolId2Name(pool.name)}
          </Avatar>
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
      </Card>
    </Col>
  );
};

const CompetitionPools = ({ competition, day, singleDay, qualified, className }: Props) => {
  const cday = competition.days[day];
  if (!cday || !cday.pools || cday.pools.size === 0) {
    return null;
  }
  const pools = Array.from(cday.pools.keys());
  return (
    <div className={cx('vb-pools', className)}>
      <Row gutter={[24, 24]}>
        {pools.map((name) => {
          const pool = cday.pools.get(name);
          return pool ? renderPool({ competition, pool, day }) : null;
        })}
      </Row>
    </div>
  );
};

export default CompetitionPools;
