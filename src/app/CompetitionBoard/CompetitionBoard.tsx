import { useMemo, useState } from 'react';

import { QuestionCircleOutlined } from '@ant-design/icons';
import { Button, Modal, Segmented, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { SortOrder } from 'antd/es/table/interface';
import cx from 'classnames';

import Trophies from '@/components/Trophies/Trophies';
import { type Competition, type Team } from '@/model/model';
import {
  compareVirtualPoolNames,
  getBoard,
  getDayRanking,
  getSlidingDay,
  getTeamOpposition,
  getTeamRanking,
  getTeamStats,
  isTeamInCourse,
  poolId2Name,
} from '@/model/model-helpers';
import { type PoolApproach, predictPools } from '@/model/model-pools';
import {
  matchSorter,
  pointSorter,
  poolSorter,
  rankingSorter,
  ratingSorter,
  setSorter,
  type SorterParams,
  Sorting,
} from '@/model/model-sorters';
import useClubLocations from '@/utils/useClubLocations';

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

function formatDelta(current: number | undefined, previous: number | undefined): string {
  if (current === undefined) return '';
  if (previous === undefined || previous === 0) return ' ⏴';
  if (current === previous) return '';
  if (current < previous) return ` ⏶ ${previous - current}`;
  return ` ⏷ ${current - previous}`;
}

const approachLabels: Record<PoolApproach, string> = {
  'greedy-geographic': 'Geo',
  'swap-optimization': 'Swap',
  'geographic-clustering': 'Cluster',
};

const CompetitionBoard = ({ competition, day, singleDay, qualified, sliding = 0, className }: Props) => {
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [approach, setApproach] = useState<PoolApproach>('greedy-geographic');
  const [helpOpen, setHelpOpen] = useState(false);
  const [sortKey, setSortKey] = useState<React.Key | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const selectedTeam = selectedKeys.length > 0 ? competition.teams.get(selectedKeys[0] as string) : undefined;
  const isPF = (d: number) => competition.days[d]?.pf;
  const getDay = (d: number) => (competition.days[d]?.pf ? 'PF' : `J${d}`);

  const isPFday = isPF(day);
  const statDay = sliding > 0 ? getSlidingDay(competition, day) : day;
  const statGlobal = sliding > 0 || !singleDay;
  const statPF = sliding > 0 || !!isPFday;
  const statSlidingMaxDays = sliding > 0 ? sliding : 4;
  const statParams: SorterParams = [statDay, statGlobal, statPF, statSlidingMaxDays];

  const { data: clubLocations } = useClubLocations();

  const board = useMemo(
    () => getBoard(competition, Sorting.POINTS, day, singleDay, qualified, sliding),
    [competition, day, singleDay, qualified, sliding],
  );
  const prediction = useMemo(() => {
    if (sliding <= 0 || !clubLocations) return undefined;
    // Don't predict if the current day has no pool data at all
    const dayData = competition.days[day];
    if (!dayData || dayData.pools.size === 0) return undefined;
    return predictPools(competition, day, { approach, clubLocations, enableRoleEquity: true, debug: true });
  }, [sliding, competition, day, approach, clubLocations]);
  const virtualPools = prediction?.poolMap ?? new Map<string, string>();
  const getColumnSortOrder = (key: string): SortOrder => (sortKey === key ? sortOrder : null);
  const slidingRanks = useMemo(
    () => (sliding > 0 ? new Map(board.map((team, index) => [team.id, index + 1])) : new Map<string, number>()),
    [sliding, board],
  );
  const columns: ColumnsType<Team> = [
    {
      title: '',
      colSpan: 0,
      key: 'index',
      align: 'right',
      width: 40,
      render: (team: Team) => {
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
      render: (team: Team) => {
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
      sorter: rankingSorter(...statParams),
      sortOrder: getColumnSortOrder('delta'),
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
      sorter: ratingSorter(...statParams),
      sortOrder: getColumnSortOrder('rating'),
      showSorterTooltip: false,
    },
    {
      title: 'Diff.',
      key: 'difficulty',
      align: 'center',
      width: smallWidth,
      render: (team: Team) => {
        const [mean] = getTeamOpposition(competition, team, statDay, statGlobal);
        // return `${(100 * mean).toFixed(1)} ±${(100 * stdev).toFixed(1)}`;
        return isNaN(mean) ? '-' : `${(100 * mean).toFixed(1)}%`;
      },
      sorter: (a: Team, b: Team) => {
        const [amean, astdev] = getTeamOpposition(competition, a, statDay, statGlobal);
        const [bmean, bstdev] = getTeamOpposition(competition, b, statDay, statGlobal);
        return amean === bmean ? bstdev - astdev : bmean - amean;
      },
      sortOrder: getColumnSortOrder('difficulty'),
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
        if (statPF) return stats.points; // sliding or PF day: raw points only
        // Below is only reachable for regular board view (no sliding, no PF)
        const dayCount = singleDay ? 1 : Math.min(day, team.lastDay);
        const isCDF = team.pools.length > 0;
        const coef = isCDF ? 2 : 1;
        return `${Math.round((stats.points * coef * dayCount) / stats.matchCount)}${
          coef * dayCount !== stats.matchCount ? '*' : ''
        }`;
      },
      sorter: rankingSorter(...statParams),
      sortOrder: getColumnSortOrder('ranking'),
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
      sorter: matchSorter(...statParams),
      sortOrder: getColumnSortOrder('matchs'),
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
      sorter: setSorter(...statParams),
      sortOrder: getColumnSortOrder('sets'),
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
      sorter: pointSorter(...statParams),
      sortOrder: getColumnSortOrder('points'),
      showSorterTooltip: false,
    },
    {
      title: prediction ? 'V.Pool' : 'Pool',
      key: 'pool',
      align: 'center',
      width: smallWidth,
      ellipsis: true,
      render: (team: Team) => {
        if (prediction) {
          const poolName = virtualPools.get(team.id);
          if (!poolName) return '-';
          const isHost = prediction.pools.some((pool) => pool.length > 0 && pool[0] === team);
          return `${poolName}${isHost ? '*' : ''}`;
        }
        return team.pools[day]
          ? `${poolId2Name(team.pools[day].name)}${!isPF(day) && team.pools[day].teams[0] === team ? '*' : ''}`
          : '-';
      },
      sorter: prediction
        ? (a: Team, b: Team) => {
            const poolA = virtualPools.get(a.id) ?? 'zzz';
            const poolB = virtualPools.get(b.id) ?? 'zzz';
            if (poolA !== poolB) return compareVirtualPoolNames(poolA, poolB);
            return board.indexOf(a) - board.indexOf(b);
          }
        : poolSorter(...statParams),
      sortOrder: getColumnSortOrder('pool'),
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
      sortOrder: getColumnSortOrder('previous'),
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
          ? rankingSorter(...statParams)(a, b)
          : a.department.region_name.localeCompare(b.department.region_name),
      sortOrder: getColumnSortOrder('region'),
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

  return (
    <div
      className={cx('vb-board', { 'has-toolbar': sliding > 0 }, className)}
      key={`${day}-${singleDay}-${qualified}-${sliding}`}
    >
      <Table<Team>
        dataSource={board}
        columns={columns}
        sortDirections={['ascend']}
        pagination={false}
        footer={() =>
          sliding > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Segmented
                value={approach}
                onChange={(value) => setApproach(value as PoolApproach)}
                options={Object.entries(approachLabels).map(([value, label]) => ({ value, label }))}
                size="small"
              />
              <Button type="text" size="small" icon={<QuestionCircleOutlined />} onClick={() => setHelpOpen(true)} />
              {prediction && (
                <small style={{ opacity: 0.7 }}>
                  Avg: {Math.round(prediction.metrics.avgPairDistance)} km | Host:{' '}
                  {Math.round(prediction.metrics.avgHostDistance)} km
                  {prediction.metrics.constraintViolations > 0 &&
                    ` | ${prediction.metrics.constraintViolations} violation(s)`}
                </small>
              )}
            </div>
          ) : (
            <div />
          )
        }
        scroll={{ y: 1280 }}
        size="small"
        // bordered
        onChange={(_pagination, _filters, sorter) => {
          const s = Array.isArray(sorter) ? sorter[0] : sorter;
          setSortKey(s.columnKey);
          setSortOrder(s.order ?? null);
        }}
        rowClassName={(team: Team) =>
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
      <Modal
        title="Composition des poules virtuelles"
        open={helpOpen}
        onCancel={() => setHelpOpen(false)}
        footer={null}
        width={640}
      >
        <p>
          Les poules virtuelles simulent la composition des poules pour la prochaine journée en se basant sur le
          classement glissant actuel.
        </p>
        <h4>Règles dures (obligatoires)</h4>
        <ul>
          <li>Deux équipes du même club ne peuvent pas être dans la même poule</li>
          <li>Deux équipes qui se sont déjà rencontrées récemment sont évitées si possible</li>
        </ul>
        <h4>Règles souples (optimisation)</h4>
        <ul>
          <li>Minimiser les distances de déplacement entre les équipes d'une même poule</li>
          <li>Équilibrer le niveau des poules (ratings proches)</li>
          <li>Alterner les rôles recevant/visiteur</li>
        </ul>
        <h4>Algorithmes disponibles</h4>
        <ul>
          <li>
            <strong>Geo</strong> — Approche gloutonne géographique : construit les poules en priorisant la proximité
            géographique
          </li>
          <li>
            <strong>Optimized</strong> — Optimisation par échanges : part d'une solution initiale et améliore par
            échanges successifs entre poules
          </li>
          <li>
            <strong>Cluster</strong> — Clustering géographique : regroupe d'abord les équipes par zone géographique puis
            forme les poules
          </li>
        </ul>
        <p>
          <small>* indique l'équipe receveuse de la poule</small>
        </p>
      </Modal>
    </div>
  );
};

export default CompetitionBoard;
