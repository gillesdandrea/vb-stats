import { useMemo, useState } from 'react';

import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import cx from 'classnames';

import Trophies from '../../components/Trophies/Trophies';
import { Competition, Team } from '../../model/model';
import {
  getBoard,
  getDayRanking,
  getTeamOpposition,
  getTeamRanking,
  getTeamStats,
  isTeamInCourse,
  poolId2Name,
} from '../../model/model-helpers';
import {
  pointSorter,
  poolSorter,
  previousPoolSorter,
  rankingSorter,
  ratingSorter,
  setSorter,
  Sorting,
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
      title: singleDay ? 'Daily' : 'Global',
      colSpan: 2,
      key: 'delta',
      align: 'left',
      width: 40,
      render: (team: Team, item, index) => {
        if (day === 1) {
          return '';
        }
        if (singleDay) {
          const dranking = getDayRanking(competition, team, day);
          if (dranking === 0) {
            return '';
          }
        }
        const ranking = getTeamRanking(team, day, singleDay, qualified);
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
        return isNaN(mean) ? '-' : `${(100 * mean).toFixed(1)}%`;
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
        const isCDF = team.pools.length > 0;
        const coef = isCDF ? 2 : 1;
        return `${Math.round((stats.points * coef * dayCount) / stats.matchCount)}${
          coef * dayCount !== stats.matchCount ? '*' : ''
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
      render: (team: Team) => {
        const dranking = getDayRanking(competition, team, day - 1);
        if (dranking === 0) {
          return '';
        }
        return day >= 1 ? team.ranking.days[day - 1] : '';
      },
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
      render: (team: Team) => <Trophies competition={competition} team={team} selected={selectedTeam} />,
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
