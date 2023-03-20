import { useState } from 'react';

import type { RadioChangeEvent } from 'antd';
import { Layout, Radio, Result, Select, Space, Spin, Tabs } from 'antd';

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
    return competitionCollection;
  });

  const [season, setSeason] = useState<string>();
  const [category, setCategory] = useState<string>();
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

  console.log('rendering Shell');
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
              <span style={{ fontSize: '1.25rem' }}>{competition?.name}</span>
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
        {competition && <CompetitionBoard className={tab === 'board' ? '' : 'no-display'} competition={competition} />}
        {competition && <CompetitionGraph className={tab === 'graph' ? '' : 'no-display'} competition={competition} />}
      </Layout.Content>
    </Layout>
  );
};

export default Shell;
