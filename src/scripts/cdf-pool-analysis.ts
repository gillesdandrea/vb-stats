import fs from 'node:fs/promises';

import Papa from 'papaparse';

import { createCompetition, getSlidingDay, isTeamInCourse } from '@/model/model-helpers';
import { type Competition, type Entity, type Pool, type Team, seasonToString } from '@/model/model';
import { processCompetition } from '@/model/model-process';
import { matchSorter, rankingSorter, ratingSorter } from '@/model/model-sorters';

// --- Configuration ---

const SEASONS = [2022, 2023, 2024, 2025, 2026];
const CATEGORIES = ['M15F', 'M15M', 'M18F', 'M18M', 'M21F', 'M21M'];
const MIN_DAY = 5;
const ENTITY: Entity = 'ACJEUNES';

// --- Department Centroids (approximate lat/lon) ---

const departmentCentroids: Record<string, [lat: number, lon: number]> = {
  '01': [46.2, 5.3],
  '02': [49.5, 3.6],
  '03': [46.4, 3.2],
  '04': [44.1, 6.2],
  '05': [44.7, 6.3],
  '06': [43.8, 7.2],
  '07': [44.7, 4.4],
  '08': [49.6, 4.6],
  '09': [42.9, 1.5],
  '10': [48.3, 4.1],
  '11': [43.1, 2.4],
  '12': [44.3, 2.6],
  '13': [43.5, 5.1],
  '14': [49.1, -0.4],
  '15': [45.0, 2.7],
  '16': [45.7, 0.2],
  '17': [45.8, -0.8],
  '18': [47.0, 2.5],
  '19': [45.3, 1.9],
  '21': [47.3, 4.6],
  '22': [48.5, -3.0],
  '23': [46.1, 2.1],
  '24': [45.1, 0.7],
  '25': [47.2, 6.4],
  '26': [44.7, 5.2],
  '27': [49.1, 1.2],
  '28': [48.3, 1.5],
  '29': [48.4, -4.2],
  '2A': [41.9, 9.0],
  '2B': [42.3, 9.2],
  '30': [44.0, 4.1],
  '31': [43.4, 1.2],
  '32': [43.7, 0.6],
  '33': [44.8, -0.6],
  '34': [43.6, 3.5],
  '35': [48.1, -1.7],
  '36': [46.8, 1.6],
  '37': [47.3, 0.7],
  '38': [45.3, 5.7],
  '39': [46.7, 5.7],
  '40': [43.9, -0.8],
  '41': [47.6, 1.4],
  '42': [45.7, 4.2],
  '43': [45.1, 3.7],
  '44': [47.3, -1.7],
  '45': [47.9, 2.2],
  '46': [44.6, 1.7],
  '47': [44.3, 0.5],
  '48': [44.5, 3.5],
  '49': [47.4, -0.5],
  '50': [48.9, -1.3],
  '51': [48.9, 3.9],
  '52': [48.1, 5.3],
  '53': [48.1, -0.8],
  '54': [48.7, 6.2],
  '55': [49.0, 5.4],
  '56': [47.8, -2.8],
  '57': [49.0, 6.7],
  '58': [47.1, 3.5],
  '59': [50.4, 3.2],
  '60': [49.4, 2.4],
  '61': [48.6, 0.1],
  '62': [50.5, 2.3],
  '63': [45.7, 3.1],
  '64': [43.3, -0.8],
  '65': [43.0, 0.2],
  '66': [42.6, 2.5],
  '67': [48.6, 7.5],
  '68': [47.9, 7.2],
  '69': [45.8, 4.7],
  '70': [47.6, 6.2],
  '71': [46.6, 4.4],
  '72': [47.9, 0.2],
  '73': [45.5, 6.4],
  '74': [46.0, 6.3],
  '75': [48.9, 2.3],
  '76': [49.7, 1.0],
  '77': [48.6, 2.9],
  '78': [48.8, 1.9],
  '79': [46.5, -0.3],
  '80': [49.9, 2.3],
  '81': [43.8, 2.1],
  '82': [44.0, 1.3],
  '83': [43.5, 6.2],
  '84': [44.1, 5.2],
  '85': [46.7, -1.3],
  '86': [46.6, 0.5],
  '87': [45.9, 1.3],
  '88': [48.2, 6.4],
  '89': [47.8, 3.6],
  '90': [47.6, 6.9],
  '91': [48.5, 2.2],
  '92': [48.8, 2.2],
  '93': [48.9, 2.5],
  '94': [48.8, 2.5],
  '95': [49.1, 2.2],
};

// Haversine distance in km
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Club location cache (populated from club-locations.json if available)
const CLUB_LOCATIONS_PATH = './public/data/club-locations.json';
let clubLocations: Record<string, { lat: number; lon: number }> = {};
let locationSource = 'department-centroids';

const loadClubLocations = async (): Promise<void> => {
  try {
    const raw = await fs.readFile(CLUB_LOCATIONS_PATH, 'utf8');
    const data = JSON.parse(raw) as Record<string, { lat: number; lon: number }>;
    clubLocations = data;
    locationSource = `club-cities (${Object.keys(data).length} clubs)`;
  } catch {
    locationSource = 'department-centroids (no club-locations.json, run pnpm cdf-geocode)';
  }
};

const getTeamCoords = (team: Team): [lat: number, lon: number] | undefined => {
  // Prefer club-level location
  const club = clubLocations[team.id];
  if (club) return [club.lat, club.lon];
  // Fallback to department centroid
  return departmentCentroids[team.department.num_dep];
};

const getTeamDistance = (a: Team, b: Team): number => {
  const ca = getTeamCoords(a);
  const cb = getTeamCoords(b);
  if (!ca || !cb) return -1;
  return haversineKm(ca[0], ca[1], cb[0], cb[1]);
};

// --- Types ---

interface RankingMethod {
  readonly name: string;
  readonly getSorter: (competition: Competition, day: number) => (a: Team, b: Team) => number;
}

// --- Ranking Methods ---

const rankingMethods: RankingMethod[] = [
  { name: 'ranking-daily', getSorter: (_c, d) => rankingSorter(d - 1, false) },
  { name: 'ranking-global', getSorter: (_c, d) => rankingSorter(d - 1, true) },
  { name: 'sliding-2', getSorter: (c, d) => matchSorter(getSlidingDay(c, d - 1), true, true, 2) },
  { name: 'sliding-3', getSorter: (c, d) => matchSorter(getSlidingDay(c, d - 1), true, true, 3) },
  { name: 'sliding-4', getSorter: (c, d) => matchSorter(getSlidingDay(c, d - 1), true, true, 4) },
  { name: 'rating', getSorter: (_c, d) => ratingSorter(d - 1, true) },
];

// --- Data Loading ---

const loadCompetition = async (season: number, category: string): Promise<Competition> => {
  const path = `./public/data/FFVB-${season}-CDF-${category}.CSV`;
  const file = await fs.readFile(path, { encoding: 'utf8' });
  const { data } = Papa.parse(file, { header: true, delimiter: ';', skipEmptyLines: true });
  const competition = createCompetition('CDF Pool Analysis', seasonToString(season), ENTITY, category);
  if (data.length > 0) {
    processCompetition(competition, [data as Record<string, string>[]]);
  }
  return competition;
};

// --- Helpers ---

const getTeamsInCourse = (competition: Competition, day: number): Team[] =>
  Array.from(competition.teams.values()).filter((t) => isTeamInCourse(competition, t, day));

const getActualPoolTeams = (competition: Competition, day: number): Team[][] => {
  const pools: Team[][] = [];
  competition.days[day]?.pools.forEach((pool: Pool) => {
    if (pool.teams.length === 3) pools.push([...pool.teams]);
  });
  return pools;
};

const setsEqual = (a: Set<string>, b: Set<string>): boolean => {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
};

// Build team→rankPosition map from a sorter
const buildRankMap = (teams: Team[], sorter: (a: Team, b: Team) => number): Map<string, number> => {
  const sorted = [...teams].sort(sorter);
  const map = new Map<string, number>();
  sorted.forEach((t, i) => map.set(t.id, i));
  return map;
};

// --- Serpentine and Sequential Predictors ---

const serpentine = (sorted: Team[], numPools: number): Map<string, number> => {
  const map = new Map<string, number>();
  for (let i = 0; i < numPools * 3; i++) {
    const row = Math.floor(i / numPools);
    const posInRow = i % numPools;
    const poolIndex = row % 2 === 0 ? posInRow : numPools - 1 - posInRow;
    map.set(sorted[i].id, poolIndex);
  }
  return map;
};

const sequential = (sorted: Team[], numPools: number): Map<string, number> => {
  const map = new Map<string, number>();
  for (let i = 0; i < numPools * 3; i++) {
    map.set(sorted[i].id, Math.floor(i / 3));
  }
  return map;
};

// --- ANALYSIS 1: Tier/Pot System ---
// Does each pool contain one team from each third (top/middle/bottom)?

const analyzeTierDistribution = (
  competition: Competition,
  day: number,
  sorter: (a: Team, b: Team) => number,
): { perfectTierPools: number; totalPools: number; tierCountDistribution: Map<string, number> } => {
  const teams = getTeamsInCourse(competition, day);
  const actualPools = getActualPoolTeams(competition, day);
  if (actualPools.length === 0) return { perfectTierPools: 0, totalPools: 0, tierCountDistribution: new Map() };

  const sorted = [...teams].sort(sorter);
  const n = sorted.length;
  const third = Math.ceil(n / 3);

  // Assign tiers: T=top, M=middle, B=bottom
  const tierOf = new Map<string, string>();
  sorted.forEach((t, i) => {
    if (i < third) tierOf.set(t.id, 'T');
    else if (i < third * 2) tierOf.set(t.id, 'M');
    else tierOf.set(t.id, 'B');
  });

  let perfectTierPools = 0;
  const dist = new Map<string, number>();
  for (const pool of actualPools) {
    const tiers = pool
      .map((t) => tierOf.get(t.id) ?? '?')
      .sort()
      .join('');
    dist.set(tiers, (dist.get(tiers) ?? 0) + 1);
    if (tiers === 'BMT') perfectTierPools++;
  }

  return { perfectTierPools, totalPools: actualPools.length, tierCountDistribution: dist };
};

// --- ANALYSIS 2: Swiss System (group by previous pool finish) ---
// Hypothesis: take all 1sts from day-1, all 2nds, all 3rds, then each pool gets one from each group

const analyzeSwissSystem = (
  competition: Competition,
  day: number,
  sorter: (a: Team, b: Team) => number,
): { exactMatches: number; totalPools: number; finishDistribution: Map<string, number> } => {
  const actualPools = getActualPoolTeams(competition, day);
  if (actualPools.length === 0 || day <= 1) return { exactMatches: 0, totalPools: 0, finishDistribution: new Map() };

  // Group teams by previous day pool finish
  const teams = getTeamsInCourse(competition, day);
  const firsts: Team[] = [];
  const seconds: Team[] = [];
  const thirds: Team[] = [];
  const others: Team[] = [];

  for (const team of teams) {
    const prevFinish = team.ranking.pools[day - 1];
    if (prevFinish === 1) firsts.push(team);
    else if (prevFinish === 2) seconds.push(team);
    else if (prevFinish === 3) thirds.push(team);
    else others.push(team);
  }

  // Check actual pool finish distribution
  const finishDist = new Map<string, number>();
  for (const pool of actualPools) {
    const finishes = pool
      .map((t) => t.ranking.pools[day - 1] ?? 0)
      .sort()
      .join('-');
    finishDist.set(finishes, (finishDist.get(finishes) ?? 0) + 1);
  }

  // Predict: sort each group by ranking, then serpentine one from each into pools
  const numPools = actualPools.length;
  firsts.sort(sorter);
  seconds.sort(sorter);
  thirds.sort(sorter);

  // Build predicted pools
  const predicted: Set<string>[] = [];
  for (let i = 0; i < numPools; i++) predicted.push(new Set());

  const assignGroup = (group: Team[], offset: number): void => {
    for (let i = 0; i < Math.min(group.length, numPools); i++) {
      // Serpentine within group
      const poolIdx = offset % 2 === 0 ? i : numPools - 1 - i;
      predicted[poolIdx].add(group[i].id);
    }
  };

  assignGroup(firsts, 0);
  assignGroup(seconds, 1);
  assignGroup(thirds, 2);

  // Count exact matches
  let exactMatches = 0;
  const actualSets = actualPools.map((pool) => new Set(pool.map((t) => t.id)));
  for (const pred of predicted) {
    if (pred.size === 3) {
      for (const act of actualSets) {
        if (setsEqual(pred, act)) {
          exactMatches++;
          break;
        }
      }
    }
  }

  return { exactMatches, totalPools: actualPools.length, finishDistribution: finishDist };
};

// --- ANALYSIS 3: Spearman Rank Correlation ---
// Measures whether higher-ranked teams tend to be in lower-indexed pools

const spearmanCorrelation = (competition: Competition, day: number, sorter: (a: Team, b: Team) => number): number => {
  const teams = getTeamsInCourse(competition, day);
  const actualPools = getActualPoolTeams(competition, day);
  if (actualPools.length === 0) return 0;

  const rankMap = buildRankMap(teams, sorter);

  // Actual pool index for each team
  const actualPoolIdx = new Map<string, number>();
  actualPools.forEach((pool, idx) => pool.forEach((t) => actualPoolIdx.set(t.id, idx)));

  // Compute Spearman
  const paired: Array<{ rank: number; poolIdx: number }> = [];
  for (const [id, rank] of rankMap) {
    const poolIdx = actualPoolIdx.get(id);
    if (poolIdx !== undefined) paired.push({ rank, poolIdx });
  }
  if (paired.length < 3) return 0;

  const n = paired.length;
  let sumD2 = 0;
  for (const p of paired) {
    const d = p.rank - p.poolIdx;
    sumD2 += d * d;
  }
  return 1 - (6 * sumD2) / (n * (n * n - 1));
};

// --- ANALYSIS 4: Minimum Swap Distance ---
// From a serpentine prediction, how many pairwise team swaps to reach actual?

const minimumSwapDistance = (actualPools: Team[][], predictedMap: Map<string, number>): number => {
  // Count teams that are in the wrong pool
  let misplaced = 0;
  for (const pool of actualPools) {
    for (const team of pool) {
      const predicted = predictedMap.get(team.id);
      // Find which actual pool index this team is in
      const actualIdx = actualPools.findIndex((p) => p.some((t) => t.id === team.id));
      if (predicted !== undefined && predicted !== actualIdx) {
        misplaced++;
      }
    }
  }
  // Each swap fixes 2 misplaced teams, so minimum swaps ≈ misplaced/2
  return Math.ceil(misplaced / 2);
};

// --- ANALYSIS 5: Intra-pool Ranking Spread ---
// Are actual pools "balanced" (mixing high+low) or "clustered" (similar ranks together)?

const analyzeRankingSpread = (
  competition: Competition,
  day: number,
  sorter: (a: Team, b: Team) => number,
): { avgSpread: number; randomExpectedSpread: number } => {
  const teams = getTeamsInCourse(competition, day);
  const actualPools = getActualPoolTeams(competition, day);
  if (actualPools.length === 0) return { avgSpread: 0, randomExpectedSpread: 0 };

  const rankMap = buildRankMap(teams, sorter);
  const n = teams.length;

  // Actual spread: max rank - min rank in each pool
  let totalSpread = 0;
  for (const pool of actualPools) {
    const ranks = pool.map((t) => rankMap.get(t.id) ?? 0);
    totalSpread += Math.max(...ranks) - Math.min(...ranks);
  }
  const avgSpread = totalSpread / actualPools.length;

  // Random expected spread: rough expectation for random 3-team groups from n
  const randomExpectedSpread = (2 * (n - 1)) / 3;

  return { avgSpread, randomExpectedSpread };
};

// --- ANALYSIS 6: Geographic Persistence ---
// Do teams in the same pool share geography more than expected on merit days?

const analyzeGeography = (
  competition: Competition,
  day: number,
): { sameRegionPairs: number; sameDeptPairs: number; totalPairs: number } => {
  const actualPools = getActualPoolTeams(competition, day);
  let sameRegionPairs = 0;
  let sameDeptPairs = 0;
  let totalPairs = 0;

  for (const pool of actualPools) {
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        totalPairs++;
        if (pool[i].department.region_name === pool[j].department.region_name) {
          sameRegionPairs++;
          if (pool[i].department.num_dep === pool[j].department.num_dep) {
            sameDeptPairs++;
          }
        }
      }
    }
  }

  return { sameRegionPairs, sameDeptPairs, totalPairs };
};

// --- ANALYSIS 14: Deep Geographic Distance Analysis ---

interface GeoDistanceResult {
  readonly avgPoolDistance: number;
  readonly maxPoolDistance: number;
  readonly avgHostDistance: number;
  readonly pairDistances: number[];
  readonly hostDistances: number[];
}

const analyzePoolDistances = (competition: Competition, day: number): GeoDistanceResult => {
  const actualPools = getActualPoolTeams(competition, day);
  const pairDistances: number[] = [];
  const hostDistances: number[] = [];

  for (const pool of actualPools) {
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const d = getTeamDistance(pool[i], pool[j]);
        if (d >= 0) pairDistances.push(d);
      }
    }
    // Distance of visitors to host
    const host = pool[0];
    for (let i = 1; i < pool.length; i++) {
      const d = getTeamDistance(host, pool[i]);
      if (d >= 0) hostDistances.push(d);
    }
  }

  return {
    avgPoolDistance: pairDistances.length > 0 ? pairDistances.reduce((s, d) => s + d, 0) / pairDistances.length : 0,
    maxPoolDistance: pairDistances.length > 0 ? Math.max(...pairDistances) : 0,
    avgHostDistance: hostDistances.length > 0 ? hostDistances.reduce((s, d) => s + d, 0) / hostDistances.length : 0,
    pairDistances,
    hostDistances,
  };
};

// Compute baseline: average distance between all pairs of teams in course
const computeAllPairsBaseline = (competition: Competition, day: number): number => {
  const teams = getTeamsInCourse(competition, day);
  const distances: number[] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const d = getTeamDistance(teams[i], teams[j]);
      if (d >= 0) distances.push(d);
    }
  }
  return distances.length > 0 ? distances.reduce((s, d) => s + d, 0) / distances.length : 0;
};

// Compare early (geographic) days vs merit days
const analyzeEarlyDaysGeo = (competition: Competition): GeoDistanceResult => {
  const pairDistances: number[] = [];
  const hostDistances: number[] = [];

  for (let day = 1; day < MIN_DAY; day++) {
    const pools = getActualPoolTeams(competition, day);
    for (const pool of pools) {
      for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
          const d = getTeamDistance(pool[i], pool[j]);
          if (d >= 0) pairDistances.push(d);
        }
      }
      const host = pool[0];
      for (let i = 1; i < pool.length; i++) {
        const d = getTeamDistance(host, pool[i]);
        if (d >= 0) hostDistances.push(d);
      }
    }
  }

  return {
    avgPoolDistance: pairDistances.length > 0 ? pairDistances.reduce((s, d) => s + d, 0) / pairDistances.length : 0,
    maxPoolDistance: pairDistances.length > 0 ? Math.max(...pairDistances) : 0,
    avgHostDistance: hostDistances.length > 0 ? hostDistances.reduce((s, d) => s + d, 0) / hostDistances.length : 0,
    pairDistances,
    hostDistances,
  };
};

// Monte Carlo: random pool assignment, compute average pool distance
const monteCarloGeoBaseline = (competition: Competition, day: number, runs: number): number => {
  const teams = getTeamsInCourse(competition, day);
  const numPools = Math.floor(teams.length / 3);
  if (numPools === 0) return 0;

  let totalAvg = 0;
  let validRuns = 0;

  for (let run = 0; run < runs; run++) {
    const shuffled = shuffleArray(teams);
    const distances: number[] = [];
    for (let p = 0; p < numPools; p++) {
      const pool = shuffled.slice(p * 3, p * 3 + 3);
      for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
          const d = getTeamDistance(pool[i], pool[j]);
          if (d >= 0) distances.push(d);
        }
      }
    }
    if (distances.length > 0) {
      totalAvg += distances.reduce((s, d) => s + d, 0) / distances.length;
      validRuns++;
    }
  }

  return validRuns > 0 ? totalAvg / validRuns : 0;
};

// --- ANALYSIS 7: Host Ranking Band ---
// Where do hosts sit in the overall ranking?

const analyzeHostRanking = (
  competition: Competition,
  day: number,
  sorter: (a: Team, b: Team) => number,
): { hostRanks: number[]; teamCount: number } => {
  const teams = getTeamsInCourse(competition, day);
  const actualPools = getActualPoolTeams(competition, day);
  const rankMap = buildRankMap(teams, sorter);

  const hostRanks = actualPools.map((pool) => rankMap.get(pool[0].id) ?? -1).filter((r) => r >= 0);
  return { hostRanks, teamCount: teams.length };
};

// --- ANALYSIS 8: Previous Pool Finish Composition ---
// Does each actual pool contain exactly one 1st, one 2nd, one 3rd from previous day?

const analyzePreviousFinishComposition = (
  competition: Competition,
  day: number,
): { perfectComposition: number; totalPools: number; compositions: Map<string, number> } => {
  const actualPools = getActualPoolTeams(competition, day);
  if (day <= 1) return { perfectComposition: 0, totalPools: 0, compositions: new Map() };

  const compositions = new Map<string, number>();
  let perfectComposition = 0;

  for (const pool of actualPools) {
    const finishes = pool
      .map((t) => t.ranking.pools[day - 1] ?? 0)
      .sort()
      .join('-');
    compositions.set(finishes, (compositions.get(finishes) ?? 0) + 1);
    if (finishes === '1-2-3') perfectComposition++;
  }

  return { perfectComposition, totalPools: actualPools.length, compositions };
};

// --- ANALYSIS 9: Serpentine + Constraint Swap ---
// Start from serpentine, then greedily swap to satisfy no-repeat constraint

const serpentineWithConstraints = (
  competition: Competition,
  day: number,
  sorter: (a: Team, b: Team) => number,
): { exactMatches: number; totalPools: number; swapsMade: number } => {
  const teams = getTeamsInCourse(competition, day);
  const actualPools = getActualPoolTeams(competition, day);
  if (actualPools.length === 0) return { exactMatches: 0, totalPools: 0, swapsMade: 0 };

  const sorted = [...teams].sort(sorter);
  const numPools = actualPools.length;
  if (sorted.length < numPools * 3) return { exactMatches: 0, totalPools: actualPools.length, swapsMade: 0 };

  // Build serpentine pools as mutable arrays
  const pools: Team[][] = Array.from({ length: numPools }, () => []);
  for (let i = 0; i < numPools * 3; i++) {
    const row = Math.floor(i / numPools);
    const posInRow = i % numPools;
    const poolIndex = row % 2 === 0 ? posInRow : numPools - 1 - posInRow;
    pools[poolIndex].push(sorted[i]);
  }

  // Check if pair shared a pool in any previous day
  const sharedPool = (a: Team, b: Team): boolean => {
    for (let d = 1; d < day; d++) {
      if (a.pools[d] && b.pools[d] && a.pools[d] === b.pools[d]) return true;
    }
    return false;
  };

  // Find constraint violations and fix by swapping
  let swapsMade = 0;
  for (let p = 0; p < numPools; p++) {
    const pool = pools[p];
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        if (sharedPool(pool[i], pool[j])) {
          // Try swapping pool[j] with a team from another pool
          let swapped = false;
          for (let q = p + 1; q < numPools && !swapped; q++) {
            for (let k = 0; k < pools[q].length && !swapped; k++) {
              // Check: would the swap create new violations?
              const candidate = pools[q][k];
              const wouldViolateP = pool.some((t, ti) => ti !== j && sharedPool(t, candidate));
              const wouldViolateQ = pools[q].some((t, ti) => ti !== k && sharedPool(t, pool[j]));
              if (!wouldViolateP && !wouldViolateQ) {
                // Swap
                const temp = pool[j];
                pool[j] = candidate;
                pools[q][k] = temp;
                swapsMade++;
                swapped = true;
              }
            }
          }
        }
      }
    }
  }

  // Compare with actual
  let exactMatches = 0;
  const actualSets = actualPools.map((pool) => new Set(pool.map((t) => t.id)));
  for (const pool of pools) {
    const predSet = new Set(pool.map((t) => t.id));
    for (const act of actualSets) {
      if (setsEqual(predSet, act)) {
        exactMatches++;
        break;
      }
    }
  }

  return { exactMatches, totalPools: actualPools.length, swapsMade };
};

// --- ANALYSIS 10: Pair Co-occurrence Analysis ---
// Which ranking-distance pairs appear together in pools? Compare to random expectation

const analyzePairDistances = (
  competition: Competition,
  day: number,
  sorter: (a: Team, b: Team) => number,
): { distances: number[]; avgDistance: number; medianDistance: number } => {
  const teams = getTeamsInCourse(competition, day);
  const actualPools = getActualPoolTeams(competition, day);
  if (actualPools.length === 0) return { distances: [], avgDistance: 0, medianDistance: 0 };

  const rankMap = buildRankMap(teams, sorter);
  const distances: number[] = [];

  for (const pool of actualPools) {
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const ri = rankMap.get(pool[i].id) ?? 0;
        const rj = rankMap.get(pool[j].id) ?? 0;
        distances.push(Math.abs(ri - rj));
      }
    }
  }

  distances.sort((a, b) => a - b);
  const avg = distances.reduce((s, d) => s + d, 0) / distances.length;
  const median = distances[Math.floor(distances.length / 2)];

  return { distances, avgDistance: avg, medianDistance: median };
};

// --- ANALYSIS 11: Monte Carlo Constrained Random Baseline ---
// Generate random pool assignments respecting no-repeat constraint, measure spread & tier stats

const MONTE_CARLO_RUNS = 200;

const shuffleArray = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const monteCarloRandomBaseline = (
  competition: Competition,
  day: number,
  sorter: (a: Team, b: Team) => number,
): {
  avgSpread: number;
  avgTierPerfect: number;
  avgExactMatch: number;
  geoSameRegion: number;
  geoPairs: number;
} => {
  const teams = getTeamsInCourse(competition, day);
  const actualPools = getActualPoolTeams(competition, day);
  const numPools = actualPools.length;
  if (numPools === 0 || teams.length < numPools * 3)
    return { avgSpread: 0, avgTierPerfect: 0, avgExactMatch: 0, geoSameRegion: 0, geoPairs: 0 };

  const rankMap = buildRankMap(teams, sorter);
  const n = teams.length;
  const third = Math.ceil(n / 3);
  const tierOf = new Map<string, string>();
  const sorted = [...teams].sort(sorter);
  sorted.forEach((t, i) => {
    if (i < third) tierOf.set(t.id, 'T');
    else if (i < third * 2) tierOf.set(t.id, 'M');
    else tierOf.set(t.id, 'B');
  });

  // Check if pair shared a pool previously
  const sharedPool = (a: Team, b: Team): boolean => {
    for (let d = 1; d < day; d++) {
      if (a.pools[d] && b.pools[d] && a.pools[d] === b.pools[d]) return true;
    }
    return false;
  };

  const actualSets = actualPools.map((pool) => new Set(pool.map((t) => t.id)));

  let totalSpread = 0;
  let totalTierPerfect = 0;
  let totalExact = 0;
  let totalGeoRegion = 0;
  let totalGeoPairs = 0;
  let validRuns = 0;

  for (let run = 0; run < MONTE_CARLO_RUNS; run++) {
    // Generate random assignment respecting no-repeat constraint
    const shuffled = shuffleArray(teams);
    const pools: Team[][] = Array.from({ length: numPools }, () => []);
    const assigned = new Set<string>();

    // Greedy assignment with constraint check
    for (const team of shuffled) {
      if (assigned.size >= numPools * 3) break;
      for (let p = 0; p < numPools; p++) {
        if (pools[p].length >= 3) continue;
        const conflicts = pools[p].some((t) => sharedPool(t, team));
        if (!conflicts) {
          pools[p].push(team);
          assigned.add(team.id);
          break;
        }
      }
    }

    // Skip incomplete assignments
    if (pools.some((p) => p.length !== 3)) continue;
    validRuns++;

    // Measure spread
    let runSpread = 0;
    for (const pool of pools) {
      const ranks = pool.map((t) => rankMap.get(t.id) ?? 0);
      runSpread += Math.max(...ranks) - Math.min(...ranks);
    }
    totalSpread += runSpread / numPools;

    // Measure tier distribution
    let tierPerfect = 0;
    for (const pool of pools) {
      const tiers = pool
        .map((t) => tierOf.get(t.id) ?? '?')
        .sort()
        .join('');
      if (tiers === 'BMT') tierPerfect++;
    }
    totalTierPerfect += tierPerfect;

    // Measure exact match with actual
    let exact = 0;
    for (const pool of pools) {
      const predSet = new Set(pool.map((t) => t.id));
      for (const act of actualSets) {
        if (setsEqual(predSet, act)) {
          exact++;
          break;
        }
      }
    }
    totalExact += exact;

    // Measure geography
    for (const pool of pools) {
      for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
          totalGeoPairs++;
          if (pool[i].department.region_name === pool[j].department.region_name) {
            totalGeoRegion++;
          }
        }
      }
    }
  }

  if (validRuns === 0) return { avgSpread: 0, avgTierPerfect: 0, avgExactMatch: 0, geoSameRegion: 0, geoPairs: 0 };

  return {
    avgSpread: totalSpread / validRuns,
    avgTierPerfect: totalTierPerfect / validRuns,
    avgExactMatch: totalExact / validRuns,
    geoSameRegion: totalGeoRegion,
    geoPairs: totalGeoPairs,
  };
};

// --- ANALYSIS 12: Between-Pool Ranking Variance ---
// Low variance = balanced pools (strong mixed with weak). High variance = clustered by merit.

const analyzeBetweenPoolVariance = (
  competition: Competition,
  day: number,
  sorter: (a: Team, b: Team) => number,
): { betweenPoolVariance: number; withinPoolVariance: number } => {
  const teams = getTeamsInCourse(competition, day);
  const actualPools = getActualPoolTeams(competition, day);
  if (actualPools.length === 0) return { betweenPoolVariance: 0, withinPoolVariance: 0 };

  const rankMap = buildRankMap(teams, sorter);

  // Pool means
  const poolMeans = actualPools.map((pool) => {
    const ranks = pool.map((t) => rankMap.get(t.id) ?? 0);
    return ranks.reduce((s, r) => s + r, 0) / ranks.length;
  });
  const grandMean = poolMeans.reduce((s, m) => s + m, 0) / poolMeans.length;

  // Between-pool variance (of pool means)
  const betweenPoolVariance = poolMeans.reduce((s, m) => s + (m - grandMean) ** 2, 0) / poolMeans.length;

  // Within-pool variance (avg variance within each pool)
  let totalWithin = 0;
  for (const pool of actualPools) {
    const ranks = pool.map((t) => rankMap.get(t.id) ?? 0);
    const mean = ranks.reduce((s, r) => s + r, 0) / ranks.length;
    const variance = ranks.reduce((s, r) => s + (r - mean) ** 2, 0) / ranks.length;
    totalWithin += variance;
  }
  const withinPoolVariance = totalWithin / actualPools.length;

  return { betweenPoolVariance, withinPoolVariance };
};

// --- ANALYSIS 13: Previous Pool Ranking Continuity ---
// Do teams from the SAME previous pool end up in different pools (as expected)?
// And does previous pool rank correlate with new pool composition?

const analyzePreviousPoolContinuity = (
  competition: Competition,
  day: number,
): { samePoolCarryover: number; totalPairs: number } => {
  const actualPools = getActualPoolTeams(competition, day);
  if (day <= 1) return { samePoolCarryover: 0, totalPairs: 0 };

  let samePoolCarryover = 0;
  let totalPairs = 0;

  for (const pool of actualPools) {
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        totalPairs++;
        // Were they in the same pool on day-1?
        if (pool[i].pools[day - 1] && pool[j].pools[day - 1] && pool[i].pools[day - 1] === pool[j].pools[day - 1]) {
          samePoolCarryover++;
        }
      }
    }
  }

  return { samePoolCarryover, totalPairs };
};

// --- Main Analysis Pipeline ---

const analyzeDay = (
  competition: Competition,
  day: number,
  sorter: (a: Team, b: Team) => number,
  methodName: string,
): Record<string, unknown> => {
  const teams = getTeamsInCourse(competition, day);
  const actualPools = getActualPoolTeams(competition, day);
  const numPools = actualPools.length;
  if (numPools === 0) return {};

  // Standard serpentine prediction
  const sorted = [...teams].sort(sorter);
  const serpMap = serpentine(sorted, numPools);
  const seqMap = sequential(sorted, numPools);

  // Exact match counting (serpentine)
  const actualSets = actualPools.map((pool) => new Set(pool.map((t) => t.id)));
  const serpPools: Set<string>[] = [];
  for (let i = 0; i < numPools; i++) {
    serpPools.push(new Set<string>());
  }
  serpMap.forEach((idx, id) => serpPools[idx]?.add(id));

  let serpExact = 0;
  for (const pred of serpPools) {
    if (pred.size === 3) {
      for (const act of actualSets) {
        if (setsEqual(pred, act)) {
          serpExact++;
          break;
        }
      }
    }
  }

  // Exact match counting (sequential)
  const seqPools: Set<string>[] = Array.from({ length: numPools }, () => new Set());
  seqMap.forEach((idx, id) => seqPools[idx]?.add(id));
  let seqExact = 0;
  for (const pred of seqPools) {
    if (pred.size === 3) {
      for (const act of actualSets) {
        if (setsEqual(pred, act)) {
          seqExact++;
          break;
        }
      }
    }
  }

  return {
    method: methodName,
    serpentineExact: serpExact,
    sequentialExact: seqExact,
    totalPools: numPools,
    spearman: spearmanCorrelation(competition, day, sorter),
    minSwaps: minimumSwapDistance(actualPools, serpMap),
    serpWithConstraints: serpentineWithConstraints(competition, day, sorter),
  };
};

const main = async (): Promise<void> => {
  await loadClubLocations();
  console.log('CDF Pool Assembly Analysis v2 - Creative Pattern Search');
  console.log(`Location source: ${locationSource}`);
  console.log(`Seasons: ${SEASONS.join(', ')} | Categories: ${CATEGORIES.join(', ')} | Merit days >= ${MIN_DAY}`);
  console.log('='.repeat(100));

  // Accumulators
  const tierStats = { perfect: 0, total: 0, dist: new Map<string, number>() };
  const finishCompStats = { perfect: 0, total: 0, dist: new Map<string, number>() };
  const geoStats = { sameRegion: 0, sameDept: 0, totalPairs: 0 };
  const allHostRanks: Array<{ rank: number; teamCount: number }> = [];
  const spreadStats: Array<{ avg: number; expected: number }> = [];
  const pairDistStats: Array<{ avg: number; median: number }> = [];
  const swissStats = new Map<string, { exact: number; total: number }>();
  const serpConstrStats = new Map<string, { exact: number; total: number; swaps: number }>();
  const spearmanStats = new Map<string, number[]>();
  const serpExactStats = new Map<string, { exact: number; total: number }>();
  const seqExactStats = new Map<string, { exact: number; total: number }>();
  const mcStats = { spread: 0, tierPerfect: 0, exactMatch: 0, geoRegion: 0, geoPairs: 0, runs: 0 };
  const varianceStats: Array<{ between: number; within: number }> = [];
  const carryoverStats = { same: 0, total: 0 };
  // Deep geo accumulators
  const meritGeoDists: number[] = [];
  const meritHostDists: number[] = [];
  const earlyGeoDists: number[] = [];
  const earlyHostDists: number[] = [];
  const baselineDists: number[] = [];
  const mcGeoDists: number[] = [];
  const dayAvgDistances: Array<{ season: number; category: string; day: number; avgDist: number; baseline: number }> =
    [];
  let totalDays = 0;
  let processedComps = 0;

  for (const season of SEASONS) {
    for (const category of CATEGORIES) {
      let competition: Competition;
      try {
        competition = await loadCompetition(season, category);
      } catch {
        continue;
      }
      if (competition.dayCount === 0) continue;

      const meritDays: number[] = [];
      for (let day = MIN_DAY; day <= competition.dayCount; day++) {
        const dayData = competition.days[day];
        if (dayData && !dayData.pf && dayData.pools.size > 0) meritDays.push(day);
      }
      if (meritDays.length === 0) continue;
      processedComps++;

      // Collect early days (1-4) geographic distances
      const earlyGeo = analyzeEarlyDaysGeo(competition);
      earlyGeoDists.push(...earlyGeo.pairDistances);
      earlyHostDists.push(...earlyGeo.hostDistances);

      const label = `${seasonToString(season)} ${category}`;
      console.log(`\n--- ${label} (${meritDays.length} merit days) ---`);

      for (const day of meritDays) {
        totalDays++;
        const actualPools = getActualPoolTeams(competition, day);
        if (actualPools.length === 0) continue;

        // ANALYSIS 1: Tier distribution (using ranking-global)
        const globalSorter = rankingSorter(day - 1, true);
        const tier = analyzeTierDistribution(competition, day, globalSorter);
        tierStats.perfect += tier.perfectTierPools;
        tierStats.total += tier.totalPools;
        tier.tierCountDistribution.forEach((count, key) => {
          tierStats.dist.set(key, (tierStats.dist.get(key) ?? 0) + count);
        });

        // ANALYSIS 2: Previous pool finish composition
        const finish = analyzePreviousFinishComposition(competition, day);
        finishCompStats.perfect += finish.perfectComposition;
        finishCompStats.total += finish.totalPools;
        finish.compositions.forEach((count, key) => {
          finishCompStats.dist.set(key, (finishCompStats.dist.get(key) ?? 0) + count);
        });

        // ANALYSIS 6: Geographic persistence
        const geo = analyzeGeography(competition, day);
        geoStats.sameRegion += geo.sameRegionPairs;
        geoStats.sameDept += geo.sameDeptPairs;
        geoStats.totalPairs += geo.totalPairs;

        // ANALYSIS 11: Monte Carlo random baseline
        const mc = monteCarloRandomBaseline(competition, day, globalSorter);
        mcStats.spread += mc.avgSpread;
        mcStats.tierPerfect += mc.avgTierPerfect;
        mcStats.exactMatch += mc.avgExactMatch;
        mcStats.geoRegion += mc.geoSameRegion;
        mcStats.geoPairs += mc.geoPairs;
        mcStats.runs++;

        // ANALYSIS 12: Between/within pool variance
        const variance = analyzeBetweenPoolVariance(competition, day, globalSorter);
        varianceStats.push({ between: variance.betweenPoolVariance, within: variance.withinPoolVariance });

        // ANALYSIS 13: Previous pool carryover
        const carryover = analyzePreviousPoolContinuity(competition, day);
        carryoverStats.same += carryover.samePoolCarryover;
        carryoverStats.total += carryover.totalPairs;

        // ANALYSIS 14: Deep geographic distances
        const poolDist = analyzePoolDistances(competition, day);
        meritGeoDists.push(...poolDist.pairDistances);
        meritHostDists.push(...poolDist.hostDistances);
        const bl = computeAllPairsBaseline(competition, day);
        baselineDists.push(bl);
        const mcGeo = monteCarloGeoBaseline(competition, day, 100);
        mcGeoDists.push(mcGeo);
        dayAvgDistances.push({
          season,
          category,
          day,
          avgDist: poolDist.avgPoolDistance,
          baseline: bl,
        });

        // Per-method analyses
        for (const method of rankingMethods) {
          const sorter = method.getSorter(competition, day);

          // ANALYSIS 3: Spearman
          const sp = spearmanCorrelation(competition, day, sorter);
          if (!spearmanStats.has(method.name)) spearmanStats.set(method.name, []);
          spearmanStats.get(method.name)!.push(sp);

          // ANALYSIS 5: Ranking spread
          if (method.name === 'ranking-global') {
            const spread = analyzeRankingSpread(competition, day, sorter);
            spreadStats.push({ avg: spread.avgSpread, expected: spread.randomExpectedSpread });
          }

          // ANALYSIS 7: Host ranking (only for ranking-global)
          if (method.name === 'ranking-global') {
            const hostR = analyzeHostRanking(competition, day, sorter);
            hostR.hostRanks.forEach((r) => allHostRanks.push({ rank: r, teamCount: hostR.teamCount }));
          }

          // ANALYSIS 10: Pair distances
          if (method.name === 'ranking-global') {
            const pd = analyzePairDistances(competition, day, sorter);
            pairDistStats.push({ avg: pd.avgDistance, median: pd.medianDistance });
          }

          // Day-level analysis (serpentine, sequential, constraints)
          const dayResult = analyzeDay(competition, day, sorter, method.name);

          // Accumulate serpentine exact
          if (!serpExactStats.has(method.name)) serpExactStats.set(method.name, { exact: 0, total: 0 });
          const se = serpExactStats.get(method.name)!;
          se.exact += (dayResult.serpentineExact as number) ?? 0;
          se.total += (dayResult.totalPools as number) ?? 0;

          // Accumulate sequential exact
          if (!seqExactStats.has(method.name)) seqExactStats.set(method.name, { exact: 0, total: 0 });
          const sq = seqExactStats.get(method.name)!;
          sq.exact += (dayResult.sequentialExact as number) ?? 0;
          sq.total += (dayResult.totalPools as number) ?? 0;

          // ANALYSIS 9: Serpentine + constraints
          const sc = dayResult.serpWithConstraints as { exactMatches: number; totalPools: number; swapsMade: number };
          if (sc) {
            if (!serpConstrStats.has(method.name)) serpConstrStats.set(method.name, { exact: 0, total: 0, swaps: 0 });
            const entry = serpConstrStats.get(method.name)!;
            entry.exact += sc.exactMatches;
            entry.total += sc.totalPools;
            entry.swaps += sc.swapsMade;
          }

          // ANALYSIS 2b: Swiss system
          const swiss = analyzeSwissSystem(competition, day, sorter);
          if (!swissStats.has(method.name)) swissStats.set(method.name, { exact: 0, total: 0 });
          const sw = swissStats.get(method.name)!;
          sw.exact += swiss.exactMatches;
          sw.total += swiss.totalPools;
        }

        // Day-level summary
        const distRatio = bl > 0 ? (poolDist.avgPoolDistance / bl).toFixed(2) : 'N/A';
        console.log(
          `  Day ${day}: ${actualPools.length} pools | avg dist: ${poolDist.avgPoolDistance.toFixed(0)}km (baseline: ${bl.toFixed(0)}km, ratio: ${distRatio}) | host dist: ${poolDist.avgHostDistance.toFixed(0)}km`,
        );
      }
    }
  }

  // --- AGGREGATE REPORT ---

  console.log(`\n${'='.repeat(100)}`);
  console.log(`AGGREGATE RESULTS (${totalDays} merit days, ${processedComps} competitions)`);
  console.log('='.repeat(100));

  // 1. Previous pool finish composition
  console.log('\n[1] PREVIOUS POOL FINISH COMPOSITION (1-2-3 = one 1st, one 2nd, one 3rd)');
  console.log(
    `  Perfect 1-2-3 pools: ${finishCompStats.perfect}/${finishCompStats.total} (${pct(finishCompStats.perfect, finishCompStats.total)})`,
  );
  console.log('  All compositions:');
  const sortedFinish = [...finishCompStats.dist.entries()].sort((a, b) => b[1] - a[1]);
  for (const [comp, count] of sortedFinish) {
    console.log(`    ${comp}: ${count} (${pct(count, finishCompStats.total)})`);
  }

  // 2. Tier distribution
  console.log('\n[2] TIER DISTRIBUTION (T=top third, M=middle, B=bottom)');
  console.log(
    `  Perfect BMT pools: ${tierStats.perfect}/${tierStats.total} (${pct(tierStats.perfect, tierStats.total)})`,
  );
  console.log('  All tier compositions:');
  const sortedTier = [...tierStats.dist.entries()].sort((a, b) => b[1] - a[1]);
  for (const [comp, count] of sortedTier) {
    console.log(`    ${comp}: ${count} (${pct(count, tierStats.total)})`);
  }

  // 3. Spearman correlations
  console.log('\n[3] SPEARMAN RANK CORRELATION (pool index vs ranking, 1.0 = perfect match)');
  for (const [name, values] of [...spearmanStats.entries()].sort((a, b) => avg(b[1]) - avg(a[1]))) {
    console.log(
      `  ${name.padEnd(20)} mean=${avg(values).toFixed(4)} median=${median(values).toFixed(4)} min=${Math.min(...values).toFixed(4)} max=${Math.max(...values).toFixed(4)}`,
    );
  }

  // 4. Serpentine vs Sequential exact matches
  console.log('\n[4] SERPENTINE vs SEQUENTIAL EXACT POOL MATCHES');
  console.log('  Method                    Serpentine          Sequential');
  for (const method of rankingMethods) {
    const se = serpExactStats.get(method.name);
    const sq = seqExactStats.get(method.name);
    if (se && sq) {
      console.log(
        `  ${method.name.padEnd(24)} ${se.exact}/${se.total} (${pct(se.exact, se.total).padEnd(7)})    ${sq.exact}/${sq.total} (${pct(sq.exact, sq.total)})`,
      );
    }
  }

  // 5. Serpentine + constraint satisfaction
  console.log('\n[5] SERPENTINE + CONSTRAINT SWAPS');
  for (const [name, stats] of [...serpConstrStats.entries()].sort(
    (a, b) => b[1].exact / b[1].total - a[1].exact / a[1].total,
  )) {
    console.log(
      `  ${name.padEnd(20)} exact=${stats.exact}/${stats.total} (${pct(stats.exact, stats.total)}) avg swaps=${(stats.swaps / totalDays).toFixed(1)}`,
    );
  }

  // 6. Swiss system
  console.log('\n[6] SWISS SYSTEM (group by prev day finish, serpentine within groups)');
  for (const [name, stats] of [...swissStats.entries()].sort(
    (a, b) => b[1].exact / b[1].total - a[1].exact / a[1].total,
  )) {
    console.log(`  ${name.padEnd(20)} exact=${stats.exact}/${stats.total} (${pct(stats.exact, stats.total)})`);
  }

  // 7. Ranking spread
  console.log('\n[7] INTRA-POOL RANKING SPREAD (ranking-global)');
  if (spreadStats.length > 0) {
    const avgActual = avg(spreadStats.map((s) => s.avg));
    const avgExpected = avg(spreadStats.map((s) => s.expected));
    console.log(`  Actual avg spread: ${avgActual.toFixed(1)}`);
    console.log(`  Random expected spread: ${avgExpected.toFixed(1)}`);
    console.log(
      `  Ratio (actual/random): ${(avgActual / avgExpected).toFixed(3)} (close to 1.0 = random-like, low = clustered)`,
    );
  }

  // 8. Geographic persistence
  console.log('\n[8] GEOGRAPHIC PERSISTENCE ON MERIT DAYS');
  console.log(
    `  Same region pairs: ${geoStats.sameRegion}/${geoStats.totalPairs} (${pct(geoStats.sameRegion, geoStats.totalPairs)})`,
  );
  console.log(
    `  Same dept pairs: ${geoStats.sameDept}/${geoStats.totalPairs} (${pct(geoStats.sameDept, geoStats.totalPairs)})`,
  );

  // 9. Host ranking bands
  console.log('\n[9] HOST RANKING DISTRIBUTION (ranking-global, normalized 0-1)');
  if (allHostRanks.length > 0) {
    const normalized = allHostRanks.map((h) => h.rank / (h.teamCount - 1));
    const buckets = [0, 0, 0, 0, 0]; // 0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8-1.0
    for (const n of normalized) {
      const idx = Math.min(Math.floor(n * 5), 4);
      buckets[idx]++;
    }
    const labels = ['0.0-0.2 (top)', '0.2-0.4', '0.4-0.6', '0.6-0.8', '0.8-1.0 (bottom)'];
    for (let i = 0; i < 5; i++) {
      const bar = '#'.repeat(Math.round((buckets[i] / allHostRanks.length) * 50));
      console.log(
        `  ${labels[i].padEnd(20)} ${buckets[i].toString().padStart(4)} (${pct(buckets[i], allHostRanks.length).padEnd(6)}) ${bar}`,
      );
    }
    console.log(
      `  Mean normalized rank: ${avg(normalized).toFixed(3)} (0.5 = uniform, <0.5 = hosts tend to be top-ranked)`,
    );
  }

  // 10. Pair distance stats
  console.log('\n[10] PAIR RANKING DISTANCE (ranking-global)');
  if (pairDistStats.length > 0) {
    console.log(`  Avg pair distance: ${avg(pairDistStats.map((p) => p.avg)).toFixed(1)}`);
    console.log(`  Median pair distance: ${avg(pairDistStats.map((p) => p.median)).toFixed(1)}`);
  }

  // 11. Monte Carlo random baseline comparison
  console.log('\n[11] MONTE CARLO RANDOM BASELINE (constrained random, 200 runs/day)');
  if (mcStats.runs > 0) {
    const mcAvgSpread = mcStats.spread / mcStats.runs;
    const mcAvgTier = mcStats.tierPerfect / mcStats.runs;
    const mcAvgExact = mcStats.exactMatch / mcStats.runs;
    const actualAvgSpread = avg(spreadStats.map((s) => s.avg));
    console.log(
      `  Random avg spread: ${mcAvgSpread.toFixed(1)} vs Actual: ${actualAvgSpread.toFixed(1)} (ratio: ${(actualAvgSpread / mcAvgSpread).toFixed(3)})`,
    );
    console.log(
      `  Random avg BMT tier pools/day: ${mcAvgTier.toFixed(1)} vs Actual: ${(tierStats.perfect / totalDays).toFixed(1)}`,
    );
    console.log(`  Random exact matches/day: ${mcAvgExact.toFixed(2)} (expected if random)`);
    if (mcStats.geoPairs > 0) {
      console.log(
        `  Random same-region rate: ${pct(mcStats.geoRegion, mcStats.geoPairs)} vs Actual: ${pct(geoStats.sameRegion, geoStats.totalPairs)}`,
      );
    }
  }

  // 12. Between/within pool variance
  console.log('\n[12] BETWEEN vs WITHIN POOL RANKING VARIANCE (ranking-global)');
  if (varianceStats.length > 0) {
    const avgBetween = avg(varianceStats.map((v) => v.between));
    const avgWithin = avg(varianceStats.map((v) => v.within));
    console.log(`  Between-pool variance: ${avgBetween.toFixed(1)} (higher = pools differ in avg quality)`);
    console.log(`  Within-pool variance: ${avgWithin.toFixed(1)} (higher = teams in same pool differ in quality)`);
    console.log(
      `  Ratio between/within: ${(avgBetween / avgWithin).toFixed(3)} (high = merit-clustered, low = balanced/mixed)`,
    );
  }

  // 13. Previous pool carryover
  console.log('\n[13] PREVIOUS POOL CARRYOVER (pairs from same pool on day-1)');
  console.log(
    `  Same-pool pairs on day-1: ${carryoverStats.same}/${carryoverStats.total} (${pct(carryoverStats.same, carryoverStats.total)})`,
  );

  // 14. Deep geographic distance analysis
  console.log('\n[14] DEEP GEOGRAPHIC DISTANCE ANALYSIS');
  if (meritGeoDists.length > 0) {
    const meritAvgPair = avg(meritGeoDists);
    const meritMedianPair = median(meritGeoDists);
    const earlyAvgPair = earlyGeoDists.length > 0 ? avg(earlyGeoDists) : 0;
    const earlyMedianPair = earlyGeoDists.length > 0 ? median(earlyGeoDists) : 0;
    const allPairsBaseline = avg(baselineDists);
    const mcGeoAvg = avg(mcGeoDists);

    console.log('  Intra-pool pair distances (km):');
    console.log(
      `    Early days (1-4):  avg=${earlyAvgPair.toFixed(0)}  median=${earlyMedianPair.toFixed(0)}  (${earlyGeoDists.length} pairs)`,
    );
    console.log(
      `    Merit days (>=5):  avg=${meritAvgPair.toFixed(0)}  median=${meritMedianPair.toFixed(0)}  (${meritGeoDists.length} pairs)`,
    );
    console.log(
      `    All-pairs baseline: avg=${allPairsBaseline.toFixed(0)} (avg distance between any 2 teams in course)`,
    );
    console.log(`    Monte Carlo random: avg=${mcGeoAvg.toFixed(0)} (random pool assignment)`);
    console.log(
      `    Merit/Baseline ratio: ${(meritAvgPair / allPairsBaseline).toFixed(3)} (1.0 = no geo influence, <1.0 = geo clustering)`,
    );
    console.log(`    Merit/Random ratio:   ${(meritAvgPair / mcGeoAvg).toFixed(3)}`);
    console.log(`    Early/Baseline ratio: ${(earlyAvgPair / allPairsBaseline).toFixed(3)}`);

    const meritAvgHost = avg(meritHostDists);
    const earlyAvgHost = earlyHostDists.length > 0 ? avg(earlyHostDists) : 0;
    console.log('\n  Host-to-visitor distances (km):');
    console.log(`    Early days (1-4):  avg=${earlyAvgHost.toFixed(0)}  (${earlyHostDists.length} pairs)`);
    console.log(`    Merit days (>=5):  avg=${meritAvgHost.toFixed(0)}  (${meritHostDists.length} pairs)`);

    // Distance histogram
    console.log('\n  Merit days pair distance distribution:');
    const bucketSize = 100;
    const maxBucket = 1000;
    const buckets: number[] = Array(maxBucket / bucketSize + 1).fill(0);
    for (const d of meritGeoDists) {
      const idx = Math.min(Math.floor(d / bucketSize), buckets.length - 1);
      buckets[idx]++;
    }
    for (let i = 0; i < buckets.length; i++) {
      const lo = i * bucketSize;
      const hi = lo + bucketSize;
      const label = i === buckets.length - 1 ? `${lo}+` : `${lo}-${hi}`;
      const bar = '#'.repeat(Math.round((buckets[i] / meritGeoDists.length) * 60));
      console.log(
        `    ${label.padEnd(10)} ${buckets[i].toString().padStart(5)} (${pct(buckets[i], meritGeoDists.length).padEnd(6)}) ${bar}`,
      );
    }

    // Per-day detail: flag days with unusually low/high distance ratios
    console.log('\n  Per-day distance ratios (merit/baseline):');
    const sortedDays = [...dayAvgDistances].sort((a, b) => {
      const ra = a.baseline > 0 ? a.avgDist / a.baseline : 1;
      const rb = b.baseline > 0 ? b.avgDist / b.baseline : 1;
      return ra - rb;
    });
    for (const d of sortedDays) {
      const ratio = d.baseline > 0 ? (d.avgDist / d.baseline).toFixed(3) : 'N/A';
      console.log(
        `    ${seasonToString(d.season)} ${d.category} Day ${d.day}: ${d.avgDist.toFixed(0)}km / ${d.baseline.toFixed(0)}km = ${ratio}`,
      );
    }
  }

  console.log(`\nDone. ${processedComps} competitions, ${totalDays} merit days.`);
};

// --- Utility ---

const pct = (num: number, den: number): string => (den > 0 ? ((num / den) * 100).toFixed(1) + '%' : '0.0%');
const avg = (arr: number[]): number => (arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
const median = (arr: number[]): number => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

main().catch(console.error);
