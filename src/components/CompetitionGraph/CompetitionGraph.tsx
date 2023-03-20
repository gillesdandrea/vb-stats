import { Graphviz } from 'graphviz-react';
import cx from 'classnames';

import { getGraph } from '../../model/graph';
import { Competition, getDayRanking, Match, Team } from '../../model/model';

import './CompetitionGraph.scss';
import { useMemo } from 'react';

interface Props {
  competition: Competition;
  className?: string | string[];
}
const CompetitionGraph = ({ competition, className }: Props) => {
  //   const dot = `graph {
  //     a -- b;
  //     b -- c;
  //     a -- c;
  //     d -- c;
  //     e -- c;
  //     e -- a;
  // }`;
  const dot = useMemo(
    () =>
      getGraph(
        competition,
        (team: Team, index: number) => team.stats.lastDay >= competition.days,
        //
        // (team: Team, index: number) => team.stats.lastDay >= competition.days,
        // (match: Match) => match.day === competition.days,
        //
        // (team: Team, index: number) =>
        //   team.stats.lastDay >= competition.days && getDayRanking(competition, team, competition.days) < 3,
        // (match: Match) => !match.winner,
      ),
    [competition],
  );

  console.log('rendering CompetitionGraph');
  return (
    <div className={cx('vb-graph', className)}>
      <Graphviz
        dot={dot}
        options={{ worker: false, useSharedWorker: false, zoom: true, width: '100vw', height: '100vh', fit: true }}
      />
    </div>
  );
};

export default CompetitionGraph;
