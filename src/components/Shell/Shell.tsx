import { useState } from 'react';

import { Layout, Radio, RadioChangeEvent, Result, Select, Space, Spin, Switch, Tabs } from 'antd';

import { useQuery } from 'react-query';
import { CompetitionCollection } from '../../model/model';
import { createCompetitionCollection, fetchData } from '../../utils/fetch-utils';

import CompetitionBoard from '../CompetitionBoard/CompetitionBoard';
import CompetitionGraph from '../CompetitionGraph/CompetitionGraph';

import './Shell.scss';

const Shell = () => {
  const {
    isLoading,
    isError,
    data: competitions,
    error,
    refetch,
  } = useQuery<CompetitionCollection, Error>(['vbstats-cdf'], async () => {
    const data = await fetchData();
    const seasons = Object.keys(data);
    const season = seasons[0];
    setSeason(season);
    const categories = Object.keys(data[season]);
    const category = categories[0];
    setCategory(category);
    const competitionCollection = createCompetitionCollection(data);
    const competition = competitionCollection[season][category];
    setDay(competition.dayCount);
    return competitionCollection;
  });

  const [season, setSeason] = useState<string>();
  const [category, setCategory] = useState<string>();
  const [day, setDay] = useState<number>(1);
  const [singleDay, setSingleDay] = useState<boolean>(false);

  const [tab, setTab] = useState<string>('board');

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
        <Result status="error" title="Failed to load data..." subTitle={String(error)} />
      </Layout>
    );
  }

  const seasons = Object.keys(competitions ?? {});
  const categories = Object.keys(competitions && season ? competitions[season] : {});
  const competition = competitions && season && category ? competitions[season][category] : undefined;
  const days = competition
    ? Array(competition.dayCount)
        .fill(0)
        .map((_, index) => index + 1)
    : [];

  // console.log('rendering Shell');
  return (
    <Layout style={{ height: '100vh' }}>
      <Layout.Header>
        <Tabs
          size="large"
          defaultActiveKey="board"
          onChange={(key) => setTab(key)}
          items={[
            { key: 'board', label: 'Board' },
            { key: 'graph', label: 'Graph' },
          ]}
          tabBarExtraContent={
            <Space size={'middle'}>
              <span style={{ fontSize: '1rem' }}>{competition?.name}</span>
              <Switch
                checkedChildren={`J${day}`}
                unCheckedChildren="ALL"
                checked={singleDay}
                onChange={setSingleDay}
                size="small"
              />
              <Radio.Group onChange={(e: RadioChangeEvent) => setDay(e.target.value)} defaultValue={day}>
                {days.map((day) => (
                  <Radio.Button key={`J${day}`} value={day}>
                    {`J${day}`}
                  </Radio.Button>
                ))}
              </Radio.Group>
              <Radio.Group onChange={(e: RadioChangeEvent) => setCategory(e.target.value)} defaultValue={category}>
                {categories.map((category) => (
                  <Radio.Button key={category} value={category}>
                    {category}
                  </Radio.Button>
                ))}
              </Radio.Group>
              <Select
                defaultValue={season}
                onChange={(value: string) => setSeason(value)}
                options={seasons.map((season) => ({
                  value: season,
                  label: season,
                }))}
              />
              <span style={{ fontSize: '2rem' }}>🏐</span>
            </Space>
          }
        />
      </Layout.Header>
      <Layout.Content>
        {competition && tab === 'board' && (
          <CompetitionBoard
            // className={tab === 'board' ? '' : 'no-display'}
            competition={competition}
            day={day}
            singleDay={singleDay}
          />
        )}
        {competition && tab === 'graph' && (
          <CompetitionGraph
            // className={tab === 'graph' ? '' : 'no-display'}
            competition={competition}
            day={day}
            singleDay={singleDay}
          />
        )}
      </Layout.Content>
    </Layout>
  );
};

export default Shell;
