import cx from 'classnames';

import { Competition, Sheet } from '../../model/model';
import { addCSheetStat, createCSheetStat, getSheetsStats } from '../../model/sheet-helpers';

import './CompetitionSheet.scss';
import { CSheetStat } from '../../model/sheet';

interface Props {
  competition: Competition;
  day: number;
  singleDay: boolean;
  qualified: boolean;
  className?: string | string[];
}

const getPositions = (stat: CSheetStat): string[] => {
  return stat.positionWons
    .map((won, idx) => {
      const lost = stat.positionLosts[idx];
      if (idx === 0) return '';
      if (won === 0 && lost === 0) return '-';
      if (lost === 0) return 'MAX';
      return `${(won / lost).toFixed(3)}`;
    })
    .slice(1);
};

const sum = (arr: number[], idx1: number, idx2: number, idx3: number) => arr[idx1] + arr[idx2] + arr[idx3];

const getFrontBack = (stat: CSheetStat): string[] => {
  const wins = [sum(stat.positionWons, 2, 3, 4), sum(stat.positionWons, 1, 5, 6)];
  const loss = [sum(stat.positionLosts, 2, 3, 4), sum(stat.positionLosts, 1, 5, 6)];

  return wins.map((won, idx) => {
    const lost = loss[idx];
    if (won === 0 && lost === 0) return '-';
    if (lost === 0) return 'MAX';
    return `${(won / lost).toFixed(3)}`;
  });
};

const getSheetNumber = (sheets: Sheet[] = [], whitelic: string[] = [], blacklic: string[] = [], position = false) => {
  const stat = getSheetsStats(sheets, whitelic, blacklic);
  // const positions = position ? ` [${getFrontBack(stat).join(', ')}]` : '';
  const positions = position ? ` [${getFrontBack(stat).join(', ')}]` : '';
  return `${stat.pointWon} / ${stat.pointLost} = ${(stat.pointWon / stat.pointLost).toFixed(3)}${positions}`;
};

const getServeNumber = (sheets: Sheet[] = [], whitelic: string[] = [], blacklic: string[] = []) => {
  const stat = getSheetsStats(sheets, whitelic, blacklic);
  return `${stat.serveWon} / ${stat.serveLost} = ${(stat.serveWon / stat.serveLost).toFixed(3)}`;
};

const getUsage = (sheets: Sheet[] = [], whitelic: string[] = [], blacklic: string[] = []) => {
  const stat = getSheetsStats(sheets, whitelic, blacklic);
  const matchs = `matchs: ${stat.matchWon + stat.matchLost} / ${stat.matchs} (${(
    (100 * (stat.matchWon + stat.matchLost)) /
    stat.matchs
  ).toFixed(1)}%)`;
  const sets = `sets: ${stat.setWon + stat.setLost} / ${stat.sets} (${(
    (100 * (stat.setWon + stat.setLost)) /
    stat.sets
  ).toFixed(1)}%)`;
  const points = `points: ${stat.pointWon + stat.pointLost} / ${stat.points} (${(
    (100 * (stat.pointWon + stat.pointLost)) /
    stat.points
  ).toFixed(1)}%)`;
  return `${matchs}, ${sets}, ${points}`;
};

const Spacer = () => <div style={{ height: 12 }} />;

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

  const sheets = team?.sheets;
  const sstat = getSheetsStats(sheets || [], [Nathan], [Aless, Mady], (csmatch, set, point) => {
    return point.serve;
  });
  const rstat = getSheetsStats(sheets || [], [Nathan], [Aless, Mady], (csmatch, set, point) => {
    return !point.serve;
  });

  const stat = createCSheetStat();
  team?.sheets.forEach((sheet) => {
    addCSheetStat(stat, sheet);
  });

  // console.log('rendering CompetitionSheet');
  console.log(team?.sheets);
  return (
    <pre className={cx('vb-sheet', className)}>
      <div>Stats CDF M15</div>
      <Spacer />
      <div>Ratio points gagnés / perdus, en fonction des joueurs sur le terrain, passeur entre ()</div>
      <div>Entre [] les ratios en ligne avant, ligne arrière</div>
      <Spacer />
      <div>Global: {getSheetNumber(sheets)}</div>
      <div>Global (Nathan): {getSheetNumber(sheets, [Nathan], [Aless, Mady], true)}</div>
      <div>Global (Aless): {getSheetNumber(sheets, [Aless], [Mady], true)}</div>
      <div>Global (Mady): {getSheetNumber(sheets, [Mady], [], true)}</div>
      <Spacer />
      <div>Sam (Nathan): {getSheetNumber(sheets, [Sam, Nathan], [Aless, Mady], true)}</div>
      <div>Sam (Aless): {getSheetNumber(sheets, [Sam, Aless], [Mady], true)}</div>
      <Spacer />
      <div>Tom (Nathan): {getSheetNumber(sheets, [Tom, Nathan], [Aless, Mady], true)}</div>
      <div>Tom (Aless): {getSheetNumber(sheets, [Tom, Aless], [Mady], true)}</div>
      <div>Tom (Mady): {getSheetNumber(sheets, [Tom, Mady], [], true)}</div>
      <Spacer />
      <div>Anto (Nathan): {getSheetNumber(sheets, [Anto, Nathan], [Aless, Mady], true)}</div>
      <div>Anto (Aless): {getSheetNumber(sheets, [Anto, Aless], [Mady], true)}</div>
      <Spacer />
      <div>Alex (Nathan): {getSheetNumber(sheets, [Alex, Nathan], [Aless, Mady], true)}</div>
      <div>Alex (Aless): {getSheetNumber(sheets, [Alex, Aless], [Mady], true)}</div>
      <Spacer />
      <div>Nathan (Aless): {getSheetNumber(sheets, [Nathan, Aless], [Mady], true)}</div>
      <Spacer />
      <Spacer />
      <div>Anto, Tom, Sam (Nathan): {getSheetNumber(sheets, [Anto, Tom, Sam, Nathan], [Aless, Mady])}</div>
      <div>Anto, Tom, Sam (Aless): {getSheetNumber(sheets, [Anto, Tom, Sam, Aless], [Mady])}</div>
      <Spacer />
      <div>Anto, Tom, Alex (Nathan): {getSheetNumber(sheets, [Anto, Tom, Alex, Nathan], [Aless, Mady])}</div>
      <div>Anto, Tom, Alex (Aless): {getSheetNumber(sheets, [Anto, Tom, Alex, Aless], [Mady])}</div>
      <Spacer />
      <div>Sam: {getSheetNumber(sheets, [Sam], [], true)}</div>
      <div>Sans Sam: {getSheetNumber(sheets, [], [Sam])}</div>
      {/* <Spacer />
      <div>Sans Sam {getSheetNumber(sheets, [], [Sam])}</div>
      <div>Sans Sam (Nathan) {getSheetNumber(sheets, [Nathan], [Sam, Aless, Mady])}</div>
      <div>Sans Sam (Aless) {getSheetNumber(sheets, [Aless], [Sam])}</div>
      <Spacer />
      <div>Sans Tom {getSheetNumber(sheets, [], [Tom])}</div>
      <div>Sans Tom (Nathan) {getSheetNumber(sheets, [Nathan], [Tom, Aless, Mady])}</div>
      <div>Sans Tom (Aless) {getSheetNumber(sheets, [Aless], [Tom])}</div>
      <Spacer />
      <div>Sans Anto {getSheetNumber(sheets, [], [Anto])}</div>
      <div>Sans Anto (Nathan) {getSheetNumber(sheets, [Nathan], [Anto, Aless, Mady])}</div>
      <div>Sans Anto (Aless) {getSheetNumber(sheets, [Aless], [Anto])}</div>
      <Spacer />
      <div>Anto, Tom, Sans Sam (Nathan) {getSheetNumber(sheets, [Anto, Tom, Nathan], [Aless, Mady, Sam])}</div>
      <Spacer /> */}
      <Spacer />
      <div>Ratio services gagnés / perdus :</div>
      <Spacer />
      <div>Nathan (serve): {getServeNumber(sheets, [Nathan])}</div>
      <div>Tom (serve): {getServeNumber(sheets, [Tom])}</div>
      <div>Anto (serve): {getServeNumber(sheets, [Anto])}</div>
      <div>Aless (serve): {getServeNumber(sheets, [Aless])}</div>
      <div>Sam (serve): {getServeNumber(sheets, [Sam])}</div>
      <div>Alex (serve): {getServeNumber(sheets, [Alex])}</div>
      <Spacer />
      <Spacer />
      <div>Participation :</div>
      <Spacer />
      <div>Global : {getUsage(sheets)}</div>
      <div>Sam : {getUsage(sheets, [Sam])}</div>
      <div>Tom : {getUsage(sheets, [Tom])}</div>
      <div>Anto : {getUsage(sheets, [Anto])}</div>
      <div>Alex : {getUsage(sheets, [Alex])}</div>
      <div>Nathan : {getUsage(sheets, [Nathan])}</div>
      <div>(Nathan) : {getUsage(sheets, [Nathan], [Aless, Mady])}</div>
      <div>(Aless) : {getUsage(sheets, [Aless])}</div>
      {/* <div>{`${stat.pointWon} / ${stat.pointLost} = ${(stat.pointWon / stat.pointLost).toFixed(3)}`}</div>
      {JSON.stringify(stat, null, 2)}
      <hr />
      {JSON.stringify(sheets, null, 2)} */}
    </pre>
  );
};

export default CompetitionSheet;
