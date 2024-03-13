import { lazy, Suspense, useMemo } from 'react';

import { Layout, Spin } from 'antd';
import cx from 'classnames';

import { getGraph } from '../../model/graph';
import { Competition, Match, Team } from '../../model/model';
import { isTeamInCourse } from '../../model/model-helpers';

import './CompetitionGraph.scss';

const Graphviz = lazy(() => import('../Graphviz/Graphviz'));

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
            useWorker: false,
            zoom: true,
            // @ts-expect-error force width in vw
            width: '100vw',
            // @ts-expect-error force height in vh
            height: '100vh',
            fit: true,
          }}
        />
      </div>
    </Suspense>
  );
};

export default CompetitionGraph;
