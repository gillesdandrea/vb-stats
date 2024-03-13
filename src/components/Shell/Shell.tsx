import { lazy, Suspense, useEffect, useState } from 'react';

import { CalendarOutlined, CheckOutlined, MenuOutlined, SettingOutlined, TeamOutlined } from '@ant-design/icons';
import { Layout, Menu, MenuProps, Result, Spin } from 'antd';
import { useWindowSize } from 'react-use';

import {
  categories,
  defaultCategory,
  defaultSeason,
  getResourceName,
  seasons as iseasons,
  seasonToNumber,
  seasonToString,
} from '../../model/model';
import useCompetition from '../../utils/useCompetition';

// import CompetitionBoard from '../CompetitionBoard/CompetitionBoard';
// import CompetitionGraph from '../CompetitionGraph/CompetitionGraph';
// import CompetitionPools from '../CompetitionPools/CompetitionPools';
import './Shell.scss';

import vbStatsLogo from '/vb-stats-logo.svg';

const CompetitionBoard = lazy(() => import('../CompetitionBoard/CompetitionBoard'));
const CompetitionGraph = lazy(() => import('../CompetitionGraph/CompetitionGraph'));
const CompetitionPools = lazy(() => import('../CompetitionPools/CompetitionPools'));

const BREAKPOINT = 512; // 576

const seasons = iseasons.map(seasonToString);

const tabNames: Record<string, string> = {
  pools: 'Pools',
  // teams: 'Teams',
  board: 'Board',
  graph: 'Graph',
};

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
  const { width, height } = useWindowSize();

  const pday: number = Number.parseInt(params.day);
  const [season, setSeason] = useState<string>(params.season ?? seasonToString(defaultSeason));
  const [category, setCategory] = useState<string>(params.category ?? defaultCategory);
  const [dayCount, setDayCount] = useState<number>(-1);
  const [day, setDay] = useState<number>(Number.isNaN(pday) ? 0 : pday);
  const [singleDay, setSingleDay] = useState<boolean>(params.singleDay === 'true'); // OVERALL - J0x (default false)
  const [qualified, setQualified] = useState<boolean>(params.qualified !== 'false'); // ALL TEAMS - QUALIFIED (default true)

  const [tab, setTab] = useState<string>(params.tab ?? 'pools');
  const [tokens, setTokens] = useState<string[]>(params.search?.split('+') ?? []);

  const { isLoading, isError, data: competition, error } = useCompetition(seasonToNumber(season), category);
  const fetched = !!competition;

  useEffect(() => {
    if (day > 0 && fetched) {
      const search = tokens.length === 0 ? '' : `&search=${tokens.join('+')}`;
      const url = `/vb-stats?tab=${tab}${season ? `&season=${season}` : ''}${category ? `&category=${category}` : ''}${
        day ? `&day=${day === dayCount ? 'last' : day}` : ''
      }&singleDay=${!!singleDay}&qualified=${!!qualified}${search}`;
      if (window.location.href !== `${window.location.origin}${url}`) {
        window.history.replaceState({}, '', url);
      }
    }
  }, [fetched, tab, season, category, dayCount, day, singleDay, qualified, tokens]);

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
        <Result
          status="error"
          title="Failed to load data..."
          subTitle={
            <>
              <div>{getResourceName(seasonToNumber(season), category)}</div>
              <div>{String(error)}</div>
            </>
          }
        />
      </Layout>
    );
  }

  const lastDay = !competition ? 0 : competition.lastDay + (competition.lastDay < competition.dayCount ? 1 : 0);
  const days = competition
    ? Array(lastDay)
        .fill(0)
        .map((_, index) => index + 1)
    : [];

  if (competition && lastDay !== dayCount) {
    setDayCount(lastDay);
    if (params.day === 'last' && day !== lastDay) {
      setDay(lastDay);
      return <div />;
    }
  }

  if (competition && (day < 1 || day > lastDay)) {
    setDay(lastDay);
    return <div />;
  }

  if (!categories.includes(category)) {
    setCategory(categories[0]);
    return <div />;
  }

  const onClick: MenuProps['onClick'] = (e) => {
    if (e.keyPath.length === 1 || e.keyPath[1] === 'tab') {
      // main menu
      setTab(e.key);
      if (e.key === 'teams' && singleDay) {
        setQualified(true);
        setSingleDay(false);
      }
      if (e.key === 'graph' && !qualified) {
        setQualified(true);
      }
    } else {
      // sub menu
      switch (e.keyPath[1]) {
        case 'day': {
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
        }
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
  const dayEnabled = tab !== 'teams';
  const items: MenuItem[] = [
    ...(width < BREAKPOINT
      ? [
          getItem(
            `${tabNames[tab]} ⌵`,
            'tab',
            undefined, // <TrophyOutlined />,
            Object.keys(tabNames).map((key) =>
              getItem(
                tabNames[key],
                key,
                //tab === key ? <TrophyOutlined /> : <Checked />)),
                <Checked checked={tab === key} />,
              ),
            ),
          ),
        ]
      : Object.keys(tabNames).map((key) => getItem(tabNames[key], key))),
    // : [...Object.keys(tabNames).map((key) => getItem(tabNames[key], key)), getItem('|')]),
    getItem(
      `J${dayEnabled ? day : competition?.dayCount}`,
      'day',
      <CalendarOutlined />,
      [
        getItem(
          'Day',
          'day',
          <CalendarOutlined />,
          days.map((cday) =>
            getItem(
              `J${cday}`,
              cday,
              cday === (dayEnabled ? day : competition?.dayCount) ? <CalendarOutlined /> : <Checked />,
              undefined,
              undefined,
              !dayEnabled,
            ),
          ),
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
              tab === 'pools' || tab === 'teams',
            ),
            !isCDF
              ? null
              : getItem(
                  'Qualified teams',
                  'qualified',
                  <Checked checked={!singleDay && qualified} />,
                  undefined,
                  undefined,
                  tab === 'pools',
                ),
            getItem(
              isCDF ? 'All teams' : 'All days',
              'overall',
              <Checked checked={isCDF ? !singleDay && !qualified : !singleDay} />,
              undefined,
              undefined,
              tab === 'pools' || tab === 'graph',
            ),
          ].filter(Boolean),
          'group',
        ),
      ],
      undefined,
      // !dayEnabled,
    ),
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
  ];

  // console.log('rendering Shell');
  return (
    <Layout className="vb-shell">
      <img src={vbStatsLogo} className="vb-stats-logo" alt="vb-stats logo" />
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
      </Layout.Header>
      <Layout.Content>
        <Suspense
          fallback={
            <Spin size="large">
              <Layout style={{ height: '100vh' }} />
            </Spin>
          }
        >
          {competition && tab === 'pools' && (
            <CompetitionPools
              // className={tab === 'pools' ? '' : 'no-display'}
              competition={competition}
              day={day}
              singleDay={singleDay}
              qualified={qualified}
              tokens={tokens}
              setTokens={setTokens}
            />
          )}
          {/* {competition && tab === 'teams' && (
          <CompetitionTeams
            // className={tab === 'teams' ? '' : 'no-display'}
            competition={competition}
            day={competition.dayCount}
            singleDay={singleDay}
            qualified={qualified}
            tokens={tokens}
            setTokens={setTokens}
          />
        )} */}
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
          {/*competition && tab === 'sheet' && (
          <CompetitionSheet
            // className={tab === 'graph' ? '' : 'no-display'}
            competition={competition}
            day={day}
            singleDay={singleDay}
            qualified={qualified}
          />
        )*/}
        </Suspense>
      </Layout.Content>
    </Layout>
  );
};

export default Shell;
