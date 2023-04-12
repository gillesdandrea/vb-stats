import { useMemo, useState } from 'react';

import { CheckCircleTwoTone, CloseCircleTwoTone, QuestionCircleTwoTone } from '@ant-design/icons';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import cx from 'classnames';

import { Competition, Match, Score, Team } from '../../model/model';
import {
  getBoard,
  getDayDistance,
  getDayRanking,
  getFirstCountInPreviousDay,
  getGlobalTeamStats,
  getTeamOpposition,
  getTeamRanking,
  getTeamStats,
  getWinProbability,
  isTeamInCourse,
  poolId2Name,
} from '../../model/model-helpers';

import {
  Sorting,
  pointSorter,
  poolSorter,
  previousPoolSorter,
  rankingSorter,
  ratingSorter,
  setSorter,
} from '../../model/model-sorters';
import './CompetitionBoard.scss';

interface Props {
  competition: Competition;
  day: number;
  singleDay: boolean;
  qualified: boolean;
  className?: string | string[];
}

const smallWidth = 60;
const mediumWidth = 100;
const largeWidth = 120;

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
    const matchs = getGlobalTeamStats(selected).matchs.filter(
      (match: Match) => match.teamA === team || match.teamB === team,
    );
    const pool = matchs.length > 0 ? selected.pools[matchs[0].day].teams : [];
    const host = pool.length === 3 ? pool[0].name : '';

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
        {` ${match.date} @${host}`}
      </div>
    ));
  }
  const trophies =
    rankings.length > 0
      ? rankings.map((rank, index) => (
          <div key={`${team.id}J${index + 1}`} className="trophy">{`J${index + 1}${getDayDistance(
            competition,
            team,
            index + 1,
          )}${firsts[index] === 2 ? '*' : ''}${medals[rank]}`}</div>
        ))
      : null;
  return <div className="trophies">{trophies}</div>;
};

const CompetitionBoard = ({ competition, day, singleDay, qualified, className }: Props) => {
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const selectedTeam = selectedKeys.length > 0 ? competition.teams.get(selectedKeys[0] as string) : undefined;

  const board = useMemo(
    () => getBoard(competition, Sorting.POINTS, day, singleDay, qualified),
    [competition, day, singleDay, qualified],
  );
  const columns: ColumnsType<Team> = [
    // { title: '', key: 'index', align: 'right', width: 40, render: (value, item, index) => index + 1, fixed: true },
    {
      title: '',
      colSpan: 0,
      key: 'index',
      align: 'right',
      width: 40,
      render: (team: Team, item, index) => {
        const ranking = getTeamRanking(team, day, singleDay, qualified);
        return ranking ?? '-';
      },
      fixed: true,
    },
    {
      title: singleDay ? 'Daily' : 'Global',
      colSpan: 2,
      key: 'delta',
      align: 'left',
      width: 40,
      render: (team: Team, item, index) => {
        const ranking = getTeamRanking(team, day, singleDay, qualified);
        if (day === 1) {
          return '';
        }
        const previous = getTeamRanking(team, day - 1, singleDay, qualified);
        const delta = previous
          ? ranking === previous
            ? ''
            : ranking < previous
            ? ` ⏶ ${previous - ranking}`
            : ` ⏷ ${ranking - previous}`
          : ' ⏴';
        return <small>{delta}</small>;
      },
      sorter: rankingSorter(day, !singleDay),
      showSorterTooltip: false,
      fixed: true,
    },
    {
      title: 'Rating',
      key: 'rating',
      align: 'center',
      width: smallWidth,
      render: (team: Team) => {
        const { rating } = getTeamStats(team, day);
        return rating.mu.toFixed(3);
      },
      sorter: ratingSorter(day),
      showSorterTooltip: false,
    },
    {
      title: 'Diff.',
      key: 'difficulty',
      align: 'center',
      width: smallWidth,
      render: (team: Team) => {
        const [mean, stdev] = getTeamOpposition(competition, team, day, !singleDay);
        // return `${(100 * mean).toFixed(1)} ±${(100 * stdev).toFixed(1)}`;
        return `${(100 * mean).toFixed(1)}%`;
      },
      sorter: (a: Team, b: Team) => {
        const [amean, astdev] = getTeamOpposition(competition, a, day, !singleDay);
        const [bmean, bstdev] = getTeamOpposition(competition, b, day, !singleDay);
        return amean === bmean ? bstdev - astdev : bmean - amean;
      },
      showSorterTooltip: false,
    },
    {
      title: 'Points',
      key: 'ranking',
      align: 'center',
      width: smallWidth,
      render: (team: Team) => {
        const stats = getTeamStats(team, day, !singleDay);
        if (stats.matchCount === 0) {
          return '-';
        }
        const dayCount = singleDay ? 1 : Math.min(day, team.lastDay);
        return `${Math.round((stats.points * 2 * dayCount) / stats.matchCount)}${
          2 * dayCount !== stats.matchCount ? '*' : ''
        }`;
      },
      sorter: rankingSorter(day, !singleDay),
      showSorterTooltip: false,
    },
    {
      title: 'Matchs',
      key: 'matchs',
      align: 'center',
      width: smallWidth,
      render: (team: Team) => {
        const stats = getTeamStats(team, day, !singleDay);
        return `${stats.matchWon} / ${stats.matchCount}`;
      },
    },
    {
      title: 'Sets',
      key: 'sets',
      align: 'center',
      width: mediumWidth,
      render: (team: Team) => {
        const stats = getTeamStats(team, day, !singleDay);
        const sratio = stats.setLost === 0 ? 'MAX' : (stats.setWon / stats.setLost).toFixed(2);
        return `${stats.setWon} / ${stats.setLost} = ${sratio}`;
      },
      sorter: setSorter(day, !singleDay),
      showSorterTooltip: false,
    },
    {
      title: 'Points',
      key: 'points',
      align: 'center',
      width: largeWidth,
      render: (team: Team) => {
        const stats = getTeamStats(team, day, !singleDay);
        const pratio = stats.pointLost === 0 ? 'MAX' : (stats.pointWon / stats.pointLost).toFixed(3);
        return `${stats.pointWon} / ${stats.pointLost} = ${pratio}`;
      },
      sorter: pointSorter(day, !singleDay),
      showSorterTooltip: false,
    },
    {
      title: 'Pool',
      key: 'pool',
      align: 'center',
      width: smallWidth,
      ellipsis: true,
      render: (team: Team) => {
        return team.pools[day]
          ? `${poolId2Name(team.pools[day].name)}${team.pools[day].teams[0] === team ? '*' : ''}`
          : '-';
      },
      sorter: poolSorter(day, !singleDay),
      showSorterTooltip: false,
    },
    {
      title: `J${day - 1}`,
      key: 'previous',
      align: 'right',
      width: smallWidth,
      ellipsis: true,
      render: (team: Team) => (day >= 1 ? team.ranking.days[day - 1] : ''),
      // sorter: day > 1 ? rankingSorter(day - 1, false) : undefined,
      sorter: previousPoolSorter(day, !singleDay),
      showSorterTooltip: false,
    },
    { title: 'Name', key: 'name', width: '24rem', render: (team: Team) => `${team.name} (${team.department.num_dep})` },
    {
      title: 'Region',
      key: 'region',
      width: '12rem',
      render: (team: Team) => `${team.department.region_name}`,
      sorter: (a: Team, b: Team) =>
        a.department.region_name === b.department.region_name
          ? rankingSorter(day, !singleDay)(a, b)
          : a.department.region_name.localeCompare(b.department.region_name),
      showSorterTooltip: false,
    },
    {
      title: 'Competition',
      key: 'competition',
      align: 'left',
      // width: `${competition.lastDays * 3 + 1.75}rem`,
      width: '25rem',
      ellipsis: true,
      render: (team: Team) => getTrophies(competition, team, selectedTeam),
    },
  ];

  // console.log('rendering CompetitionBoard');
  return (
    <div className={cx('vb-board', className)} key={`${day}-${singleDay}-${qualified}`}>
      <Table<Team>
        dataSource={board}
        columns={columns}
        sortDirections={['ascend']}
        pagination={false}
        footer={(data) => <div />}
        scroll={{ y: 1280 }}
        size="small"
        // bordered
        rowClassName={(team: Team, index) => (!isTeamInCourse(competition, team, day) ? 'table-row-disabled' : '')}
        rowKey={(team: Team) => team.id}
        rowSelection={{
          type: 'radio',
          selectedRowKeys: selectedKeys,
          onChange: (selectedRowKeys: React.Key[], selectedRows: Team[]) => {
            setSelectedKeys(selectedRowKeys);
          },
        }}
        onRow={(team: Team) => ({
          onClick: () => {
            if (selectedKeys.includes(team.id)) {
              setSelectedKeys([]);
            } else {
              setSelectedKeys([team.id]);
            }
          },
        })}
      />
    </div>
  );
};

export default CompetitionBoard;
