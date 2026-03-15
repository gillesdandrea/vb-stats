import { useMemo, useState } from 'react';

import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import cx from 'classnames';

import Trophies from '@/components/Trophies/Trophies';
import { type Competition, type Team } from '@/model/model';
import {
  getBoard,
  getDayRanking,
  getSlidingDay,
  getTeamOpposition,
  getTeamRanking,
  getTeamStats,
  isTeamInCourse,
  poolId2Name,
} from '@/model/model-helpers';
import {
  matchSorter,
  pointSorter,
  poolSorter,
  previousPoolSorter,
  rankingSorter,
  ratingSorter,
  setSorter,
  Sorting,
} from '@/model/model-sorters';

import './CompetitionBoard.scss';

interface Props {
  competition: Competition;
  day: number;
  singleDay: boolean;
  qualified: boolean;
  sliding?: boolean;
  className?: string | string[];
}

const smallWidth = 70;
const mediumWidth = 100;
const largeWidth = 120;

function getRankingLabel(sliding: boolean, singleDay: boolean): string {
  if (sliding) return 'Last 4';
  if (singleDay) return 'Daily';
  return 'Global';
}

function formatDelta(current: number, previous: number | undefined): string {
  if (!previous) return ' ⏴';
  if (current === previous) return '';
  if (current < previous) return ` ⏶ ${previous - current}`;
  return ` ⏷ ${current - previous}`;
}

const CompetitionBoard = ({ competition, day, singleDay, qualified, sliding = false, className }: Props) => {
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const selectedTeam = selectedKeys.length > 0 ? competition.teams.get(selectedKeys[0] as string) : undefined;
  const isPF = (d: number) => competition.days[d]?.pf;
  const getDay = (d: number) => (competition.days[d]?.pf ? 'PF' : `J${d}`);

  const isPFday = isPF(day);
  const statDay = sliding ? getSlidingDay(competition, day) : day;
  const statGlobal = sliding || !singleDay;
  const statPF = sliding || !!isPFday;

  const board = useMemo(
    () => getBoard(competition, Sorting.POINTS, day, singleDay, qualified, sliding),
    [competition, day, singleDay, qualified, sliding],
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
        if (sliding) {
          return index + 1;
        }
        if (singleDay) {
          const dranking = getDayRanking(competition, team, day);
          if (dranking === 0) {
            return '-';
          }
        }
        const ranking = getTeamRanking(team, day, singleDay, qualified);
        return ranking ?? '-';
      },
      fixed: true,
    },
    {
      title: getRankingLabel(sliding, singleDay),
      colSpan: 2,
      key: 'delta',
      align: 'left',
      width: 40,
      render: (team: Team, item, index) => {
        if (day === 1) {
          return '';
        }
        if (sliding) {
          const slidingRank = index + 1;
          const qualifiedRank = getTeamRanking(team, day, false, true);
          return <small>{formatDelta(slidingRank, qualifiedRank)}</small>;
        }
        if (singleDay) {
          const dranking = getDayRanking(competition, team, day);
          if (dranking === 0) {
            return '';
          }
        }
        const ranking = getTeamRanking(team, day, singleDay, qualified);
        const previous = getTeamRanking(team, day - 1, singleDay, qualified);
        return <small>{formatDelta(ranking, previous)}</small>;
      },
      sorter: rankingSorter(statDay, statGlobal, statPF),
      showSorterTooltip: false,
      fixed: true,
    },
    {
      title: 'Rating',
      key: 'rating',
      align: 'center',
      width: smallWidth,
      render: (team: Team) => {
        const { rating } = getTeamStats(team, statDay, statGlobal, statPF);
        return rating.mu.toFixed(3);
      },
      sorter: ratingSorter(statDay),
      showSorterTooltip: false,
    },
    {
      title: 'Diff.',
      key: 'difficulty',
      align: 'center',
      width: smallWidth,
      render: (team: Team) => {
        const [mean, stdev] = getTeamOpposition(competition, team, statDay, statGlobal);
        // return `${(100 * mean).toFixed(1)} ±${(100 * stdev).toFixed(1)}`;
        return isNaN(mean) ? '-' : `${(100 * mean).toFixed(1)}%`;
      },
      sorter: (a: Team, b: Team) => {
        const [amean, astdev] = getTeamOpposition(competition, a, statDay, statGlobal);
        const [bmean, bstdev] = getTeamOpposition(competition, b, statDay, statGlobal);
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
        const stats = getTeamStats(team, statDay, statGlobal, statPF);
        if (stats.matchCount === 0) {
          return '-';
        }
        if (statPF) return stats.points;
        const dayCount = singleDay ? 1 : Math.min(day, team.lastDay);
        const isCDF = team.pools.length > 0;
        const coef = isCDF ? 2 : 1;
        return `${Math.round((stats.points * coef * dayCount) / stats.matchCount)}${
          coef * dayCount !== stats.matchCount ? '*' : ''
        }`;
      },
      sorter: rankingSorter(statDay, statGlobal, statPF),
      showSorterTooltip: false,
      hidden: isPF(day),
    },
    {
      title: 'Matchs',
      key: 'matchs',
      align: 'center',
      width: smallWidth,
      render: (team: Team) => {
        const stats = getTeamStats(team, statDay, statGlobal, statPF);
        return `${stats.matchWon} / ${stats.matchCount}`;
      },
      sorter: matchSorter(statDay, statGlobal, statPF),
      showSorterTooltip: false,
    },
    {
      title: 'Sets',
      key: 'sets',
      align: 'center',
      width: mediumWidth,
      render: (team: Team) => {
        const stats = getTeamStats(team, statDay, statGlobal, statPF);
        const sratio = stats.setLost === 0 ? 'MAX' : (stats.setWon / stats.setLost).toFixed(2);
        return `${stats.setWon} / ${stats.setLost} = ${sratio}`;
      },
      sorter: setSorter(statDay, statGlobal, statPF),
      showSorterTooltip: false,
    },
    {
      title: 'Points',
      key: 'points',
      align: 'center',
      width: largeWidth,
      render: (team: Team) => {
        const stats = getTeamStats(team, statDay, statGlobal, statPF);
        const pratio = stats.pointLost === 0 ? 'MAX' : (stats.pointWon / stats.pointLost).toFixed(3);
        return `${stats.pointWon} / ${stats.pointLost} = ${pratio}`;
      },
      sorter: pointSorter(statDay, statGlobal, statPF),
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
          ? `${poolId2Name(team.pools[day].name)}${!isPF(day) && team.pools[day].teams[0] === team ? '*' : ''}`
          : '-';
      },
      sorter: poolSorter(statDay, statGlobal, statPF),
      showSorterTooltip: false,
    },
    {
      title: getDay(day - 1),
      key: 'previous',
      align: 'right',
      width: smallWidth,
      ellipsis: true,
      render: (team: Team) => {
        const dranking = getDayRanking(competition, team, day - 1);
        if (dranking === 0) {
          return '';
        }
        return day >= 1 ? team.ranking.days[day - 1] : '';
      },
      // sorter: day > 1 ? rankingSorter(day - 1, false) : undefined,
      sorter: previousPoolSorter(statDay, statGlobal, statPF),
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
          ? rankingSorter(statDay, statGlobal)(a, b)
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
      render: (team: Team) => <Trophies competition={competition} team={team} selected={selectedTeam} />,
    },
  ];

  // console.log('rendering CompetitionBoard');
  return (
    <div className={cx('vb-board', className)} key={`${day}-${singleDay}-${qualified}-${sliding}`}>
      <Table<Team>
        dataSource={board}
        columns={columns}
        sortDirections={['ascend']}
        pagination={false}
        footer={(data) => <div />}
        scroll={{ y: 1280 }}
        size="small"
        // bordered
        rowClassName={(team: Team, index) =>
          cx({
            'table-row-disabled': !isTeamInCourse(competition, team, day),
            'ant-table-row-selected': selectedKeys.includes(team.id),
          })
        }
        rowKey={(team: Team) => team.id}
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
