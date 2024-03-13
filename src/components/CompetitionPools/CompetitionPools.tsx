import { ChangeEventHandler, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { gray, presetDarkPalettes } from '@ant-design/colors';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Avatar, Card, Col, Empty, Modal, Progress, Row, Tag } from 'antd';
import Search from 'antd/es/input/Search';
import cx from 'classnames';
import debounce from 'lodash/debounce';

import { Competition, Match, Pool, Team } from '../../model/model';
import {
  filterTeam,
  getBoard,
  getDayRanking,
  getPoolProbabilities,
  getTeamOpposition,
  getTeamRanking,
  getTeamStats,
  poolId2Name,
} from '../../model/model-helpers';
import { getTrophies } from '../CompetitionBoard/CompetitionBoard';
import Headroom from '../Headroom/Headroom';
import Help from '../Help/Help';
import MatchSheetLink from '../MatchSheetLink/MatchSheetLink';
import TeamInfo from '../TeamInfo/TeamInfo';

import './CompetitionPools.scss';
import '../CompetitionTeams/CompetitionTeams.scss'; // TODO hack
import { Sorting } from '../../model/model-sorters';

interface Props {
  competition: Competition;
  day: number;
  singleDay: boolean;
  qualified: boolean;
  tokens: string[];
  setTokens: (tokens: string[]) => void;
  className?: string | string[];
}

const medals = ['🏐', '🥇', '🥈', '🥉'];

const renderTeam = ({
  competition,
  team,
  day,
  probability,
  rank,
  pushModalTeam,
}: {
  competition: Competition;
  team: Team;
  day: number;
  probability: number;
  rank: number;
  pushModalTeam: (team: Team) => void;
}) => {
  // console.log(presetDarkPalettes);
  const { blue, green, gold, red } = presetDarkPalettes;
  const stats = getTeamStats(team, day);
  const sratio = stats.setLost === 0 ? 'MAX' : (stats.setWon / stats.setLost).toFixed(2);
  const pratio = stats.pointLost === 0 ? 'MAX' : (stats.pointWon / stats.pointLost).toFixed(3);
  const [mean, stdev] = getTeamOpposition(competition, team, day, true);
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
        <a className="vb-team-link" onClick={() => pushModalTeam(team)}>
          <InfoCircleOutlined />
        </a>
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

        {day > 1 && (
          <div className="vb-card-chart">
            <Progress type="dashboard" percent={probability} size={88} strokeColor={color} strokeWidth={8} />
          </div>
        )}
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
          {`${(100 * match.winProbability).toFixed(1)}%`}
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
            <span>{match.score.map((score) => `${score.scoreA}-${score.scoreB}`).join(' ; ')}</span>
            <MatchSheetLink competition={competition} match={match} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

const renderPool = ({
  competition,
  pool,
  day,
  pushModalTeam,
}: {
  competition: Competition;
  pool: Pool;
  day: number;
  pushModalTeam: (team: Team) => void;
}) => {
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
              <small>{pool.matchs[0]?.date}</small>
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
                pushModalTeam,
              }),
            )}
          </div>
        </div>
        <div className="vb-card-footer">{pool.matchs.map((match) => renderMatch({ competition, match }))}</div>
      </Card>
    </Col>
  );
};

const CompetitionPools = ({ competition, day, singleDay, qualified, tokens, setTokens, className }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const allTeams = useMemo(
    () => getBoard(competition, Sorting.POINTS, competition.dayCount, false, false),
    [competition],
  );

  const [modalTeam, setModalTeam] = useState<Team | null>(null);
  const [modalTeams, setModalTeams] = useState<Team[]>([]);

  const pushModalTeam = useCallback(
    (newModalTeam: Team) => {
      setModalTeams((modalTeams) => [newModalTeam, ...modalTeams]);
      if (modalTeam) {
        setModalTeam(null);
        setTimeout(() => setModalTeam(newModalTeam), 150);
      } else {
        setModalTeam(newModalTeam);
      }
    },
    [modalTeam],
  );
  const popModalTeam = useCallback(() => {
    const [team, ...teams] = modalTeams;
    if (team) {
      setModalTeams(teams);
    }
    const newModalTeam = teams.length > 1 ? teams[0] : null;
    setModalTeam(null);
    if (newModalTeam) {
      setTimeout(() => setModalTeam(newModalTeam), 150);
    }
    return team;
  }, [modalTeams]);

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
  });

  const cday = competition.days[day];
  if (!cday) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }
  if (!cday || !cday.pools || cday.pools.size === 0) {
    // temporary display data for championship
    return (
      <div className={cx('vb-pools', className)}>
        <div className="vb-championship">
          {competition.days.map((cday) => {
            return (
              <>
                <div>
                  {cday.matchs.map((match) => {
                    const qa = 1 + (1 - match.winProbability) / match.winProbability;
                    const qb = 1 + match.winProbability / (1 - match.winProbability);
                    return (
                      <div style={{ display: 'flex' }}>
                        <div style={{ width: '2rem' }}>{`J${cday.day}`}</div>
                        <div style={{ width: '6rem' }}>{match.date}</div>
                        <div style={{ width: '4rem', color: match.predicted === false ? 'red' : '' }}>{`${(
                          100 * match.winProbability
                        ).toFixed(1)}%`}</div>
                        <div style={{ width: '6rem' }}>{`${qa.toFixed(2)} - ${qb.toFixed(2)}`}</div>
                        <div style={{ width: '1.5rem' }}>|</div>
                        <div style={{ width: '3rem' }}>{`${match.setA} - ${match.setB}`}</div>
                        <div>{`${match.teamA.name} - ${match.teamB.name}`}</div>
                      </div>
                    );
                  })}
                </div>
                <br />
              </>
            );
          })}
        </div>
      </div>
    );
  }
  const pools = Array.from(cday.pools.values()).filter((pool: Pool) =>
    pool.teams.some((team: Team) => filterTeam(team, tokens)),
  );
  const teams = pools.length === 0 ? allTeams.filter((team: Team) => filterTeam(team, tokens)) : [];

  return (
    <div ref={scrollRef} className={cx(teams.length === 0 ? 'vb-pools' : 'vb-teams', className)}>
      <Headroom scrollRef={scrollRef} className="vb-search">
        <Search
          defaultValue={tokens.join(' ')}
          placeholder="Filter teams..."
          allowClear
          onChange={debouncedSearchHandler}
        />
      </Headroom>
      <Row gutter={[24, 24]}>
        {tokens.length > 0 ? null : (
          <Col xs={24} sm={24} md={24} lg={12} xl={12} xxl={8} key={'stats'}>
            <Card>
              <Help competition={competition} day={day} singleDay={singleDay} qualified={qualified} />
            </Card>
          </Col>
        )}
        {pools.length === 0 ? (
          teams.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: 'auto' }} />
          ) : (
            teams.map((team: Team) => {
              return (
                <Col xs={24} sm={24} md={24} lg={12} xl={12} xxl={8} key={team.id} className="vb-team-info">
                  <TeamInfo competition={competition} team={team} day={day} />
                </Col>
              );
            })
          )
        ) : (
          pools.map((pool: Pool) => {
            return pool ? renderPool({ competition, pool, day, pushModalTeam }) : null;
          })
        )}
      </Row>
      <Modal
        className="vb-modal-team-info"
        title=""
        footer={null}
        open={!!modalTeam}
        onOk={() => {}}
        onCancel={() => popModalTeam()}
      >
        {modalTeam && (
          <TeamInfo
            competition={competition}
            team={modalTeam}
            day={competition.dayCount}
            displayRanking={false}
            pushModalTeam={pushModalTeam}
          />
        )}
      </Modal>
    </div>
  );
};

export default CompetitionPools;
