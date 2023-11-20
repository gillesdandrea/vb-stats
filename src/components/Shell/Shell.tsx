import { useEffect, useState } from 'react';

import { CalendarOutlined, CheckOutlined, MenuOutlined, SettingOutlined, TeamOutlined } from '@ant-design/icons';
import { Layout, Menu, MenuProps, Radio, RadioChangeEvent, Result, Select, Space, Spin, Switch, Tabs } from 'antd';

import { useQuery } from 'react-query';
import { CompetitionCollection } from '../../model/model';
import { createCompetitionCollection, fetchData, fetchSheets } from '../../utils/fetch-utils';

import CompetitionBoard from '../CompetitionBoard/CompetitionBoard';
import CompetitionGraph from '../CompetitionGraph/CompetitionGraph';
import CompetitionPools from '../CompetitionPools/CompetitionPools';

import { ReactComponent as VBStatsLogo } from './vb-stats-logo.svg';
import './Shell.scss';

const Checked = ({ checked }: { checked?: boolean }) =>
  checked ? <CheckOutlined /> : <span role="img" aria-label="none" className="anticon ant-menu-item-icon" />;

const parseQueryParameters = (url: string): Record<string, string> => {
  const regex = /[?&]([^=#]+)=([^&#]*)/g;
  const params: Record<string, string> = {};
  let match;
  while ((match = regex.exec(url))) {
    params[match[1]] = match[2];
  }
  return params;
};

type MenuItem = Required<MenuProps>['items'][number];

const getItem = (
  label: React.ReactNode,
  key?: React.Key | null,
  icon?: React.ReactNode,
  children?: MenuItem[],
  type?: 'group',
  disabled?: boolean,
): MenuItem => {
  return {
    key,
    icon,
    children,
    label,
    type,
    disabled,
  } as MenuItem;
};

const Shell = () => {
  const params = parseQueryParameters(window.location.search);

  const [fetched, setFetched] = useState<boolean>(false);
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
    setDayCount(competition.dayCount);
    setDay(Number.isNaN(day) ? competition.dayCount : day);
    setFetched(true);
    return competitionCollection;
  });

  const pday: number = Number.parseInt(params.day);
  const [season, setSeason] = useState<string>(params.season);
  const [category, setCategory] = useState<string>(params.category);
  const [dayCount, setDayCount] = useState<number>(-1);
  const [day, setDay] = useState<number>(Number.isNaN(pday) ? 0 : pday);
  const [singleDay, setSingleDay] = useState<boolean>(params.singleDay === 'true'); // OVERALL - J0x (default false)
  const [qualified, setQualified] = useState<boolean>(params.qualified !== 'false'); // ALL TEAMS - QUALIFIED (default true)

  const [tab, setTab] = useState<string>(params.tab ?? 'pools');

  useEffect(() => {
    if (day > 0 && fetched) {
      window.history.replaceState(
        {},
        '',
        `/vb-stats?tab=${tab}${season ? `&season=${season}` : ''}${category ? `&category=${category}` : ''}${
          day ? `&day=${day === dayCount ? 'last' : day}` : ''
        }&singleDay=${!!singleDay}&qualified=${!!qualified}`,
      );
    }
  }, [fetched, tab, season, category, dayCount, day, singleDay, qualified]);

  // const handleTabChange = (key: string) => {
  //   if (key === 'graph' && !qualified) {
  //     setQualified(true);
  //   }
  //   setTab(key);
  // };

  // const setOverall = (toggle: boolean) => {
  //   setSingleDay(toggle);
  //   if (toggle && !qualified) {
  //     setQualified(true);
  //   }
  // };

  if (isLoading || day === 0) {
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
  const competition = competitions && categories.length > 0 && category ? competitions[season][category] : undefined;
  const days = competition
    ? Array(competition.dayCount)
        .fill(0)
        .map((_, index) => index + 1)
    : [];

  if (competition && competition.dayCount !== dayCount) {
    setDayCount(competition.dayCount);
    if (params.day === 'last' && day !== competition.dayCount) {
      console.log(competition.dayCount);
      setDay(competition.dayCount);
      return <div />;
    }
  }

  if (competition && day > competition.dayCount) {
    console.log(competition.dayCount);
    setDay(competition.dayCount);
    return <div />;
  }

  if (!categories.includes(category)) {
    setCategory(categories[0]);
    return <div />;
  }

  const onClick: MenuProps['onClick'] = (e) => {
    if (e.keyPath.length === 1) {
      // main menu
      setTab(e.key);
      if (e.key === 'graph' && !qualified) {
        setQualified(true);
      }
    } else {
      // sub menu
      switch (e.keyPath[e.keyPath.length - 1]) {
        case 'day':
          const nday = Number.parseInt(e.key);
          if (Number.isInteger(nday)) {
            setDay(nday);
          } else {
            switch (e.key) {
              case 'qualified':
                setQualified(true);
                setSingleDay(false);
                break;
              case 'overall':
                setQualified(false);
                setSingleDay(false);
                break;
              case 'single-day':
                setQualified(true);
                setSingleDay(true);
                break;
            }
          }
          break;
        case 'category':
          setCategory(e.key);
          break;
        case 'season':
          setSeason(e.key);
          break;
      }
    }
  };

  const isCDF = competition && competition.days[1] && competition.days[1].pools.size > 0;
  const items: MenuItem[] = [
    getItem('Pools', 'pools'),
    getItem('Board', 'board'),
    getItem('Graph', 'graph'),
    getItem(`J${day}`, 'day', <CalendarOutlined />, [
      getItem(
        'Day',
        'day',
        <CalendarOutlined />,
        days.map((cday) => getItem(`J${cday}`, cday, cday === day ? <CalendarOutlined /> : <Checked />)),
        'group',
      ),
      getItem(
        'Options',
        'options',
        <SettingOutlined />,
        [
          getItem(
            `Selected day (J${day})`,
            'single-day',
            <Checked checked={singleDay} />,
            undefined,
            undefined,
            tab === 'pools',
          ),
          getItem(
            'Qualified teams',
            'qualified',
            <Checked checked={!singleDay && qualified} />,
            undefined,
            undefined,
            tab === 'pools',
          ),
          getItem(
            'All teams',
            'overall',
            <Checked checked={!singleDay && !qualified} />,
            undefined,
            undefined,
            tab === 'pools' || tab === 'graph',
          ),
        ],
        'group',
      ),
    ]),
    getItem(
      `${isCDF ? 'CDF ' : ''}${category}`,
      'category',
      undefined, // <TeamOutlined />,
      categories.map((ccategory) =>
        getItem(ccategory, ccategory, ccategory === category ? <TeamOutlined /> : <Checked />),
      ),
    ),
    getItem(
      season,
      'season',
      undefined, // <CalendarOutlined />,
      seasons.map((cseason) => getItem(cseason, cseason, cseason === season ? <CalendarOutlined /> : <Checked />)),
    ),
    // getItem(undefined, 'settings', <SettingOutlined />, [
    //   getItem('Qualified teams', 'qualified', <Checked checked={qualified} />),
    //   getItem('All teams', 'overall', <Checked checked={!singleDay && !qualified} />),
    //   getItem(`Selected day (J${day})`, 'single-day', <Checked checked={singleDay} />),
    // ]),
  ];

  // console.log('rendering Shell');
  return (
    <Layout className="vb-shell">
      <VBStatsLogo className="vb-stats-logo" style={{ width: '4rem', height: '4rem' }} />
      <Layout.Header>
        <Menu
          onClick={onClick}
          defaultSelectedKeys={[tab]}
          selectedKeys={[tab]}
          mode="horizontal"
          items={items}
          overflowedIndicator={<MenuOutlined />}
          triggerSubMenuAction="click"
        />
        {/* <Tabs
          size="large"
          activeKey={tab}
          onChange={handleTabChange}
          items={[
            { key: 'pools', label: 'Pools' },
            { key: 'board', label: 'Board' },
            { key: 'graph', label: 'Graph' },
            //{ key: 'sheet', label: 'Sheet' },
          ]}
          tabBarExtraContent={
            <Space size={'middle'}>
              <span style={{ fontSize: '1rem' }}>{competition?.name}</span>
              <Switch
                checkedChildren={`J${day}`}
                unCheckedChildren="OVERALL"
                checked={singleDay}
                onChange={setOverall}
                disabled={tab === 'pools'}
                size="small"
              />
              <Switch
                checkedChildren="QUALIFIED"
                unCheckedChildren="ALL TEAMS"
                checked={qualified}
                onChange={setQualified}
                disabled={singleDay || tab === 'pools' || tab === 'graph'}
                size="small"
              />
              <Radio.Group onChange={(e: RadioChangeEvent) => setDay(e.target.value)} value={day} buttonStyle="solid">
                {days.map((day) => (
                  <Radio.Button key={`J${day}`} value={day}>
                    {`J${day}`}
                  </Radio.Button>
                ))}
              </Radio.Group>
              {/* <Radio.Group
                onChange={(e: RadioChangeEvent) => setCategory(e.target.value)}
                value={category}
                buttonStyle="solid"
              >
                {categories.map((category) => (
                  <Radio.Button key={category} value={category}>
                    {category}
                  </Radio.Button>
                ))}
              </Radio.Group> * /}
              <Select
                value={category}
                onChange={setCategory}
                options={categories.map((category) => ({
                  value: category,
                  label: category,
                }))}
              />
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
        /> */}
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
        {competition && tab === 'pools' && (
          <CompetitionPools
            // className={tab === 'pools' ? '' : 'no-display'}
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
        {/*competition && tab === 'sheet' && (
          <CompetitionSheet
            // className={tab === 'graph' ? '' : 'no-display'}
            competition={competition}
            day={day}
            singleDay={singleDay}
            qualified={qualified}
          />
        )*/}
      </Layout.Content>
    </Layout>
  );
};

export default Shell;
