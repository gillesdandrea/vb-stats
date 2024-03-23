import { useMemo, useState } from 'react';

import { Empty, Layout, Select, Space, Spin } from 'antd';
import cx from 'classnames';

import { Competition, Team } from '@/model/model';
import { CSheetStat, CSStats } from '@/model/sheet';
import { calcCSStats } from '@/model/sheet-helpers';
import useSheets from '@/utils/useSheets';

import './CompetitionSheet.scss';

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

const CompetitionSheet = ({ competition, className }: Props) => {
  const [team, setTeam] = useState<Team>();
  // const [match, setMatch] = useState<Match>();

  const { isLoading, isError, data: teamSheets } = useSheets(competition);
  console.log(teamSheets);

  const filterOption = (input: string, option?: { label: string; value: string }) =>
    (option?.label ?? '').toLowerCase().includes(input.toLowerCase());

  const teams = useMemo(
    () =>
      Array.from(competition.teams.values())
        .filter((team) => teamSheets && teamSheets[team.id].length > 0)
        .map((team: Team) => ({
          value: team.id,
          label: `${team.name} (${team.department.num_dep})`,
        })),
    [competition, teamSheets],
  );
  const handleTeamChange = (value: string) => {
    setTeam(competition.teams.get(value));
  };

  // const matchs = useMemo(
  //   () =>
  //     team
  //       ? team.gstats[competition.dayCount].matchs.map((match: Match) => ({
  //           value: match.id,
  //           label: `J${match.day} - ${match.teamA === team ? match.teamB.name : match.teamA.name} (${match.id})`,
  //         }))
  //       : [],
  //   [competition, team],
  // );
  // const handleMatchChange = (value: string) => {
  //   const match = team ? team.gstats[competition.dayCount].matchs.find((match) => match.id === value) : undefined;
  //   setMatch(match);
  // };

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

  ///

  const Nathan = '2091829';
  const AxelGD = '2052969'; // 01 setter AS Cannes
  const MatteoC = '2153177';
  const Arman = '16';

  const DornicM = '2128747'; // 14 setter PAYS D'AIX VENELLES V.B. 2
  const NataliaB = '2193754'; // 11 setter PAYS D'AIX VENELLES V.B. 2

  const setters = [AxelGD, MatteoC, Nathan, Arman, DornicM, NataliaB];

  const sheets = teamSheets && team ? teamSheets[team.id] : [];
  const csstats = calcCSStats(setters, sheets);

  // console.log('rendering CompetitionSheet');
  return (
    <div className={cx('vb-sheet', className)}>
      <h2>
        Stats {competition.category} {competition.season}
      </h2>
      <Spacer />
      <div>Select Team, Match, Setters</div>
      <Spacer />
      <Space wrap>
        <Select
          style={{ width: '22rem' }}
          showSearch
          placeholder="Select a team..."
          filterOption={filterOption}
          onChange={handleTeamChange}
          options={teams}
        />
        {/* <Select
          disabled={!team}
          style={{ width: '22rem' }}
          showSearch
          placeholder="Select a match..."
          filterOption={filterOption}
          onChange={handleMatchChange}
          options={matchs}
        /> */}
      </Space>
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
        <div>Global:</div>
        <div>{summary(csstats)}</div>
        <Spacer />
        {sheets.map((sheet) => (
          <div key={sheet.id}>
            <div>
              Match {sheet.id}: {sheet.smatch.teamA.name} vs. {sheet.smatch.teamB.name}
            </div>
            <div>{summary(calcCSStats(setters, [sheet]))}</div>
            <Spacer />
          </div>
        ))}
      </pre>
    </div>
  );
};

export default CompetitionSheet;
