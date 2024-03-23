import { useMemo, useState } from 'react';

import { Layout, Result, Select, Space, Spin } from 'antd';
import cx from 'classnames';

import { Competition, Match, Team } from '../../model/model';
import { CSheetStat, CSStats, Sheet } from '../../model/sheet';
import { acceptLicences, calcCSStats, filterPointSheets } from '../../model/sheet-helpers';
import useSheets from '../../utils/useSheets';

import './CompetitionSheet.scss';

interface Props {
  competition: Competition;
  day: number;
  singleDay: boolean;
  qualified: boolean;
  className?: string | string[];
}

const matchStats = (stat: CSheetStat) => {
  const matchs = `matchs: ${stat.matchWon} / ${stat.matchs} (${((100 * stat.matchWon) / stat.matchs).toFixed(1)}%)`;
  const sets = `sets: ${stat.setWon} / ${stat.sets} (${((100 * stat.setWon) / stat.sets).toFixed(1)}%)`;
  const points = `points: ${stat.pointWon} / ${stat.points} (${((100 * stat.pointWon) / stat.points).toFixed(1)}%)`;
  return `${matchs}, ${sets}, ${points}`;
};

const PAD = 12;

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

const Player = ({
  sheets,
  setters,
  playerName,
  player,
  setterName,
  setter,
}: {
  sheets: Sheet[];
  setters: string[];
  playerName: string;
  player: string;
  setterName?: string;
  setter?: string;
}) => {
  const fsetters = setter
    ? setters.slice(
        0,
        setters.findIndex((set) => set === setter),
      )
    : [];
  return (
    <>
      <Spacer />
      <div>
        {playerName}
        {setter && setterName ? ` (${setterName})` : ''}
      </div>
      <div>
        {summary(
          calcCSStats(
            setters,
            filterPointSheets(
              sheets,
              acceptLicences(setter ? [player, setter] : [player], fsetters), //
            ),
          ),
        )}
      </div>
    </>
  );
};

const CompetitionSheet = ({ competition, day, singleDay, qualified, className }: Props) => {
  const [team, setTeam] = useState<Team>();
  const [match, setMatch] = useState<Match>();

  const filterOption = (input: string, option?: { label: string; value: string }) =>
    (option?.label ?? '').toLowerCase().includes(input.toLowerCase());

  const teams = useMemo(
    () =>
      Array.from(competition.teams.values()).map((team: Team) => ({
        value: team.id,
        label: `${team.name} (${team.department.num_dep})`,
      })),
    [competition],
  );
  const handleTeamChange = (value: string) => {
    setTeam(competition.teams.get(value));
  };

  const matchs = useMemo(
    () =>
      team
        ? team.gstats[competition.dayCount].matchs.map((match: Match) => ({
            value: match.id,
            label: `J${match.day} - ${match.teamA === team ? match.teamB.name : match.teamA.name} (${match.id})`,
          }))
        : [],
    [competition, team],
  );
  const handleMatchChange = (value: string) => {
    const match = team ? team.gstats[competition.dayCount].matchs.find((match) => match.id === value) : undefined;
    setMatch(match);
  };

  const { isLoading, isError, data: teamSheets, error } = useSheets(competition);

  if (isLoading) {
    return (
      <Spin size="large">
        <Layout style={{ height: '100vh' }} />
      </Spin>
    );
  }

  if (isError) {
    return (
      <Layout style={{ height: '100vh' }}>
        <Result
          status="error"
          title="Failed to load data..."
          subTitle={
            <>
              <div>{`No match sheets for ${competition.season} - ${competition.category}`}</div>
              <div>{String(error)}</div>
            </>
          }
        />
      </Layout>
    );
  }

  ///

  // const teamId = '0060036'; // PGVB
  // const teamId = '0060007'; // AS Cannes
  // const teamId = '0138032'; // PAYS D'AIX VENELLES V.B. 2
  // const team = competition.teams.get(teamId);
  // let _team: Team | undefined;
  // competition.teams.forEach((t) => {
  //   if (!_team || _team.sheets.length < t.sheets.length) {
  //     _team = t;
  //   }
  // });

  const Tom = '2309489';
  const Anto = '2212762';
  const Sam = '2191218';
  const Alex = '2460596';
  const Nathan = '2091829';
  const Aless = '2227629';
  const Mady = '2267238';
  const Adrien = '2499328';
  const Loic = '2596850';

  const AlexF = '2194387';
  const Maxim = '2119743';

  const AxelGD = '2052969'; // 01 setter AS Cannes
  const MatteoC = '2153177';
  const Arman = '16';

  const DornicM = '2128747'; // 14 setter PAYS D'AIX VENELLES V.B. 2
  const NataliaB = '2193754'; // 11 setter PAYS D'AIX VENELLES V.B. 2

  // const usheets: Sheet[] = _team?.sheets || [];
  // const setters = [Maxim, Mady, Aless, Nathan];
  const setters = [AxelGD, MatteoC, Nathan, Arman, DornicM, NataliaB];
  // const setters = [DornicM, NataliaB];

  // const sheets = filterMatchSetSheets(usheets, acceptSetWon(false));
  // const sheets = filterMatchSetSheets(usheets, acceptMatchs(['MMA022']));
  const sheets = teamSheets && team ? teamSheets[team.id] : [];
  const csstats = calcCSStats(setters, sheets);

  /*
  console.log(
    'Nathan R4\n',
    summary(
      calcCSStats(
        setters,
        filterPointSheets(
          sheets,
          acceptEveryPoint([
            acceptLicences([Nathan]),
            notPoint(acceptRole(Nathan, Roles.OPP, [Mady, Aless])),
            acceptSomePoint([acceptLicences([Aless]), acceptLicences([Mady])]),
          ]),
        ),
      ),
    ),
  );
  console.log(
    'Nathan R4 ou Po\n',
    summary(
      calcCSStats(
        setters,
        filterPointSheets(
          sheets,
          acceptEveryPoint([
            acceptLicences([Nathan]),
            // notPoint(acceptRole(Nathan, Roles.OPP, [Mady, Aless])),
            acceptSomePoint([acceptLicences([Aless]), acceptLicences([Mady])]),
          ]),
        ),
      ),
    ),
  );
  console.log(
    'Anto (services)\n',
    summary(
      calcCSStats(setters, filterPointSheets(sheets, acceptEveryPoint([acceptServe(), acceptPosition(Anto, 1)]))),
    ),
  );
  console.log(
    'Tom (services)\n',
    summary(calcCSStats(setters, filterPointSheets(sheets, acceptEveryPoint([acceptServe(), acceptPosition(Tom, 1)])))),
  );
  console.log(
    'Sam (services)\n',
    summary(calcCSStats(setters, filterPointSheets(sheets, acceptEveryPoint([acceptServe(), acceptPosition(Sam, 1)])))),
  );
  console.log(
    'Nathan (services)\n',
    summary(
      calcCSStats(setters, filterPointSheets(sheets, acceptEveryPoint([acceptServe(), acceptPosition(Nathan, 1)]))),
    ),
  );
  console.log(
    'Aless (services)\n',
    summary(
      calcCSStats(setters, filterPointSheets(sheets, acceptEveryPoint([acceptServe(), acceptPosition(Aless, 1)]))),
    ),
  );
  console.log(
    'Alex (services)\n',
    summary(
      calcCSStats(setters, filterPointSheets(sheets, acceptEveryPoint([acceptServe(), acceptPosition(Alex, 1)]))),
    ),
  );
  console.log(
    'Adrien (services)\n',
    summary(
      calcCSStats(setters, filterPointSheets(sheets, acceptEveryPoint([acceptServe(), acceptPosition(Adrien, 1)]))),
    ),
  );
  console.log(
    'Loic (services)\n',
    summary(
      calcCSStats(setters, filterPointSheets(sheets, acceptEveryPoint([acceptServe(), acceptPosition(Loic, 1)]))),
    ),
  );
  */

  // console.log('rendering CompetitionSheet');
  // console.log(sheets);

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
        <Select
          disabled={!team}
          style={{ width: '22rem' }}
          showSearch
          placeholder="Select a match..."
          filterOption={filterOption}
          onChange={handleMatchChange}
          options={matchs}
        />
      </Space>
      <Spacer />

      {/*}
      <Upload.Dragger
        name={'file'}
        multiple
        action={(file) => {
          return new Promise((resolve, reject) => {
            //            const ajaxResponseWasFine = true;

            //            setTimeout(() => {
            //              if (ajaxResponseWasFine) {
            const reader = new FileReader();

            reader.addEventListener(
              'load',
              () => {
                const result = reader.result?.toString() || '';
                console.log(atob(result.slice(result.indexOf('base64,'))));
                resolve(result);
              },
              false,
            );

            if (file) {
              reader.readAsDataURL(file);
            }
            //              } else {
            //                reject('error');
            //              }
            //            }, 1000);
          });
        }}
        onChange={(info) => {
          const { status } = info.file;
          if (status !== 'uploading') {
            console.log(info.file, info.fileList);
          }
          if (status === 'done') {
            message.success(`${info.file.name} file uploaded successfully.`);
          } else if (status === 'error') {
            message.error(`${info.file.name} file upload failed.`);
          }
        }}
        onDrop={(e) => {
          console.log('Dropped files', e.dataTransfer.files);
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Click or drag PDF match sheets to this area to upload</p>
        <p className="ant-upload-hint">Support for a single or bulk upload of PDF volleyball match sheets.</p>
      </Upload.Dragger>
      */}
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
        {/*
        <div>Axel:</div>
        <div>{summary(calcCSStats(setters, filterPointSheets(sheets, acceptLicences([AxelGD], []))))}</div>
        <Spacer />
        <div>Nathan:</div>
        <div>{summary(calcCSStats(setters, filterPointSheets(sheets, acceptLicences([Nathan], [AxelGD]))))}</div>
        <Spacer />
        <div>Matteo:</div>
        <div>
          {summary(calcCSStats(setters, filterPointSheets(sheets, acceptLicences([MatteoC], [AxelGD, Nathan]))))}
        </div>
        <Spacer />
        <div>Unknown:</div>
        <div>
          {summary(calcCSStats(setters, filterPointSheets(sheets, acceptLicences([], [AxelGD, Nathan, MatteoC]))))}
        </div>
        <Spacer />

        {/* <div>Aless:</div>
        <div>{summary(calcCSStats(setters, filterPointSheets(sheets, acceptLicences([Aless], [Maxim, Mady]))))}</div>
        <Spacer />
        <div>Nathan:</div>
        <div>
          {summary(calcCSStats(setters, filterPointSheets(sheets, acceptLicences([Nathan], [Maxim, Mady, Aless]))))}
        </div>
        <Spacer />
        <div>Not Nathan:</div>
        <div>
          {summary(
            calcCSStats(
              setters,
              filterPointSheets(sheets, acceptSomePoint([acceptLicences([Mady]), acceptLicences([Aless], [Mady])])),
            ),
          )}
        </div>
        <Spacer />
        <div>Maxim:</div>
        <div>{summary(calcCSStats(setters, filterPointSheets(sheets, acceptLicences([Maxim], []))))}</div>
        <Spacer />
        <div>Mady:</div>
        <div>{summary(calcCSStats(setters, filterPointSheets(sheets, acceptLicences([Mady], [Maxim]))))}</div>
        <Spacer />
        <Spacer />
        <div>Anto, Tom, Sam, (Nathan)</div>
        <div>
          {summary(
            calcCSStats(
              setters,
              filterPointSheets(
                sheets,
                acceptEveryPoint([
                  acceptLicences([Anto, Tom, Sam, Nathan], [Mady, Aless]), //
                  // acceptRole(Tom, Roles.OPP, [Mady, Aless, Nathan]), //
                ]),
              ),
            ),
          )}
        </div>
        <Spacer />
        <div>Anto, Tom, Sam, (Aless)</div>
        <div>
          {summary(
            calcCSStats(
              setters,
              filterPointSheets(
                sheets,
                acceptEveryPoint([
                  acceptLicences([Anto, Tom, Sam, Aless], [Mady]), //
                  // acceptRole(Tom, Roles.OPP, [Mady, Aless, Nathan]), //
                ]),
              ),
            ),
          )}
        </div>
        <Spacer />
        <Player sheets={sheets} setters={setters} playerName="Tom" player={Tom} />
        <Player sheets={sheets} setters={setters} playerName="Tom" player={Tom} setterName="Nathan" setter={Nathan} />
        <Player sheets={sheets} setters={setters} playerName="Tom" player={Tom} setterName="Aless" setter={Aless} />
        <Spacer />
        <Player sheets={sheets} setters={setters} playerName="Anto" player={Anto} />
        <Player sheets={sheets} setters={setters} playerName="Anto" player={Anto} setterName="Nathan" setter={Nathan} />
        <Player sheets={sheets} setters={setters} playerName="Anto" player={Anto} setterName="Aless" setter={Aless} />
        <Spacer />
        <Player sheets={sheets} setters={setters} playerName="Sam" player={Sam} />
        <Player sheets={sheets} setters={setters} playerName="Sam" player={Sam} setterName="Nathan" setter={Nathan} />
        <Player sheets={sheets} setters={setters} playerName="Sam" player={Sam} setterName="Aless" setter={Aless} />
        <Spacer />
        <Spacer />
        <div>Tom:OPP</div>
        <div>
          {summary(
            calcCSStats(
              setters,
              filterPointSheets(
                sheets,
                acceptEveryPoint([
                  // acceptLicences([Anto, Tom, Sam], []), //
                  acceptRole(Tom, Roles.OPP, [Mady, Aless, Nathan]), //
                ]),
              ),
            ),
          )}
        </div>
        <Spacer />
        <div>Tom:OH1</div>
        <div>
          {summary(
            calcCSStats(
              setters,
              filterPointSheets(
                sheets,
                acceptEveryPoint([
                  // acceptLicences([Anto, Tom, Sam], []), //
                  acceptRole(Tom, Roles.OH1, [Mady, Aless, Nathan]), //
                ]),
              ),
            ),
          )}
        </div>
        <Spacer />
        <div>Tom:OH2</div>
        <div>
          {summary(
            calcCSStats(
              setters,
              filterPointSheets(
                sheets,
                acceptEveryPoint([
                  // acceptLicences([Anto, Tom, Sam], []), //
                  acceptRole(Tom, Roles.OH2, [Mady, Aless, Nathan]), //
                ]),
              ),
            ),
          )}
        </div> */}
      </pre>
    </div>
  );
};

export default CompetitionSheet;
