import fs from 'node:fs/promises';

import Papa from 'papaparse';

import { type Competition, type Entity, type Pool, seasonToString, type Team } from '@/model/model';
import { type ClubLocations, getTeamDistance } from '@/model/model-geography';
import { createCompetition } from '@/model/model-helpers';
import { type PoolApproach, type PoolPrediction, predictPools } from '@/model/model-pools';
import { processCompetition } from '@/model/model-process';

// --- Configuration ---

const SEASONS = [2022, 2023, 2024, 2025, 2026];
const CATEGORIES = ['M15F', 'M15M', 'M18F', 'M18M', 'M21F', 'M21M'];
const MIN_DAY = 5;
const ENTITY: Entity = 'ACJEUNES';
const APPROACHES: PoolApproach[] = ['greedy-geographic', 'swap-optimization', 'geographic-clustering', 'role-priority'];

const CLUB_LOCATIONS_PATH = './public/data/club-locations.json';
let clubLocations: ClubLocations = {};

const loadClubLocations = async (): Promise<void> => {
  try {
    const raw = await fs.readFile(CLUB_LOCATIONS_PATH, 'utf8');
    clubLocations = JSON.parse(raw) as ClubLocations;
  } catch {
    // fall back to department centroids
  }
};

const loadCompetition = async (season: number, category: string): Promise<Competition> => {
  const path = `./public/data/FFVB-${season}-CDF-${category}.CSV`;
  const file = await fs.readFile(path, { encoding: 'utf8' });
  const { data } = Papa.parse(file, { header: true, delimiter: ';', skipEmptyLines: true });
  const competition = createCompetition('CDF Pool Comparison', seasonToString(season), ENTITY, category);
  if (data.length > 0) {
    processCompetition(competition, [data as Record<string, string>[]]);
  }
  return competition;
};

// --- Pool Matching ---

const getActualPoolTeams = (competition: Competition, day: number): Team[][] => {
  const pools: Team[][] = [];
  competition.days[day]?.pools.forEach((pool: Pool) => {
    if (pool.teams.length === 3) pools.push([...pool.teams]);
  });
  return pools;
};

// Find best overlap between predicted and actual pools using greedy matching
const matchPools = (
  predicted: Team[][],
  actual: Team[][],
): { exactMatches: number; pairAccuracy: number; totalPools: number } => {
  const totalPools = actual.length;
  if (totalPools === 0) return { exactMatches: 0, pairAccuracy: 0, totalPools: 0 };

  // Build actual pool sets
  const actualSets = actual.map((pool) => new Set(pool.map((t) => t.id)));

  // Build predicted pool sets
  const predictedSets = predicted.map((pool) => new Set(pool.map((t) => t.id)));

  // Count exact pool matches (any predicted pool that exactly matches any actual pool)
  const matchedActual = new Set<number>();
  let exactMatches = 0;
  for (const pred of predictedSets) {
    for (let a = 0; a < actualSets.length; a++) {
      if (matchedActual.has(a)) continue;
      if (setsEqual(pred, actualSets[a])) {
        exactMatches++;
        matchedActual.add(a);
        break;
      }
    }
  }

  // Pair co-occurrence accuracy: what fraction of actual pairs appear together in predicted pools?
  const predictedPairMap = new Map<string, number>(); // "id1-id2" → pool index
  for (let p = 0; p < predicted.length; p++) {
    const pool = predicted[p];
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const key = [pool[i].id, pool[j].id].sort().join('-');
        predictedPairMap.set(key, p);
      }
    }
  }

  let matchedPairs = 0;
  let totalPairs = 0;
  for (const pool of actual) {
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const key = [pool[i].id, pool[j].id].sort().join('-');
        totalPairs++;
        if (predictedPairMap.has(key)) {
          matchedPairs++;
        }
      }
    }
  }

  return {
    exactMatches,
    pairAccuracy: totalPairs > 0 ? matchedPairs / totalPairs : 0,
    totalPools,
  };
};

const setsEqual = (a: Set<string>, b: Set<string>): boolean => {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
};

// --- Distance Metrics ---

const avgPairDistance = (pools: Team[][]): number => {
  let total = 0;
  let count = 0;
  for (const pool of pools) {
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        total += getTeamDistance(pool[i], pool[j], clubLocations);
        count++;
      }
    }
  }
  return count > 0 ? total / count : 0;
};

// --- Main ---

interface ApproachResult {
  approach: PoolApproach;
  exactMatches: number;
  pairAccuracy: number;
  totalPools: number;
  avgDistance: number;
  violations: number;
}

interface DayResult {
  season: number;
  category: string;
  day: number;
  actualAvgDistance: number;
  approaches: ApproachResult[];
}

const main = async (): Promise<void> => {
  await loadClubLocations();
  console.log('CDF Pool Comparison: Predicted vs Actual');
  console.log(`Seasons: ${SEASONS.join(', ')} | Categories: ${CATEGORIES.join(', ')} | Days >= ${MIN_DAY}`);
  console.log('='.repeat(120));

  const allResults: DayResult[] = [];

  // Per-approach accumulators
  const approachTotals = new Map<
    PoolApproach,
    { exactMatches: number; totalPools: number; pairAccuracySum: number; dayCount: number; distanceSum: number }
  >();
  for (const approach of APPROACHES) {
    approachTotals.set(approach, { exactMatches: 0, totalPools: 0, pairAccuracySum: 0, dayCount: 0, distanceSum: 0 });
  }

  let totalDays = 0;

  for (const season of SEASONS) {
    for (const category of CATEGORIES) {
      let competition: Competition;
      try {
        competition = await loadCompetition(season, category);
      } catch {
        continue;
      }
      if (competition.dayCount === 0) continue;

      // Find national days
      const nationalDays: number[] = [];
      for (let day = MIN_DAY; day <= competition.dayCount; day++) {
        const dayData = competition.days[day];
        if (dayData && !dayData.pf && dayData.pools.size > 0) nationalDays.push(day);
      }
      if (nationalDays.length === 0) continue;

      const label = `${seasonToString(season)} ${category}`;
      console.log(`\n--- ${label} (${nationalDays.length} national days) ---`);

      for (const day of nationalDays) {
        const actualPools = getActualPoolTeams(competition, day);
        if (actualPools.length === 0) continue;

        const actualDist = avgPairDistance(actualPools);
        const dayResult: DayResult = {
          season,
          category,
          day,
          actualAvgDistance: actualDist,
          approaches: [],
        };

        const approachResults: string[] = [];

        for (const approach of APPROACHES) {
          const prediction: PoolPrediction = predictPools(competition, day, {
            approach,
            clubLocations,
            enableRoleEquity: true,
          });

          const match = matchPools(prediction.pools, actualPools);

          const result: ApproachResult = {
            approach,
            exactMatches: match.exactMatches,
            pairAccuracy: match.pairAccuracy,
            totalPools: match.totalPools,
            avgDistance: prediction.metrics.avgPairDistance,
            violations: prediction.metrics.constraintViolations,
          };
          dayResult.approaches.push(result);

          const totals = approachTotals.get(approach)!;
          totals.exactMatches += match.exactMatches;
          totals.totalPools += match.totalPools;
          totals.pairAccuracySum += match.pairAccuracy;
          totals.dayCount++;
          totals.distanceSum += prediction.metrics.avgPairDistance;

          approachResults.push(
            `${approach}: exact=${match.exactMatches}/${match.totalPools} pairs=${(match.pairAccuracy * 100).toFixed(1)}% dist=${Math.round(prediction.metrics.avgPairDistance)}km`,
          );
        }

        console.log(
          `  Day ${day} (${actualPools.length} pools, actual=${Math.round(actualDist)}km): ${approachResults.join(' | ')}`,
        );

        allResults.push(dayResult);
        totalDays++;
      }
    }
  }

  // --- Aggregate Results ---
  console.log('\n' + '='.repeat(120));
  console.log(`AGGREGATE RESULTS (${totalDays} national days)\n`);

  console.log('Per-approach summary:');
  console.log(
    `${'Approach'.padEnd(25)} ${'Exact Match Rate'.padEnd(18)} ${'Pair Accuracy'.padEnd(15)} ${'Avg Distance'.padEnd(15)} ${'Days'}`,
  );
  console.log('-'.repeat(80));

  for (const approach of APPROACHES) {
    const t = approachTotals.get(approach)!;
    const exactRate = t.totalPools > 0 ? ((t.exactMatches / t.totalPools) * 100).toFixed(1) : '0.0';
    const avgPairAcc = t.dayCount > 0 ? ((t.pairAccuracySum / t.dayCount) * 100).toFixed(1) : '0.0';
    const avgDist = t.dayCount > 0 ? Math.round(t.distanceSum / t.dayCount) : 0;
    console.log(
      `${approach.padEnd(25)} ${(exactRate + '%').padEnd(18)} ${(avgPairAcc + '%').padEnd(15)} ${(avgDist + 'km').padEnd(15)} ${t.dayCount}`,
    );
  }

  // Per-day breakdown by day number
  console.log('\nPer-day-number breakdown (all approaches averaged):');
  const dayNumbers = [...new Set(allResults.map((r) => r.day))].sort((a, b) => a - b);
  for (const dayNum of dayNumbers) {
    const daysAtNum = allResults.filter((r) => r.day === dayNum);
    const actualDistAvg = daysAtNum.reduce((s, r) => s + r.actualAvgDistance, 0) / daysAtNum.length;

    for (const approach of APPROACHES) {
      const approachDays = daysAtNum.map((r) => r.approaches.find((a) => a.approach === approach)!);
      const exactRate =
        approachDays.reduce((s, a) => s + a.exactMatches, 0) / approachDays.reduce((s, a) => s + a.totalPools, 0);
      const pairAcc = approachDays.reduce((s, a) => s + a.pairAccuracy, 0) / approachDays.length;
      const predDist = approachDays.reduce((s, a) => s + a.avgDistance, 0) / approachDays.length;
      console.log(
        `  Day ${dayNum} ${approach.padEnd(25)} exact=${(exactRate * 100).toFixed(1)}% pairs=${(pairAcc * 100).toFixed(1)}% actual=${Math.round(actualDistAvg)}km pred=${Math.round(predDist)}km (${daysAtNum.length} days)`,
      );
    }
  }

  console.log(`\nDone. ${totalDays} national days compared.`);
};

main().catch(console.error);
