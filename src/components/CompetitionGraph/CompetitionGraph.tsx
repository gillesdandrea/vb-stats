import { Suspense, lazy, useMemo } from 'react';

import { Layout, Spin } from 'antd';
import cx from 'classnames';
// import { Graphviz } from 'graphviz-react';

import { getGraph } from '../../model/graph';
import { Competition, Match, Team } from '../../model/model';
import { isTeamInCourse } from '../../model/model-helpers';

import './CompetitionGraph.scss';

const Graphviz = lazy(() => import('./LazyGraphViz'));

interface Props {
  competition: Competition;
  day: number;
  singleDay: boolean;
  qualified: boolean;
  className?: string | string[];
}
const CompetitionGraph = ({ competition, day, singleDay, qualified, className }: Props) => {
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
        day,
        singleDay,
        qualified,
        (team: Team, index: number) => isTeamInCourse(competition, team, day),
        (match: Match) => (singleDay ? match.day === day : match.day <= day),
      ),
    [competition, day, singleDay, qualified],
  );

  // console.log('rendering CompetitionGraph');
  // console.log(dot);
  return (
    <Suspense
      fallback={
        <Spin size="large">
          <Layout style={{ height: '100vh' }} />
        </Spin>
      }
    >
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
    </Suspense>
  );
};

export default CompetitionGraph;
