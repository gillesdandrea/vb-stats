import { useMemo, useState } from 'react';

import { Alert, Empty, Layout, Select, Space, Spin } from 'antd';
import cx from 'classnames';

import { Competition, Team } from '@/model/model';
import { CSheetStat, CSStats, Licenced, Sheet } from '@/model/sheet';
import { acceptLicences, acceptSomePoint, calcCSStats, filterPointSheets } from '@/model/sheet-helpers';
import useSheets from '@/utils/useSheets';

import './CompetitionSheets.scss';

type CategoryClubSetters = Record<string, Record<string, string[]>>;

const knownSetters: CategoryClubSetters = {
  M21F: {
    // PAYS D'AIX VENELLES V.B.
    '0138032': [
      '2128747', // DORNIC MARTINAYA (14)
      '2193754', // BRUGNEAUX NATALIA (11)
    ],
  },
  '2FA': {
    // PAYS D'AIX VENELLES V.B.
    '0138032': [
      '2128747', // DORNIC MARTINAYA (14)
      '2193754', // BRUGNEAUX NATALIA (11)
    ],
  },
};

interface Props {
  competition: Competition;
  day: number;
  singleDay: boolean;
  qualified: boolean;
  className?: string | string[];
}

const PAD = 12;

const matchStats = (stat: CSheetStat) => {
  const matchs = `matchs: ${stat.matchWon} / ${stat.matchs} (${((100 * stat.matchWon) / stat.matchs).toFixed(1)}%)`;
  const sets = `sets: ${stat.setWon} / ${stat.sets} (${((100 * stat.setWon) / stat.sets).toFixed(1)}%)`;
  const points = `points: ${stat.pointWon} / ${stat.points} (${((100 * stat.pointWon) / stat.points).toFixed(1)}%)`;
  return `${matchs}, ${sets}, ${points}`;
};

const pointsRatio = (stat: CSheetStat) =>
  `${stat.pointWon} / ${stat.pointLost} = ${(stat.pointWon / stat.pointLost).toFixed(3)}`;

const pointsRatioServe = (stat: CSheetStat) => `${(stat.pointWon / stat.pointLost + 1).toFixed(3)} (${stat.pointLost})`;

const pointsRatioS = (stat: CSheetStat) => `${(stat.pointWon / stat.pointLost).toFixed(3)} (${stat.pointLost})`;

const pointsRatioR = (stat: CSheetStat) => `${(stat.pointLost / stat.pointWon).toFixed(3)} (${stat.pointWon})`;

const summary = (csstats: CSStats): string => {
  let buffer = '';
  buffer += `Total: ${pointsRatio(csstats.total).padStart(PAD, ' ')} - ${matchStats(csstats.total)}\n`;
  buffer +=
    `- SRV: ${pointsRatioS(csstats.serve).padStart(PAD, ' ')} | ` +
    csstats.pserves.map((stat, index) => `P${index + 1}: ${pointsRatioS(stat).padStart(PAD, ' ')}`).join(' | ');
  buffer += '\n';
  buffer +=
    `- RCV: ${pointsRatioR(csstats.receive).padStart(PAD, ' ')} | ` +
    csstats.preceives.map((stat, index) => `P${index + 1}: ${pointsRatioR(stat).padStart(PAD, ' ')}`).join(' | ');
  buffer += '\n';
  return buffer;
};

const Spacer = () => <div style={{ height: 12 }} />;

const CompetitionSheets = ({ competition, className }: Props) => {
  const { isLoading, isError, data: teamSheets } = useSheets(competition);

  const [team, setTeam] = useState<Team>();
  const [teamSetters, setTeamSetters] = useState<CategoryClubSetters>(knownSetters);
  const setters = (competition && team && teamSetters[competition.category][team.id]) ?? [];
  const sheets = useMemo(() => (team && teamSheets ? teamSheets[team.id] : []), [team, teamSheets]);

  const teamOptions = useMemo(
    () =>
      Array.from(competition.teams.values())
        .filter((team: Team) => teamSheets && teamSheets[team.id].length > 0)
        .map((team: Team) => ({
          value: team.id,
          label: `${team.name} (${team.department.num_dep})`,
        })),
    [competition, teamSheets],
  );
  const [playerOptions, players] = useMemo(() => {
    if (team && sheets.length > 0) {
      const licenceds = new Map<string, Licenced>();
      sheets.forEach((sheet) => sheet.steam.players.forEach((licenced) => licenceds.set(licenced.licence, licenced)));
      const players = Array.from(licenceds.values()).sort((a: Licenced, b: Licenced) => a.name.localeCompare(b.name));
      return [
        players.map((player) => ({
          value: player.licence,
          label: `${player.licence} - ${player.name} (${player.number})`,
        })),
        players,
      ];
    }
    return [];
  }, [team, sheets]);

  const handleTeamChange = (teamId: string) => {
    setTeam(competition.teams.get(teamId));
  };

  const handleSettersChange = (setters: string[]) => {
    competition &&
      team &&
      setTeamSetters((teamSetters) => ({
        ...teamSetters,
        [competition.category]: {
          ...teamSetters[competition.category],
          [team.id]: setters,
        },
      }));
  };

  const filterOption = (input: string, option?: { label: string; value: string }): boolean =>
    (option?.label ?? '').toLowerCase().includes(input.toLowerCase());

  if (isLoading) {
    return (
      <Spin size="large">
        <Layout style={{ height: '100vh' }} />
      </Spin>
    );
  }

  if (isError) {
    return (
      <Layout style={{ padding: '4rem' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: 'auto' }}
          description="Try another season and/or category."
        />
      </Layout>
    );
  }

  const acceptor = acceptSomePoint(setters.map((setter) => acceptLicences([setter])));
  const sheetsWithSetters = (sheets: Sheet[]) => (setters.length > 0 ? filterPointSheets(sheets, acceptor) : sheets);
  const csstats = calcCSStats(setters, sheets);

  // console.log('rendering CompetitionSheets');
  return (
    <div className={cx('vb-sheets', className)}>
      <h2>
        Stats {competition.category} {competition.season}
      </h2>
      <Spacer />
      <div>Select Team, then Setters</div>
      <Spacer />
      <Space wrap>
        <Select
          style={{ width: '22rem' }}
          showSearch
          placeholder="Select a team..."
          filterOption={filterOption}
          onChange={handleTeamChange}
          value={team?.id}
          options={teamOptions}
        />
        <Select
          disabled={!team}
          mode="multiple"
          style={{ width: '22rem' }}
          showSearch
          placeholder="Select setters"
          filterOption={filterOption}
          onChange={handleSettersChange}
          value={setters}
          options={playerOptions}
        />
      </Space>
      {csstats.incomplete && (
        <>
          <Spacer />
          <Alert
            style={{ maxWidth: '22rem' }}
            message="Points manquants"
            description="Sélectionnez d'autres passeurs pour visualiser tous les points joués."
            type="warning"
            showIcon
          />
        </>
      )}

      <Spacer />
      <div>
        Pour chaque position, au service (SRV), le nombre moyen de points gagnés avant de perdre le service, càd un
        point perdu.
      </div>
      <div>
        Pour chaque position, en réception (RCV), le nombre moyen de points perdus pour récupérer le service, càd un
        point gagné.
      </div>
      <div>Entre () le nombre de fois où la position a eu lieu (séries de services ou réceptions).</div>
      <Spacer />
      <div>Team: {team?.name}</div>
      <div>
        Matchs: {sheets.map((sheet) => sheet.id).join(', ')} ({sheets.length})
      </div>
      <Spacer />
      <Spacer />
      <pre>
        <div>{`Global: ${pointsRatio(csstats.total).padStart(PAD, ' ')} - ${matchStats(csstats.total)}\n\n`}</div>
        <div>{summary(calcCSStats(setters, sheetsWithSetters(sheets)))}</div>
        <Spacer />
        {sheets.map((sheet) => (
          <div key={sheet.id}>
            <div>
              Match {sheet.id}: {sheet.smatch.teamA.name} vs. {sheet.smatch.teamB.name}
            </div>
            <div>{summary(calcCSStats(setters, sheetsWithSetters([sheet])))}</div>
            <Spacer />
          </div>
        ))}
        <Spacer />
        <Spacer />
        {players?.map((licenced: Licenced) => {
          const licCSStats = calcCSStats(
            [licenced.licence],
            filterPointSheets(sheets, acceptLicences([licenced.licence])),
          );
          return (
            <div key={licenced.licence}>
              <div>{`${licenced.name} (${licenced.number})`}:</div>
              <div>Séries services: {pointsRatioServe(licCSStats.pserves[0])}</div>
              <div>PLC: {summary(licCSStats)}</div>
              <div>
                WTH: {summary(calcCSStats(setters, filterPointSheets(sheets, acceptLicences([licenced.licence]))))}
              </div>
              <div>
                W/O: {summary(calcCSStats(setters, filterPointSheets(sheets, acceptLicences([], [licenced.licence]))))}
              </div>
              <Spacer />
            </div>
          );
        })}
      </pre>
    </div>
  );
};

export default CompetitionSheets;
