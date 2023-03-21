import { CheckCircleTwoTone, CloseCircleTwoTone } from '@ant-design/icons';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { Rating } from 'ts-trueskill';
import cx from 'classnames';
import {
  Competition,
  getBoard,
  getDayDistance,
  getDayRanking,
  getFirstCountInPreviousDay,
  getPool,
  Match,
  Score,
  Stats,
  Team,
} from '../../model/model';

import './CompetitionBoard.scss';

interface Props {
  competition: Competition;
  className?: string | string[];
}

const smallWidth = 80;
const mediumWidth = 110;
const largeWidth = 140;

const medals = [' -', '🥇', '🥈', '🥉'];

const getMatch = (match: Match, selected: Team) => {
  const proba = 100 * (selected === match.teamA ? match.winProbability : 1 - match.winProbability);
  if (match.teamA === selected) {
    return `${match.score.map((set: Score) => `${set.scoreA}-${set.scoreB}`).join(',')} (${proba.toFixed(1)}%)`;
  }
  return `${match.score.map((set: Score) => `${set.scoreB}-${set.scoreA}`).join(', ')} (${proba.toFixed(1)}%)`;
};

export const getTrophies = (competition: Competition, team: Team, selected?: Team) => {
  const rankings = Array(competition.lastDay)
    .fill(0)
    .map((_, index) => getDayRanking(competition, team, index + 1));
  const firsts = Array(competition.lastDay)
    .fill(0)
    .map((_, index) => getFirstCountInPreviousDay(competition, team, index + 1));
  if (selected && selected !== team) {
    const matchs = selected.stats.matchs.filter((match: Match) => match.teamA === team || match.teamB === team);
    const pool = matchs.length > 0 ? getPool(competition, selected, matchs[0].day) : [];
    const host = pool.length === 3 ? pool[0].name : '';

    return matchs.map((match) => (
      <div className="match">
        {`J${match.day}`}
        {getDayDistance(competition, selected, match.day)}
        {firsts[match.day - 1] === 2 ? '*' : ''}
        &nbsp;
        {match.winner === undefined ? (
          match.date
        ) : match.winner === selected ? (
          <CheckCircleTwoTone twoToneColor="green" />
        ) : (
          <CloseCircleTwoTone twoToneColor="red" />
        )}
        &nbsp;
        {getMatch(match, selected)}
        {` @${host}`}
      </div>
    ));
  }
  const trophies =
    rankings.length > 0
      ? rankings.map((rank, index) => (
          <div key={index} className="trophy">{`J${index + 1}${getDayDistance(competition, team, index + 1)}${
            firsts[index] === 2 ? '*' : ''
          }${medals[rank]}`}</div>
        ))
      : null;
  return <div className="trophies">{trophies}</div>;
};

const CompetitionBoard = ({ competition, className }: Props) => {
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const selectedTeam = selectedKeys.length > 0 ? competition.teams.get(selectedKeys[0] as string) : undefined;

  const board = useMemo(() => getBoard(competition), [competition]);
  // const board = getBoard(competition);
  const columns: ColumnsType<Team> = [
    { title: '', key: 'index', align: 'right', width: 48, render: (value, item, index) => index + 1 },
    {
      title: 'Rating',
      key: 'rating',
      dataIndex: ['stats', 'rating'],
      align: 'center',
      width: smallWidth,
      render: (value: Rating) => value.mu.toFixed(3),
      sorter: (a: Team, b: Team) => b.stats.rating.mu - a.stats.rating.mu,
    },
    {
      title: 'Points',
      key: 'ranking',
      dataIndex: ['stats'],
      align: 'center',
      width: smallWidth,
      render: (stats: Stats) =>
        `${Math.round((stats.points * 2 * stats.lastDay) / stats.matchCount)}${
          2 * stats.lastDay !== stats.matchCount ? '*' : ''
        }`,
    },
    {
      title: 'Matchs',
      key: 'matchs',
      dataIndex: ['stats'],
      align: 'center',
      width: smallWidth,
      render: (stats: Stats) => `${stats.matchWon} / ${stats.matchCount}`,
    },
    {
      title: 'Sets',
      key: 'sets',
      dataIndex: ['stats'],
      align: 'center',
      width: mediumWidth,
      render: (stats: Stats) => {
        const sratio = stats.setLost === 0 ? 'MAX' : (stats.setWon / stats.setLost).toFixed(2);
        return `${stats.setWon} / ${stats.setLost} = ${sratio}`;
      },
    },
    {
      title: 'Points',
      key: 'points',
      dataIndex: ['stats'],
      align: 'center',
      width: largeWidth,
      render: (stats: Stats) => {
        const pratio = stats.pointLost === 0 ? 'MAX' : (stats.pointWon / stats.pointLost).toFixed(3);
        return `${stats.pointWon} / ${stats.pointLost} = ${pratio}`;
      },
    },
    { title: 'Name', key: 'name', width: '26rem', render: (team: Team) => `${team.name} (${team.department.num_dep})` },
    { title: 'Region', key: 'region', width: '14rem', render: (team: Team) => `${team.department.region_name}` },
    {
      title: 'Competition',
      key: 'competition',
      align: 'left',
      // width: `${competition.lastDays * 3 + 1.75}rem`,
      ellipsis: true,
      render: (team: Team) => getTrophies(competition, team, selectedTeam),
    },
  ];

  // console.log('rendering CompetitionBoard');
  return (
    <div className={cx('vb-board', className)}>
      <Table<Team>
        dataSource={board}
        columns={columns}
        pagination={false}
        footer={(data) => <div />}
        scroll={{ y: 1280 }}
        size="small"
        // bordered
        rowClassName={(team: Team, index) => (team.stats.lastDay < competition.lastDay ? 'table-row-disabled' : '')}
        rowKey={(team: Team) => team.id}
        rowSelection={{
          type: 'radio',
          selectedRowKeys: selectedKeys,
          onChange: (selectedRowKeys: React.Key[], selectedRows: Team[]) => {
            setSelectedKeys(selectedRowKeys);
            // setSelectedTeams(selectedRows);
          },
        }}
        onRow={(team: Team) => ({
          onClick: () => {
            if (selectedKeys.includes(team.id)) {
              setSelectedKeys([]);
              // setSelectedTeams([]);
            } else {
              setSelectedKeys([team.id]);
              // setSelectedTeams([team]);
            }
          },
        })}
      />
    </div>
  );
};

export default CompetitionBoard;
