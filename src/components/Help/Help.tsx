import { presetDarkPalettes } from '@ant-design/colors';
import { Progress } from 'antd';
import cx from 'classnames';

import { Competition, Pool } from '../../model/model';
import { getDayRanking, getPoolProbabilities } from '../../model/model-helpers';

import { ReactComponent as VBStatsLogo } from '../../images/vb-stats-logo.svg';
import './Help.scss';

const NA = '_';

interface Props {
  competition: Competition;
  day: number;
  singleDay: boolean;
  qualified: boolean;
  className?: string | string[];
}

interface Stats {
  predicted: number;
  unpredicted: number;
  outsiders: number;
  right: number; // predicted match count
  total: number; // predictable match count
}

const updateStats = ({
  competition,
  pool,
  day,
  stats,
}: {
  competition: Competition;
  pool: Pool;
  day: number;
  stats: Stats;
}): Stats => {
  const [probabilities, orders] = getPoolProbabilities(competition, pool, day);
  pool.teams.forEach((team, index) => {
    const rank = orders[index];
    const dayRanking = getDayRanking(competition, team, day);
    // const eliminated = dayRanking === 3;
    const predicted = rank === 1 && dayRanking === 1;
    const unpredicted = rank === 1 && dayRanking === 3;
    const outsider = rank === 3 && dayRanking === 1;
    if (predicted) stats.predicted++;
    if (unpredicted) stats.unpredicted++;
    if (outsider) stats.outsiders++;
  });
  pool.matchs.forEach((match) => {
    if (match.predicted === true) stats.right++;
    if (match.predicted !== undefined) stats.total++;
  });
  return stats;
};

const Help = ({ competition, day, singleDay, qualified, className }: Props) => {
  const chartSize = 70;
  const { blue, green, gold, red } = presetDarkPalettes;
  const cday = competition.days[day];
  const pools = Array.from(cday.pools.values());
  const stats: Stats = {
    predicted: 0,
    unpredicted: 0,
    outsiders: 0,
    right: 0,
    total: 0,
  };
  pools.forEach((pool: Pool) => updateStats({ competition, pool, day, stats }));

  return (
    <div className="vb-info-card">
      <div className="vb-info-header">
        <VBStatsLogo className="vb-stats-icon" style={{ width: '3rem', height: '3rem' }} />
        <h2>
          VB Stats - {`CDF ${competition.category} ${competition.season.substring(competition.season.length - 4)}`}
        </h2>
        <div className={cx('vb-info-scroll', { 'vb-info-unplayed': day > competition.lastDay })}>
          <p>
            Bienvenue dans la page de pronostics de la Coupe de France Volley-Ball {competition.category}{' '}
            {competition.season}.
          </p>
          <p>
            Chaque équipe est évaluée suivant le système{' '}
            <a href="https://www.microsoft.com/en-us/research/project/trueskill-ranking-system/">TrueSkill™</a> donnant
            une note (<i>rating</i>) qui évolue à chaque match en fonction des sets gagnés ou perdus. Ce <i>rating</i>{' '}
            permet d'estimer la probabilité de victoire pour chaque match et la probabilité pour chaque équipe de
            terminer premier de sa poule.
          </p>
          <p>
            La barre de recherche permet de filtrer les équipes par noms, départements ou régions. Par exemple,{' '}
            <i>"cannes 84 occit"</i> affichera toutes les poules contenant l'équipe de Cannes, celles du Vaucluse (84)
            et celles d'Occitanie.
          </p>
          <p>
            La barre de menu permet aussi d'afficher, le classement (<i>Board</i>), le graphe des matchs (<i>Graph</i>)
            mais aussi de changer de journée, de catégorie ou de saison.
          </p>
          <p>
            Toutes les données utilisées viennent du site de la{' '}
            <a href="http://www.ffvb.org/index.php?lvlid=124&dsgtypid=38&artid=1095&pos=2">FFVB</a>. N'hésitez pas à
            m'envoyer un message sur insta <a href="https://www.instagram.com/gillesdandrea">@gillesdandrea</a> ou sur
            le compte ami <a href="https://www.instagram.com/cdf_m15_2024__volley/">@cdf_m15_2024__volley</a>
          </p>
          <p>
            Enfin, les statistiques ci-dessous vous disent combien de fois TrueSkill™ a raison (
            <i style={{ color: green[6] }}>Favorite wins</i>), quand il se trompe et qu'un favori est éliminé (
            <i style={{ color: red[5] }}>Favorite out</i>) ou que celui qu'il estimait perdant sort vainqueur (
            <i style={{ color: gold[6] }}>Outsider wins</i>) ainsi que les matchs prédits (
            <i style={{ color: blue[5] }}>Predictions</i>) 😉
          </p>
          <h3>Références</h3>
          <div className="vb-reference">
            C. Stewart, M. Mazel, B. Sadler (2022).{' '}
            <a href="https://scholar.smu.edu/cgi/viewcontent.cgi?article=1227&context=datasciencereview">
              Application of Probabilistic Ranking Systems on Women’s Junior Division Beach Volleyball.
              <i>SMU Data Science Review, Vol. 6, No. 2.</i>
            </a>
          </div>
          <div className="vb-reference">
            T. Minka, R. Cleven, Y. Zaykov (2018).{' '}
            <a href="https://www.microsoft.com/en-us/research/uploads/prod/2018/03/trueskill2.pdf">
              TrueSkill 2: An improved Bayesian skill rating system
            </a>
          </div>
          <div className="vb-reference">
            J. Moser (2010).{' '}
            <a href="https://www.moserware.com/2010/03/computing-your-skill.html">Computing Your skill.</a>
          </div>
        </div>
      </div>
      <div className="vb-info-charts-panel">
        <div className="vb-info-chart">
          <Progress
            type="dashboard"
            percent={(100 * stats.predicted) / pools.length}
            format={(percent) => (stats.total ? `${percent?.toFixed(0)}%` : NA)}
            size={chartSize}
            strokeColor={green[6]}
            strokeWidth={8}
          />
          <div>Favorite wins</div>
        </div>
        <div className="vb-info-chart">
          <Progress
            type="dashboard"
            percent={(100 * stats.outsiders) / pools.length}
            format={(percent) => (stats.total ? `${percent?.toFixed(0)}%` : NA)}
            size={chartSize}
            strokeColor={gold[6]}
            strokeWidth={8}
          />
          <div>Outsider wins</div>
        </div>
        <div className="vb-info-chart">
          <Progress
            type="dashboard"
            percent={(100 * stats.unpredicted) / pools.length}
            format={(percent) => (stats.total ? `${percent?.toFixed(0)}%` : NA)}
            size={chartSize}
            strokeColor={red[5]}
            strokeWidth={8}
          />
          <div>Favorite out</div>
        </div>
        <div className="vb-info-chart">
          <Progress
            type="dashboard"
            percent={(100 * stats.right) / stats.total}
            format={(percent) => (stats.total ? `${percent?.toFixed(0)}%` : NA)}
            size={chartSize}
            strokeColor={blue[5]}
            strokeWidth={8}
          />
          <div>Predictions</div>
        </div>
      </div>
    </div>
  );
};

export default Help;
