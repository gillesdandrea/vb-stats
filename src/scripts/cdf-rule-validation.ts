import fs from 'node:fs/promises';

import Papa from 'papaparse';

import { type Competition, type Entity, seasonToString, type Team } from '@/model/model';
import { type ClubLocations, getTeamDistance } from '@/model/model-geography';
import { createCompetition } from '@/model/model-helpers';
import { processCompetition } from '@/model/model-process';

// --- Configuration ---

const SEASONS = [2022, 2023, 2024, 2025, 2026];
const CATEGORIES = ['M15F', 'M15M', 'M18F', 'M18M', 'M21F', 'M21M'];
const ENTITY: Entity = 'ACJEUNES';

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
  const competition = createCompetition('CDF Rule Validation', seasonToString(season), ENTITY, category);
  if (data.length > 0) {
    processCompetition(competition, [data as Record<string, string>[]]);
  }
  return competition;
};

// --- Rule Checks ---

interface HardRuleResult {
  sharedPoolViolations: number;
  threeFirstsViolations: number;
  noFirstViolations: number;
  totalPools: number;
  totalPairs: number;
}

interface SoftRuleResult {
  consecutiveHostCount: number;
  consecutiveHostDetails: Array<{
    teamName: string;
    days: [number, number];
  }>;
  roleEquityDeviation: number; // avg deviation from ideal 1/3 split
  roleTeamCount: number;
}

const checkHardRules = (competition: Competition): HardRuleResult => {
  let sharedPoolViolations = 0;
  let threeFirstsViolations = 0;
  let noFirstViolations = 0;
  let totalPools = 0;
  let totalPairs = 0;

  for (let day = 1; day <= competition.dayCount; day++) {
    const dayData = competition.days[day];
    if (!dayData || dayData.pf) continue;

    for (const pool of dayData.pools.values()) {
      if (pool.teams.length < 3) continue;
      totalPools++;

      // Check shared pool (no-repeat matchups)
      for (let i = 0; i < pool.teams.length; i++) {
        for (let j = i + 1; j < pool.teams.length; j++) {
          totalPairs++;
          // Check all previous days for same pool
          for (let prevDay = 1; prevDay < day; prevDay++) {
            const prevPool = pool.teams[i].pools[prevDay];
            const otherPrevPool = pool.teams[j].pools[prevDay];
            if (prevPool && otherPrevPool && prevPool === otherPrevPool) {
              sharedPoolViolations++;
              break;
            }
          }
        }
      }

      // Check firsts distribution (day >= 2)
      if (day >= 2) {
        const firstCount = pool.teams.filter((t: Team) => t.ranking.pools[day] === 1).length;
        if (firstCount === 0) noFirstViolations++;
        if (firstCount >= 3) threeFirstsViolations++;
      }
    }
  }

  return { sharedPoolViolations, threeFirstsViolations, noFirstViolations, totalPools, totalPairs };
};

const checkSoftRules = (competition: Competition): SoftRuleResult => {
  const consecutiveHostDetails: SoftRuleResult['consecutiveHostDetails'] = [];

  // Track who hosted on each day
  const dayHosts = new Map<number, Set<string>>();
  for (let day = 1; day <= competition.dayCount; day++) {
    const dayData = competition.days[day];
    if (!dayData || dayData.pf) continue;
    const hosts = new Set<string>();
    for (const pool of dayData.pools.values()) {
      if (pool.teams.length >= 3) {
        hosts.add(pool.teams[0].id);
      }
    }
    dayHosts.set(day, hosts);
  }

  // Check consecutive hosting
  const sortedDays = [...dayHosts.keys()].sort((a, b) => a - b);
  for (let i = 1; i < sortedDays.length; i++) {
    const prevDay = sortedDays[i - 1];
    const currDay = sortedDays[i];
    const prevHosts = dayHosts.get(prevDay)!;
    const currHosts = dayHosts.get(currDay)!;

    for (const hostId of currHosts) {
      if (prevHosts.has(hostId)) {
        const team = Array.from(competition.teams.values()).find((t) => t.id === hostId);
        consecutiveHostDetails.push({
          teamName: team?.name ?? hostId,
          days: [prevDay, currDay],
        });
      }
    }
  }

  // Role equity: track host/nearby/far for each team across all days
  const roleCounts = new Map<string, { host: number; nearby: number; far: number; total: number }>();

  const ensure = (id: string): { host: number; nearby: number; far: number; total: number } => {
    let entry = roleCounts.get(id);
    if (!entry) {
      entry = { host: 0, nearby: 0, far: 0, total: 0 };
      roleCounts.set(id, entry);
    }
    return entry;
  };

  for (let day = 1; day <= competition.dayCount; day++) {
    const dayData = competition.days[day];
    if (!dayData || dayData.pf) continue;

    for (const pool of dayData.pools.values()) {
      if (pool.teams.length < 3) continue;
      const host = pool.teams[0];
      const entry = ensure(host.id);
      entry.host++;
      entry.total++;

      const d1 = getTeamDistance(host, pool.teams[1], clubLocations);
      const d2 = getTeamDistance(host, pool.teams[2], clubLocations);

      if (d1 <= d2) {
        const e1 = ensure(pool.teams[1].id);
        e1.nearby++;
        e1.total++;
        const e2 = ensure(pool.teams[2].id);
        e2.far++;
        e2.total++;
      } else {
        const e1 = ensure(pool.teams[1].id);
        e1.far++;
        e1.total++;
        const e2 = ensure(pool.teams[2].id);
        e2.nearby++;
        e2.total++;
      }
    }
  }

  // Compute average deviation from ideal 1/3 split
  let totalDeviation = 0;
  let teamCount = 0;
  for (const entry of roleCounts.values()) {
    if (entry.total < 2) continue;
    teamCount++;
    const ideal = entry.total / 3;
    totalDeviation += Math.abs(entry.host - ideal) + Math.abs(entry.nearby - ideal) + Math.abs(entry.far - ideal);
  }

  return {
    consecutiveHostCount: consecutiveHostDetails.length,
    consecutiveHostDetails,
    roleEquityDeviation: teamCount > 0 ? totalDeviation / teamCount : 0,
    roleTeamCount: teamCount,
  };
};

// --- Main ---

const pct = (num: number, den: number): string => (den > 0 ? ((num / den) * 100).toFixed(1) + '%' : '0.0%');

const main = async (): Promise<void> => {
  await loadClubLocations();
  console.log('CDF Rule Validation: Hard and Soft Constraint Analysis');
  console.log(`Seasons: ${SEASONS.join(', ')} | Categories: ${CATEGORIES.join(', ')}`);
  console.log('='.repeat(100));

  // Aggregate accumulators
  let totalSharedPool = 0;
  let totalThreeFirsts = 0;
  let totalNoFirst = 0;
  let totalPools = 0;
  let totalPairs = 0;
  let totalConsecutiveHost = 0;
  let totalRoleDeviation = 0;
  let totalRoleTeams = 0;
  let processedComps = 0;

  // Per-season accumulators
  const seasonSummary = new Map<
    number,
    { pools: number; pairs: number; sharedPool: number; threeFirsts: number; noFirst: number; consecutive: number }
  >();
  for (const season of SEASONS) {
    seasonSummary.set(season, { pools: 0, pairs: 0, sharedPool: 0, threeFirsts: 0, noFirst: 0, consecutive: 0 });
  }

  for (const season of SEASONS) {
    for (const category of CATEGORIES) {
      let competition: Competition;
      try {
        competition = await loadCompetition(season, category);
      } catch {
        continue;
      }
      if (competition.dayCount === 0) continue;
      processedComps++;

      const label = `${seasonToString(season)} ${category}`;
      const hard = checkHardRules(competition);
      const soft = checkSoftRules(competition);

      const hardOk = hard.sharedPoolViolations === 0 && hard.threeFirstsViolations === 0;
      const status = hardOk ? 'PASS' : 'FAIL';

      console.log(
        `${label.padEnd(15)} ${status.padEnd(6)} pools=${hard.totalPools.toString().padStart(4)} pairs=${hard.totalPairs.toString().padStart(5)} ` +
          `shared=${hard.sharedPoolViolations} 3firsts=${hard.threeFirstsViolations} 0firsts=${hard.noFirstViolations} ` +
          `consecutive=${soft.consecutiveHostCount} equity_dev=${soft.roleEquityDeviation.toFixed(2)}`,
      );

      // Log consecutive host details
      for (const detail of soft.consecutiveHostDetails) {
        console.log(`  ⚠ Consecutive host: ${detail.teamName} days ${detail.days.join('→')}`);
      }

      // Accumulate
      totalSharedPool += hard.sharedPoolViolations;
      totalThreeFirsts += hard.threeFirstsViolations;
      totalNoFirst += hard.noFirstViolations;
      totalPools += hard.totalPools;
      totalPairs += hard.totalPairs;
      totalConsecutiveHost += soft.consecutiveHostCount;
      totalRoleDeviation += soft.roleEquityDeviation * soft.roleTeamCount;
      totalRoleTeams += soft.roleTeamCount;

      const ss = seasonSummary.get(season)!;
      ss.pools += hard.totalPools;
      ss.pairs += hard.totalPairs;
      ss.sharedPool += hard.sharedPoolViolations;
      ss.threeFirsts += hard.threeFirstsViolations;
      ss.noFirst += hard.noFirstViolations;
      ss.consecutive += soft.consecutiveHostCount;
    }
  }

  // --- Summary ---
  console.log('\n' + '='.repeat(100));
  console.log(`AGGREGATE RESULTS (${processedComps} competitions)\n`);

  console.log('HARD RULES:');
  console.log(`  Total pools:             ${totalPools}`);
  console.log(`  Total pairs:             ${totalPairs}`);
  console.log(
    `  Shared pool violations:  ${totalSharedPool} (${pct(totalSharedPool, totalPairs)}) — ${totalSharedPool === 0 ? '100% ENFORCED' : 'VIOLATIONS FOUND'}`,
  );
  console.log(
    `  Three-firsts violations: ${totalThreeFirsts} (${pct(totalThreeFirsts, totalPools)}) — ${totalThreeFirsts === 0 ? '100% ENFORCED' : 'VIOLATIONS FOUND'}`,
  );
  console.log(`  No-first violations:     ${totalNoFirst} (${pct(totalNoFirst, totalPools)})`);

  console.log('\nSOFT RULES:');
  console.log(`  Consecutive hosting:     ${totalConsecutiveHost} occurrences across ${processedComps} competitions`);
  console.log(
    `  Role equity deviation:   avg=${totalRoleTeams > 0 ? (totalRoleDeviation / totalRoleTeams).toFixed(2) : '0.00'} (sum |actual-N/3|, across ${totalRoleTeams} teams with 2+ days)`,
  );

  // Per-season breakdown
  console.log('\nPER-SEASON BREAKDOWN:');
  console.log(
    `${'Season'.padEnd(12)} ${'Pools'.padEnd(8)} ${'Pairs'.padEnd(8)} ${'Shared'.padEnd(8)} ${'3Firsts'.padEnd(8)} ${'0Firsts'.padEnd(8)} ${'Consecutive'}`,
  );
  console.log('-'.repeat(70));
  for (const season of SEASONS) {
    const ss = seasonSummary.get(season)!;
    console.log(
      `${seasonToString(season).padEnd(12)} ${ss.pools.toString().padEnd(8)} ${ss.pairs.toString().padEnd(8)} ${ss.sharedPool.toString().padEnd(8)} ${ss.threeFirsts.toString().padEnd(8)} ${ss.noFirst.toString().padEnd(8)} ${ss.consecutive}`,
    );
  }

  console.log(`\nDone. ${processedComps} competitions validated.`);
};

main().catch(console.error);
