import { useEffect, useState } from 'react';

import { Layout, Radio, RadioChangeEvent, Result, Select, Space, Spin, Switch, Tabs } from 'antd';

import { useQuery } from 'react-query';
import { CompetitionCollection } from '../../model/model';
import { createCompetitionCollection, fetchData, fetchSheets } from '../../utils/fetch-utils';

import CompetitionBoard from '../CompetitionBoard/CompetitionBoard';
import CompetitionGraph from '../CompetitionGraph/CompetitionGraph';
import CompetitionSheet from '../CompetitionSheet/CompetitionSheet';

import './Shell.scss';

const parseQueryParameters = (url: string): Record<string, string> => {
  const regex = /[?&]([^=#]+)=([^&#]*)/g;
  const params: Record<string, string> = {};
  let match;
  while ((match = regex.exec(url))) {
    params[match[1]] = match[2];
  }
  return params;
};

const Shell = () => {
  const params = parseQueryParameters(window.location.search);

  const {
    isLoading,
    isError,
    data: competitions,
    error,
    refetch,
  } = useQuery<CompetitionCollection, Error>(['vbstats-cdf'], async () => {
    const data = await fetchData();
    const sheets = await fetchSheets();
    const seasons = Object.keys(data);
    const season = params.season ?? seasons[0];
    setSeason(season);
    const categories = Object.keys(data[season]);
    const category = params.category ?? categories[0];
    setCategory(category);
    const competitionCollection = createCompetitionCollection(data, sheets);
    const competition = competitionCollection[season][category];
    const day: number = Number.parseInt(params.day);
    setDay(Number.isNaN(day) ? competition.dayCount : day);
    return competitionCollection;
  });

  const pday: number = Number.parseInt(params.day);
  const [season, setSeason] = useState<string>(params.season);
  const [category, setCategory] = useState<string>(params.category);
  const [day, setDay] = useState<number>(Number.isNaN(pday) ? 1 : pday);
  const [singleDay, setSingleDay] = useState<boolean>(params.singleDay === 'true'); // OVERALL - J0x (default false)
  const [qualified, setQualified] = useState<boolean>(params.qualified !== 'false'); // ALL TEAMS - QUALIFIED (default true)

  const [tab, setTab] = useState<string>(params.tab ?? 'board');

  useEffect(() => {
    window.history.replaceState(
      {},
      '',
      `/vb-stats?tab=${tab}&season=${season}&category=${category}&day=${day}&singleDay=${!!singleDay}&qualified=${!!qualified}`,
    );
  }, [tab, season, category, day, singleDay, qualified]);

  const handleTabChange = (key: string) => {
    if (key === 'graph' && !qualified) {
      setQualified(true);
    }
    setTab(key);
  };

  const setOverall = (toggle: boolean) => {
    setSingleDay(toggle);
    if (toggle && !qualified) {
      setQualified(true);
    }
  };

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
  const categories = Object.keys((competitions && season ? competitions[season] : {}) ?? {});
  const competition = competitions && season && category ? competitions[season][category] : undefined;
  const days = competition
    ? Array(competition.dayCount)
        .fill(0)
        .map((_, index) => index + 1)
    : [];

  if (competition && day > competition.dayCount) {
    setDay(competition.dayCount);
    return <div />;
  }

  // console.log('rendering Shell');
  return (
    <Layout style={{ height: '100vh' }}>
      <Layout.Header>
        <Tabs
          size="large"
          activeKey={tab}
          onChange={handleTabChange}
          items={[
            { key: 'board', label: 'Board' },
            { key: 'graph', label: 'Graph' },
            { key: 'sheet', label: 'Sheet' },
          ]}
          tabBarExtraContent={
            <Space size={'middle'}>
              <span style={{ fontSize: '1rem' }}>{competition?.name}</span>
              <Switch
                checkedChildren={`J${day}`}
                unCheckedChildren="OVERALL"
                checked={singleDay}
                onChange={setOverall}
                size="small"
              />
              <Switch
                checkedChildren="QUALIFIED"
                unCheckedChildren="ALL TEAMS"
                checked={qualified}
                onChange={setQualified}
                disabled={singleDay || tab === 'graph'}
                size="small"
              />
              <Radio.Group onChange={(e: RadioChangeEvent) => setDay(e.target.value)} value={day} buttonStyle="solid">
                {days.map((day) => (
                  <Radio.Button key={`J${day}`} value={day}>
                    {`J${day}`}
                  </Radio.Button>
                ))}
              </Radio.Group>
              <Radio.Group
                onChange={(e: RadioChangeEvent) => setCategory(e.target.value)}
                value={category}
                buttonStyle="solid"
              >
                {categories.map((category) => (
                  <Radio.Button key={category} value={category}>
                    {category}
                  </Radio.Button>
                ))}
              </Radio.Group>
              <Select
                value={season}
                onChange={setSeason}
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
            qualified={qualified}
          />
        )}
        {competition && tab === 'graph' && (
          <CompetitionGraph
            // className={tab === 'graph' ? '' : 'no-display'}
            competition={competition}
            day={day}
            singleDay={singleDay}
            qualified={qualified}
          />
        )}
        {competition && tab === 'sheet' && (
          <CompetitionSheet
            // className={tab === 'graph' ? '' : 'no-display'}
            competition={competition}
            day={day}
            singleDay={singleDay}
            qualified={qualified}
          />
        )}
      </Layout.Content>
    </Layout>
  );
};

export default Shell;
