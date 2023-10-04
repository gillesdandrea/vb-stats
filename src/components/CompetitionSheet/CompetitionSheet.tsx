import cx from 'classnames';

import { Competition, Sheet } from '../../model/model';
import {
  acceptEveryPoint,
  acceptLicences,
  acceptMatchWon,
  acceptMatchs,
  acceptPosition,
  acceptRole,
  acceptServe,
  acceptSetWon,
  acceptSomePoint,
  calcCSStats,
  filterMatchSetSheets,
  filterPointSheets,
  notPoint,
} from '../../model/sheet-helpers';

import { CSStats, CSheetStat, Roles } from '../../model/sheet';
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
  const teamId = '0060036'; // PGVB
  const team = competition.teams.get(teamId);

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

  const usheets: Sheet[] = team?.sheets || [];
  const setters = [Maxim, Mady, Aless, Nathan];

  // const sheets = filterMatchSetSheets(usheets, acceptSetWon(false));
  // const sheets = filterMatchSetSheets(usheets, acceptMatchs(['MMA022']));
  const sheets = usheets;
  const csstats = calcCSStats(setters, sheets);

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

  // console.log('rendering CompetitionSheet');
  // console.log(sheets);
  return (
    <div className={cx('vb-sheet', className)}>
      <h2>
        Stats CDF {competition.category} {competition.season}
      </h2>
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
      <div>
        Matchs: {sheets.map((sheet) => sheet.match.id).join(', ')} ({sheets.length})
      </div>
      <Spacer />
      <Spacer />
      <pre>
        <div>All Setters:</div>
        <div>{summary(csstats)}</div>
        <Spacer />
        <div>Aless:</div>
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
        </div>
      </pre>
    </div>
  );
};

export default CompetitionSheet;
