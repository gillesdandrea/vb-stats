import { useMemo, useState } from 'react';

import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import cx from 'classnames';

import Trophies from '@/components/Trophies/Trophies';
import { type Competition, type Team } from '@/model/model';
import {
  computeVirtualPools,
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
  sliding?: number;
  className?: string | string[];
}

const smallWidth = 70;
const mediumWidth = 100;
const largeWidth = 120;

function getRankingLabel(sliding: number, singleDay: boolean): string {
  if (sliding > 0) return `Last ${sliding}`;
  if (singleDay) return 'Daily';
  return 'Global';
}

function formatDelta(current: number, previous: number | undefined): string {
  if (!previous) return ' ⏴';
  if (current === previous) return '';
  if (current < previous) return ` ⏶ ${previous - current}`;
  return ` ⏷ ${current - previous}`;
}

const CompetitionBoard = ({ competition, day, singleDay, qualified, sliding = 0, className }: Props) => {
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const selectedTeam = selectedKeys.length > 0 ? competition.teams.get(selectedKeys[0] as string) : undefined;
  const isPF = (d: number) => competition.days[d]?.pf;
  const getDay = (d: number) => (competition.days[d]?.pf ? 'PF' : `J${d}`);

  const isPFday = isPF(day);
  const statDay = sliding > 0 ? getSlidingDay(competition, day) : day;
  const statGlobal = sliding > 0 || !singleDay;
  const statPF = sliding > 0 || !!isPFday;
  const statSlidingMaxDays = sliding > 0 ? sliding : 4;

  const board = useMemo(
    () => getBoard(competition, Sorting.POINTS, day, singleDay, qualified, sliding),
    [competition, day, singleDay, qualified, sliding],
  );
  const virtualPools = useMemo(
    () => (sliding > 0 ? computeVirtualPools(board) : new Map<string, string>()),
    [sliding, board],
  );
  const slidingRanks = useMemo(
    () => (sliding > 0 ? new Map(board.map((team, index) => [team.id, index + 1])) : new Map<string, number>()),
    [sliding, board],
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
        if (sliding > 0) {
          return slidingRanks.get(team.id) ?? '-';
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
        if (sliding > 0) {
          const slidingRank = slidingRanks.get(team.id) ?? 0;
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
      sorter: rankingSorter(statDay, statGlobal, statPF, statSlidingMaxDays),
      showSorterTooltip: false,
      fixed: true,
    },
    {
      title: 'Rating',
      key: 'rating',
      align: 'center',
      width: smallWidth,
      render: (team: Team) => {
        const { rating } = getTeamStats(team, statDay, statGlobal, statPF, statSlidingMaxDays);
        return rating.mu.toFixed(3);
      },
      sorter: ratingSorter(statDay, statGlobal, statPF, statSlidingMaxDays),
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
      title: 'M.Pts',
      key: 'ranking',
      align: 'center',
      width: smallWidth,
      render: (team: Team) => {
        const stats = getTeamStats(team, statDay, statGlobal, statPF, statSlidingMaxDays);
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
      sorter: rankingSorter(statDay, statGlobal, statPF, statSlidingMaxDays),
      showSorterTooltip: false,
      hidden: isPF(day),
    },
    {
      title: 'Matchs',
      key: 'matchs',
      align: 'center',
      width: smallWidth,
      render: (team: Team) => {
        const stats = getTeamStats(team, statDay, statGlobal, statPF, statSlidingMaxDays);
        return `${stats.matchWon} / ${stats.matchCount}`;
      },
      sorter: matchSorter(statDay, statGlobal, statPF, statSlidingMaxDays),
      showSorterTooltip: false,
    },
    {
      title: 'Sets',
      key: 'sets',
      align: 'center',
      width: mediumWidth,
      render: (team: Team) => {
        const stats = getTeamStats(team, statDay, statGlobal, statPF, statSlidingMaxDays);
        const sratio = stats.setLost === 0 ? 'MAX' : (stats.setWon / stats.setLost).toFixed(2);
        return `${stats.setWon} / ${stats.setLost} = ${sratio}`;
      },
      sorter: setSorter(statDay, statGlobal, statPF, statSlidingMaxDays),
      showSorterTooltip: false,
    },
    {
      title: 'Points',
      key: 'points',
      align: 'center',
      width: largeWidth,
      render: (team: Team) => {
        const stats = getTeamStats(team, statDay, statGlobal, statPF, statSlidingMaxDays);
        const pratio = stats.pointLost === 0 ? 'MAX' : (stats.pointWon / stats.pointLost).toFixed(3);
        return `${stats.pointWon} / ${stats.pointLost} = ${pratio}`;
      },
      sorter: pointSorter(statDay, statGlobal, statPF, statSlidingMaxDays),
      showSorterTooltip: false,
    },
    {
      title: sliding > 0 ? 'V.Pool' : 'Pool',
      key: 'pool',
      align: 'center',
      width: smallWidth,
      ellipsis: true,
      render: (team: Team) => {
        if (sliding > 0) {
          return virtualPools.get(team.id) ?? '-';
        }
        return team.pools[day]
          ? `${poolId2Name(team.pools[day].name)}${!isPF(day) && team.pools[day].teams[0] === team ? '*' : ''}`
          : '-';
      },
      sorter:
        sliding > 0
          ? (a: Team, b: Team) => {
              const poolA = virtualPools.get(a.id) ?? 'zzz';
              const poolB = virtualPools.get(b.id) ?? 'zzz';
              if (poolA !== poolB) return poolA.localeCompare(poolB);
              return board.indexOf(a) - board.indexOf(b);
            }
          : poolSorter(statDay, statGlobal, statPF, statSlidingMaxDays),
      showSorterTooltip: false,
    },
    {
      title: day <= 1 ? '-' : getDay(day - 1),
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
      sorter: (a: Team, b: Team) => {
        const aRank = a.ranking.days[day - 1] ?? Infinity;
        const bRank = b.ranking.days[day - 1] ?? Infinity;
        return aRank - bRank;
      },
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
          ? rankingSorter(statDay, statGlobal, statPF, statSlidingMaxDays)(a, b)
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
