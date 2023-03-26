import cx from 'classnames';
import { Graphviz } from 'graphviz-react';

import { getGraph } from '../../model/graph';
import { Competition, Match, Team } from '../../model/model';

import { useMemo } from 'react';
import './CompetitionGraph.scss';

interface Props {
  competition: Competition;
  day: number;
  singleDay: boolean;
  className?: string | string[];
}
const CompetitionGraph = ({ competition, day, singleDay, className }: Props) => {
  // const dot = `graph {
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
        (team: Team, index: number) => team.stats.dayCount >= day,
        (match: Match) => (singleDay ? match.day === day : match.day <= day),
      ),
    [competition, day, singleDay],
  );

  // console.log('rendering CompetitionGraph');
  // console.log(dot);
  return (
    <div className={cx('vb-graph', className)}>
      <Graphviz
        dot={dot}
        options={{
          worker: false,
          useSharedWorker: false,
          zoom: true,
          width: '100vw',
          height: '100vh',
          fit: true,
        }}
      />
    </div>
  );
};

export default CompetitionGraph;
