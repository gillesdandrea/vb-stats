import { ChangeEventHandler, useCallback, useEffect, useMemo, useRef } from 'react';

import { Col, Empty, Row } from 'antd';
import Search from 'antd/es/input/Search';
import cx from 'classnames';
import debounce from 'lodash/debounce';

import Headroom from '@/components/Headroom/Headroom';
import TeamInfo from '@/components/TeamInfo/TeamInfo';
import { Competition, Team } from '@/model/model';
import { filterTeam, getBoard } from '@/model/model-helpers';
import { Sorting } from '@/model/model-sorters';

import './CompetitionTeams.scss';

interface Props {
  competition: Competition;
  day: number;
  singleDay: boolean;
  qualified: boolean;
  tokens: string[];
  setTokens: (tokens: string[]) => void;
  className?: string | string[];
}

const CompetitionTeams = ({ competition, day, singleDay, qualified, tokens, setTokens, className }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const allTeams = useMemo(
    () => getBoard(competition, Sorting.POINTS, day, singleDay, qualified),
    [competition, day, singleDay, qualified],
  );

  const handleSearch: ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      setTokens(
        event.target.value
          .toLocaleLowerCase()
          .split(' ')
          .filter((token) => token),
      );
    },
    [setTokens],
  );
  const debouncedSearchHandler = useMemo(() => debounce(handleSearch, 300), [handleSearch]);
  // Stop the invocation of the debounced function after unmounting
  useEffect(() => {
    return () => {
      debouncedSearchHandler.cancel();
    };
  });

  const cday = competition.days[day];
  if (!cday) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }
  const teams = allTeams.filter((team: Team) => filterTeam(team, tokens));

  return (
    <div ref={scrollRef} className={cx('vb-teams', className)}>
      <Headroom scrollRef={scrollRef} className="vb-search">
        <Search
          defaultValue={tokens.join(' ')}
          placeholder="Filter teams..."
          allowClear
          onChange={debouncedSearchHandler}
        />
      </Headroom>
      <Row gutter={[24, 24]}>
        {teams.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: 'auto' }} />
        ) : (
          teams.map((team: Team) => {
            return (
              <Col xs={24} sm={24} md={24} lg={12} xl={12} xxl={8} key={team.id} className="vb-team-info">
                <TeamInfo competition={competition} team={team} day={day} />
              </Col>
            );
          })
        )}
      </Row>
    </div>
  );
};

export default CompetitionTeams;
