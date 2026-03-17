import { type Competition, type Team } from './model';
import { type ClubLocations, getTeamCoords, getTeamDistance, haversineKm } from './model-geography';
import { filterThirdPlace, getSlidingDay, getVirtualPoolName, isDayPlayed, isTeamInCourse } from './model-helpers';
import { matchSorter } from './model-sorters';

// --- Types ---

export type PoolApproach = 'greedy-geographic' | 'swap-optimization' | 'geographic-clustering';

export interface RoleHistory {
  readonly host: number;
  readonly nearby: number;
  readonly far: number;
}

export interface PoolPredictionConfig {
  readonly approach: PoolApproach;
  readonly clubLocations: ClubLocations;
  readonly enableRoleEquity?: boolean;
  readonly debug?: boolean;
}

// --- Trace Logging ---

interface Trace {
  group: (label: string) => void;
  groupEnd: () => void;
  log: (...args: unknown[]) => void;
}

const nullTrace: Trace = {
  group: () => {},
  groupEnd: () => {},
  log: () => {},
};

const createTrace = (enabled: boolean): Trace =>
  enabled
    ? {
        group: (label: string) => console.group(label),
        groupEnd: () => console.groupEnd(),
        log: (...args: unknown[]) => console.log(...args),
      }
    : nullTrace;

export interface PoolPrediction {
  readonly poolMap: Map<string, string>;
  readonly pools: Team[][];
  readonly metrics: {
    readonly avgPairDistance: number;
    readonly avgHostDistance: number;
    readonly constraintViolations: number;
  };
}

// --- Constraint Helpers ---

const haveSharedPool = (a: Team, b: Team, day: number): boolean => {
  // day = current played day; check all days up to and including it
  for (let d = 1; d <= day; d++) {
    const poolA = a.pools[d];
    const poolB = b.pools[d];
    if (poolA && poolB && poolA === poolB) return true;
  }
  return false;
};

const hasThreeFirsts = (pool: Team[], day: number): boolean => {
  // day = current played day; check rankings from that day
  if (day < 1) return false;
  const firstCount = pool.filter((t) => t.ranking.pools[day] === 1).length;
  return firstCount >= 3;
};

const countViolations = (pools: Team[][], day: number): number => {
  let violations = 0;
  for (const pool of pools) {
    // Check shared pool constraint
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        if (haveSharedPool(pool[i], pool[j], day)) violations++;
      }
    }
    // Check 3 firsts constraint
    if (hasThreeFirsts(pool, day)) violations++;
  }
  return violations;
};

// --- Metrics ---

const computeMetrics = (pools: Team[][], clubLocations: ClubLocations, day: number): PoolPrediction['metrics'] => {
  let totalPairDist = 0;
  let pairCount = 0;
  let totalHostDist = 0;
  let hostCount = 0;

  for (const pool of pools) {
    if (pool.length < 2) continue;
    const host = pool[0];
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const d = getTeamDistance(pool[i], pool[j], clubLocations);
        if (d >= 0) {
          totalPairDist += d;
          pairCount++;
        }
      }
      if (i > 0) {
        const d = getTeamDistance(host, pool[i], clubLocations);
        if (d >= 0) {
          totalHostDist += d;
          hostCount++;
        }
      }
    }
  }

  return {
    avgPairDistance: pairCount > 0 ? totalPairDist / pairCount : 0,
    avgHostDistance: hostCount > 0 ? totalHostDist / hostCount : 0,
    constraintViolations: countViolations(pools, day),
  };
};

// --- Algorithm Config ---

const POOL_CONFIG = {
  nearFarWeights: [2.0, 1.0, 0.5] as const,
  equityWeight: 30,
  hostEquityThreshold: 20,
  repairMaxIter: 200,
  swapMaxIter: 100,
  clusterMaxIter: 50,
} as const;

// --- Asymmetric Travel Cost ---
// Rewards "1 close + 1 far" pools over "all medium" pools.
// For 3 pairwise distances sorted ascending, weights [2.0, 1.0, 0.5] make the optimizer
// prioritize having at least one short distance while tolerating one long one.

const travelCost = (pool: Team[], clubLocations: ClubLocations): number => {
  if (pool.length < 2) return 0;
  const distances: number[] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const d = getTeamDistance(pool[i], pool[j], clubLocations);
      if (d >= 0) distances.push(d);
    }
  }
  if (distances.length === 0) return 0;
  if (distances.length === 1) return distances[0];
  distances.sort((a, b) => a - b);
  let cost = 0;
  for (let i = 0; i < distances.length; i++) {
    cost += distances[i] * POOL_CONFIG.nearFarWeights[Math.min(i, POOL_CONFIG.nearFarWeights.length - 1)];
  }
  return cost;
};

const totalTravelCost = (pools: Team[][], clubLocations: ClubLocations): number => {
  let total = 0;
  for (const pool of pools) {
    total += travelCost(pool, clubLocations);
  }
  return total;
};

// --- Role Equity ---
// Computes each team's cumulative host/nearby/far counts from actual pools in days 1..day.

const computeRoleHistory = (
  competition: Competition,
  day: number,
  clubLocations: ClubLocations,
): Map<string, RoleHistory> => {
  const history = new Map<string, { host: number; nearby: number; far: number }>();

  const ensure = (id: string): { host: number; nearby: number; far: number } => {
    let entry = history.get(id);
    if (!entry) {
      entry = { host: 0, nearby: 0, far: 0 };
      history.set(id, entry);
    }
    return entry;
  };

  // day = current played day; include all days up to and including it
  for (let d = 1; d <= day; d++) {
    const dayData = competition.days[d];
    if (!dayData || dayData.pf) continue;
    for (const pool of dayData.pools.values()) {
      if (pool.teams.length < 3) continue;
      const host = pool.teams[0];
      ensure(host.id).host++;

      const d1 = getTeamDistance(host, pool.teams[1], clubLocations);
      const d2 = getTeamDistance(host, pool.teams[2], clubLocations);
      if (d1 < 0 || d2 < 0) {
        ensure(pool.teams[1].id).nearby++;
        ensure(pool.teams[2].id).nearby++;
        continue;
      }
      if (d1 <= d2) {
        ensure(pool.teams[1].id).nearby++;
        ensure(pool.teams[2].id).far++;
      } else {
        ensure(pool.teams[1].id).far++;
        ensure(pool.teams[2].id).nearby++;
      }
    }
  }

  return history;
};

const poolEquityPenalty = (
  pool: Team[],
  roleHistory: Map<string, RoleHistory>,
  clubLocations: ClubLocations,
): number => {
  if (pool.length < 3) return 0;

  const host = pool[0];
  const hostHistory = roleHistory.get(host.id) ?? { host: 0, nearby: 0, far: 0 };
  const totalHost = hostHistory.host + hostHistory.nearby + hostHistory.far;
  // Penalty if this team has already hosted more than its fair share
  const hostPenalty = totalHost > 0 ? Math.max(0, hostHistory.host / totalHost - 1 / 3) : 0;

  // Classify visitors as nearby/far
  const d1 = getTeamDistance(host, pool[1], clubLocations);
  const d2 = getTeamDistance(host, pool[2], clubLocations);
  let nearTeam: Team;
  let farTeam: Team;
  if (d1 >= 0 && d2 >= 0) {
    [nearTeam, farTeam] = d1 <= d2 ? [pool[1], pool[2]] : [pool[2], pool[1]];
  } else {
    return hostPenalty * POOL_CONFIG.equityWeight;
  }

  const nearHistory = roleHistory.get(nearTeam.id) ?? { host: 0, nearby: 0, far: 0 };
  const farHistory = roleHistory.get(farTeam.id) ?? { host: 0, nearby: 0, far: 0 };
  const totalNear = nearHistory.host + nearHistory.nearby + nearHistory.far;
  const totalFar = farHistory.host + farHistory.nearby + farHistory.far;

  // Penalty if the "nearby" team already has too many nearby roles
  const nearPenalty = totalNear > 0 ? Math.max(0, nearHistory.nearby / totalNear - 1 / 3) : 0;
  // Penalty if the "far" team already has too many far roles
  const farPenalty = totalFar > 0 ? Math.max(0, farHistory.far / totalFar - 1 / 3) : 0;

  return (hostPenalty + nearPenalty + farPenalty) * POOL_CONFIG.equityWeight;
};

const totalEquityPenalty = (
  pools: Team[][],
  roleHistory: Map<string, RoleHistory>,
  clubLocations: ClubLocations,
): number => {
  let total = 0;
  for (const pool of pools) {
    total += poolEquityPenalty(pool, roleHistory, clubLocations);
  }
  return total;
};

// --- Swap Improvement Loop ---
// Shared loop: tentatively swap every pair of teams between pools, accept via callback.
// The callback sees the post-swap state and returns true to keep or false to revert.

const improveBySwapping = (
  pools: Team[][],
  maxIter: number,
  shouldAccept: (p: number, q: number, i: number, j: number, ti: Team, tj: Team) => boolean,
  breakOnFirst = false,
): number => {
  let swapCount = 0;
  for (let iter = 0; iter < maxIter; iter++) {
    let improved = false;
    for (let p = 0; p < pools.length && !(breakOnFirst && improved); p++) {
      for (let q = p + 1; q < pools.length && !(breakOnFirst && improved); q++) {
        for (let i = 0; i < pools[p].length && !(breakOnFirst && improved); i++) {
          for (let j = 0; j < pools[q].length && !(breakOnFirst && improved); j++) {
            const ti = pools[p][i];
            const tj = pools[q][j];
            pools[p][i] = tj;
            pools[q][j] = ti;
            if (shouldAccept(p, q, i, j, ti, tj)) {
              swapCount++;
              improved = true;
            } else {
              pools[p][i] = ti;
              pools[q][j] = tj;
            }
          }
        }
      }
    }
    if (!improved) break;
  }
  return swapCount;
};

// --- Constraint Repair ---
// Swaps teams between pools to eliminate violations, even at the cost of distance.

const repairViolations = (pools: Team[][], day: number, trace: Trace): void => {
  let violations = countViolations(pools, day);
  let swapCount = 0;
  improveBySwapping(
    pools,
    POOL_CONFIG.repairMaxIter,
    (p, q, _i, _j, ti, tj) => {
      const newViolations = countViolations(pools, day);
      if (newViolations < violations) {
        swapCount++;
        trace.log(
          `Swap ${swapCount}: Pool ${getVirtualPoolName(p)} ↔ Pool ${getVirtualPoolName(q)} — ${ti.name} ↔ ${tj.name} — violations ${violations}→${newViolations}`,
        );
        violations = newViolations;
        return true;
      }
      return false;
    },
    true,
  );
};

// --- Pool map builder ---

const buildPoolMap = (pools: Team[][]): Map<string, string> => {
  const map = new Map<string, string>();
  pools.forEach((pool, idx) => {
    const name = getVirtualPoolName(idx);
    pool.forEach((team) => map.set(team.id, name));
  });
  return map;
};

// --- Host Selection ---
// Closest-to-centroid with two equity refinements:
// 1. Avoid consecutive hosting: skip teams that hosted on the previous day
// 2. Role equity tie-breaking: within 20km threshold, prefer least-hosted team

const getDayHosts = (competition: Competition, day: number, trace: Trace = nullTrace): Set<string> => {
  const hosts = new Set<string>();
  const dayData = competition.days[day];
  if (!dayData || dayData.pf || dayData.pools.size === 0) {
    trace.log(`getDayHosts: day ${day} — no valid pool data`);
    return hosts;
  }
  for (const pool of dayData.pools.values()) {
    if (pool.teams.length >= 3) {
      hosts.add(pool.teams[0].id);
    }
  }
  trace.log(`getDayHosts: day ${day} — ${hosts.size} hosts from ${dayData.pools.size} pools`);
  return hosts;
};

// Among candidates within threshold of the best, pick the team with fewest prior hostings.
const pickLeastHosted = (
  candidates: { idx: number; dist: number }[],
  pool: Team[],
  roleHistory: Map<string, RoleHistory>,
): { idx: number; reason: string } | undefined => {
  if (candidates.length < 2) return undefined;
  const bestDist = candidates[0].dist;
  const withinThreshold = candidates.filter((c) => c.dist <= bestDist + POOL_CONFIG.hostEquityThreshold);
  if (withinThreshold.length <= 1) return undefined;
  let minHostCount = Infinity;
  let bestIdx = candidates[0].idx;
  for (const c of withinThreshold) {
    const h = roleHistory.get(pool[c.idx].id);
    const hostCount = h ? h.host : 0;
    if (hostCount < minHostCount) {
      minHostCount = hostCount;
      bestIdx = c.idx;
    }
  }
  const chosen = roleHistory.get(pool[bestIdx].id);
  return { idx: bestIdx, reason: `equity pick host_count=${chosen?.host ?? 0}` };
};

const selectHosts = (
  pools: Team[][],
  clubLocations: ClubLocations,
  roleHistory?: Map<string, RoleHistory>,
  currentDayHosts?: Set<string>,
  trace: Trace = nullTrace,
): void => {
  for (const [poolIdx, pool] of pools.entries()) {
    if (pool.length < 2) continue;
    const coords = pool
      .map((t) => getTeamCoords(t, clubLocations))
      .filter((c): c is [number, number] => c !== undefined);
    if (coords.length === 0) continue;
    const centroidLat = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    const centroidLon = coords.reduce((s, c) => s + c[1], 0) / coords.length;

    // Compute centroid distances
    const centroidDists = pool.map((t, i) => {
      const tc = getTeamCoords(t, clubLocations);
      return { idx: i, dist: tc ? haversineKm(tc[0], tc[1], centroidLat, centroidLon) : Infinity };
    });
    centroidDists.sort((a, b) => a.dist - b.dist);

    let bestIdx = centroidDists[0].idx;
    let reason = `centroid: ${Math.round(centroidDists[0].dist)}km`;

    // Filter out previous-day hosts if possible (soft constraint — only skip if alternatives exist)
    if (currentDayHosts) {
      const nonConsecutive = centroidDists.filter((c) => !currentDayHosts.has(pool[c.idx].id));
      if (nonConsecutive.length > 0) {
        bestIdx = nonConsecutive[0].idx;
        const skipped = centroidDists.filter((c) => currentDayHosts.has(pool[c.idx].id));
        if (skipped.length > 0) {
          reason = `centroid: ${Math.round(nonConsecutive[0].dist)}km — skipped ${skipped.map((c) => pool[c.idx].name).join(', ')} (hosted yesterday)`;
        }
        if (roleHistory) {
          const equity = pickLeastHosted(nonConsecutive, pool, roleHistory);
          if (equity) {
            bestIdx = equity.idx;
            reason += ` — ${equity.reason}`;
          }
        }
      } else {
        reason += ' — all candidates hosted yesterday, using centroid-closest';
      }
    } else if (roleHistory) {
      const equity = pickLeastHosted(centroidDists, pool, roleHistory);
      if (equity) {
        bestIdx = equity.idx;
        reason = `centroid: ${Math.round(centroidDists[0].dist)}km — ${equity.reason}`;
      }
    }

    if (bestIdx !== 0) {
      [pool[0], pool[bestIdx]] = [pool[bestIdx], pool[0]];
    }

    // Escape hatch: if chosen host hosted yesterday, swap with nearby team (if it didn't host yesterday)
    if (currentDayHosts?.has(pool[0].id) && pool.length >= 3) {
      const d1 = getTeamDistance(pool[0], pool[1], clubLocations);
      const d2 = getTeamDistance(pool[0], pool[2], clubLocations);
      const nearbyIdx = d1 >= 0 && d2 >= 0 ? (d1 <= d2 ? 1 : 2) : 1;
      if (!currentDayHosts.has(pool[nearbyIdx].id)) {
        reason += ` → escape hatch: swapped with nearby ${pool[nearbyIdx].name}`;
        [pool[0], pool[nearbyIdx]] = [pool[nearbyIdx], pool[0]];
      }
    }

    trace.log(`Pool ${getVirtualPoolName(poolIdx)}: picked ${pool[0].name} (${reason})`);
  }
};

// --- Approach A: Greedy Geographic ---

const greedyGeographic = (
  teams: Team[],
  numPools: number,
  day: number,
  clubLocations: ClubLocations,
  trace: Trace = nullTrace,
): Team[][] => {
  // teams are already sorted by ranking from predictPools

  // Select hosts: spread by latitude
  const withCoords = teams
    .map((t) => ({ team: t, coords: getTeamCoords(t, clubLocations) }))
    .filter((x) => x.coords !== undefined) as Array<{ team: Team; coords: [number, number] }>;

  withCoords.sort((a, b) => a.coords[0] - b.coords[0]);

  const hosts: Team[] = [];
  const stride = Math.max(1, Math.floor(withCoords.length / numPools));
  const usedDepts = new Set<string>();

  for (let idx = Math.floor(stride / 2); idx < withCoords.length && hosts.length < numPools; idx += stride) {
    const candidate = withCoords[idx];
    if (!usedDepts.has(candidate.team.department.num_dep)) {
      usedDepts.add(candidate.team.department.num_dep);
      hosts.push(candidate.team);
    }
  }

  // Second pass: fill remaining slots skipping already-selected teams
  if (hosts.length < numPools) {
    for (const entry of withCoords) {
      if (hosts.length >= numPools) break;
      if (!hosts.includes(entry.team)) {
        hosts.push(entry.team);
      }
    }
  }

  // Initialize pools with hosts
  const pools: Team[][] = hosts.slice(0, numPools).map((h) => [h]);
  const assigned = new Set(hosts.slice(0, numPools).map((h) => h.id));
  trace.log(
    `Hosts: ${hosts
      .slice(0, numPools)
      .map((h) => h.name)
      .join(', ')}`,
  );

  // Remaining teams sorted by distance to nearest host
  const remaining = teams.filter((t: Team) => !assigned.has(t.id));
  const minHostDist = (team: Team): number => {
    const distances = pools.map((p) => getTeamDistance(team, p[0], clubLocations)).filter((d) => d >= 0);
    return distances.length > 0 ? Math.min(...distances) : Infinity;
  };
  remaining.sort((a: Team, b: Team) => {
    const aDist = minHostDist(a);
    const bDist = minHostDist(b);
    if (!isFinite(aDist) && !isFinite(bDist)) return 0;
    return aDist - bDist;
  });

  // Assign each remaining team to closest valid pool
  for (const team of remaining) {
    const poolDistances = pools
      .map((pool, idx) => ({
        idx,
        dist: getTeamDistance(team, pool[0], clubLocations),
        violations: pool.some((member) => haveSharedPool(team, member, day)),
        full: pool.length >= 3,
        threeFirsts: hasThreeFirsts([...pool, team], day),
      }))
      .filter((p) => !p.full)
      .sort((a, b) => {
        // Prefer no violations, then closest
        if (a.violations !== b.violations) return a.violations ? 1 : -1;
        if (a.threeFirsts !== b.threeFirsts) return a.threeFirsts ? 1 : -1;
        return a.dist - b.dist;
      });

    if (poolDistances.length > 0) {
      const choice = poolDistances[0];
      pools[choice.idx].push(team);
      trace.log(
        `Assign ${team.name} → Pool ${getVirtualPoolName(choice.idx)} (dist=${Math.round(choice.dist)}km${choice.violations ? ', ⚠ violation' : ''})`,
      );
    }
  }

  return pools;
};

// --- Approach B: Swap Optimization ---

const swapOptimization = (
  teams: Team[],
  numPools: number,
  day: number,
  clubLocations: ClubLocations,
  roleHistory?: Map<string, RoleHistory>,
  currentDayHosts?: Set<string>,
  trace: Trace = nullTrace,
): Team[][] => {
  // Start from serpentine assignment
  const sorted = [...teams];
  const pools: Team[][] = Array.from({ length: numPools }, () => []);

  for (let i = 0; i < numPools * 3 && i < sorted.length; i++) {
    const row = Math.floor(i / numPools);
    const posInRow = i % numPools;
    const poolIndex = row % 2 === 0 ? posInRow : numPools - 1 - posInRow;
    pools[poolIndex].push(sorted[i]);
  }

  const combinedCost = (ps: Team[][]): number => {
    let cost = totalTravelCost(ps, clubLocations);
    if (roleHistory) cost += totalEquityPenalty(ps, roleHistory, clubLocations);
    return cost;
  };

  let currentCost = combinedCost(pools);
  let currentViolations = countViolations(pools, day);
  let swapCount = 0;

  // Iterative swap improvement: prioritize violation reduction, then combined cost
  improveBySwapping(pools, POOL_CONFIG.swapMaxIter, (p, q, _i, _j, ti, tj) => {
    const newViolations = countViolations(pools, day);
    const newCost = combinedCost(pools);
    const fewerViolations = newViolations < currentViolations;
    const betterCost = newViolations <= currentViolations && newCost < currentCost;
    if (fewerViolations || betterCost) {
      swapCount++;
      if (fewerViolations) {
        trace.log(
          `Swap ${swapCount}: Pool ${getVirtualPoolName(p)} ↔ Pool ${getVirtualPoolName(q)} — ${ti.name} ↔ ${tj.name} — violations ${currentViolations}→${newViolations}`,
        );
      } else {
        trace.log(
          `Swap ${swapCount}: Pool ${getVirtualPoolName(p)} ↔ Pool ${getVirtualPoolName(q)} — ${ti.name} ↔ ${tj.name} — cost ${Math.round(currentCost)}→${Math.round(newCost)} (violations=${newViolations})`,
        );
      }
      currentViolations = newViolations;
      currentCost = newCost;
      return true;
    }
    return false;
  });

  trace.log(`Total: ${swapCount} accepted swaps, violations=${currentViolations}, cost=${Math.round(currentCost)}`);

  // Set host: closest-to-centroid, with equity and consecutive-hosting avoidance
  trace.group('Host selection');
  selectHosts(pools, clubLocations, roleHistory, currentDayHosts, trace);
  trace.groupEnd();

  return pools;
};

// --- Approach C: Geographic Clustering ---

const geographicClustering = (
  teams: Team[],
  numPools: number,
  day: number,
  clubLocations: ClubLocations,
  roleHistory?: Map<string, RoleHistory>,
  currentDayHosts?: Set<string>,
  trace: Trace = nullTrace,
): Team[][] => {
  // Sort teams by latitude
  const withCoords = teams
    .map((t) => ({ team: t, coords: getTeamCoords(t, clubLocations) }))
    .filter((x) => x.coords !== undefined) as Array<{ team: Team; coords: [number, number] }>;
  const withoutCoords = teams.filter((t) => getTeamCoords(t, clubLocations) === undefined);

  withCoords.sort((a, b) => a.coords[0] - b.coords[0]);

  // Group into consecutive chunks of 3
  const pools: Team[][] = [];
  for (let i = 0; i < numPools; i++) {
    const start = i * 3;
    const chunk: Team[] = [];
    for (let j = start; j < Math.min(start + 3, withCoords.length); j++) {
      chunk.push(withCoords[j].team);
    }
    pools.push(chunk);
  }

  // Add teams without coordinates to smallest pools
  for (const team of withoutCoords) {
    const smallest = pools.reduce((min, pool, idx) => (pool.length < pools[min].length ? idx : min), 0);
    if (pools[smallest].length < 3) {
      pools[smallest].push(team);
    }
  }

  const pairCost = (p: number, q: number): number => {
    let cost = travelCost(pools[p], clubLocations) + travelCost(pools[q], clubLocations);
    if (roleHistory) {
      cost += poolEquityPenalty(pools[p], roleHistory, clubLocations);
      cost += poolEquityPenalty(pools[q], roleHistory, clubLocations);
    }
    return cost;
  };

  // Refinement: local swap optimization using asymmetric travel cost + equity
  let currentTotalViolations = countViolations(pools, day);
  let swapCount = 0;
  improveBySwapping(pools, POOL_CONFIG.clusterMaxIter, (p, q, i, j, ti, tj) => {
    // Compute pre-swap pair cost by temporarily reverting
    pools[p][i] = ti;
    pools[q][j] = tj;
    const oldCost = pairCost(p, q);
    pools[p][i] = tj;
    pools[q][j] = ti;

    const newViolations = countViolations(pools, day);
    const newCost = pairCost(p, q);
    const fewerViolations = newViolations < currentTotalViolations;
    const betterCost = newViolations <= currentTotalViolations && newCost < oldCost;
    if (fewerViolations || betterCost) {
      swapCount++;
      if (fewerViolations) {
        trace.log(
          `Swap ${swapCount}: Pool ${getVirtualPoolName(p)} ↔ Pool ${getVirtualPoolName(q)} — ${ti.name} ↔ ${tj.name} — violations ${currentTotalViolations}→${newViolations}`,
        );
      } else {
        trace.log(
          `Swap ${swapCount}: Pool ${getVirtualPoolName(p)} ↔ Pool ${getVirtualPoolName(q)} — ${ti.name} ↔ ${tj.name} — cost ${Math.round(oldCost)}→${Math.round(newCost)} (violations=${newViolations})`,
        );
      }
      currentTotalViolations = newViolations;
      return true;
    }
    return false;
  });

  trace.log(`Total: ${swapCount} accepted swaps, violations=${currentTotalViolations}`);

  // Select host per pool with equity and consecutive-hosting avoidance
  trace.group('Host selection');
  selectHosts(pools, clubLocations, roleHistory, currentDayHosts, trace);
  trace.groupEnd();

  return pools;
};

// --- Pool Audit ---

const auditPools = (
  pools: Team[][],
  day: number,
  clubLocations: ClubLocations,
  roleHistory: Map<string, RoleHistory> | undefined,
  currentDayHosts: Set<string> | undefined,
  trace: Trace,
): void => {
  let totalSharedPool = 0;
  let totalNoFirst = 0;
  let totalThreeFirsts = 0;
  let totalConsecutiveHost = 0;
  let totalEquityPenalty = 0;
  let totalTravel = 0;
  let poolCount = 0;

  trace.group('Final pool audit');
  for (const [idx, pool] of pools.entries()) {
    if (pool.length < 2) continue;
    poolCount++;
    const poolName = getVirtualPoolName(idx);
    const host = pool[0];

    // Classify roles by distance to host — identify nearby team for escape hatch
    const roles: string[] = ['Host'];
    let nearbyTeam: Team | undefined;
    if (pool.length >= 3) {
      const d1 = getTeamDistance(host, pool[1], clubLocations);
      const d2 = getTeamDistance(host, pool[2], clubLocations);
      if (d1 >= 0 && d2 >= 0) {
        if (d1 <= d2) {
          nearbyTeam = pool[1];
          roles.push(`Nearby(${Math.round(d1)}km)`, `Far(${Math.round(d2)}km)`);
        } else {
          nearbyTeam = pool[2];
          roles.push(`Nearby(${Math.round(d2)}km)`, `Far(${Math.round(d1)}km)`);
        }
      } else {
        roles.push(`?(${Math.round(Math.max(d1, 0))}km)`, `?(${Math.round(Math.max(d2, 0))}km)`);
      }
    } else if (pool.length === 2) {
      const d = getTeamDistance(host, pool[1], clubLocations);
      nearbyTeam = pool[1];
      roles.push(d >= 0 ? `Visitor(${Math.round(d)}km)` : '?');
    }

    const warnings: string[] = [];

    // Hard rule: shared pool
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        if (haveSharedPool(pool[i], pool[j], day)) {
          totalSharedPool++;
          // Find which day they shared
          for (let d = 1; d <= day; d++) {
            if (pool[i].pools[d] && pool[j].pools[d] && pool[i].pools[d] === pool[j].pools[d]) {
              warnings.push(`shared pool (${pool[i].name} & ${pool[j].name}, day ${d})`);
              break;
            }
          }
        }
      }
    }

    // Hard rule: firsts distribution (at least 1 first, at most 2 firsts per pool)
    if (day > 1) {
      const firstCount = pool.filter((t) => t.ranking.pools[day] === 1).length;
      if (firstCount === 0) {
        totalNoFirst++;
        warnings.push('0 firsts');
      } else if (firstCount >= 3) {
        totalThreeFirsts++;
        warnings.push(`${firstCount} firsts`);
      }
    }

    // Soft rule: consecutive hosting — with escape hatch suggestion
    if (currentDayHosts?.has(host.id)) {
      totalConsecutiveHost++;
      if (nearbyTeam) {
        warnings.push(`host hosted yesterday → swap nearby ${nearbyTeam.name} as host?`);
      } else {
        warnings.push('host hosted yesterday');
      }
    }

    // Soft rule: equity penalty
    if (roleHistory) {
      const penalty = poolEquityPenalty(pool, roleHistory, clubLocations);
      totalEquityPenalty += penalty;
    }

    // Travel cost
    const cost = travelCost(pool, clubLocations);
    totalTravel += cost;

    const teamNames = pool.map((t) => t.name).join(', ');
    const roleStr = roles.join(', ');
    const status = warnings.length === 0 ? 'OK' : warnings.map((w) => `⚠ ${w}`).join(', ');
    trace.log(`Pool ${poolName}: [${roleStr}] ${teamNames} — ${status}`);
  }
  trace.groupEnd();

  trace.group('Summary');
  trace.log(
    `Hard rules:  shared_pool=${totalSharedPool}  no_first=${totalNoFirst}  three_firsts=${totalThreeFirsts}  total_violations=${totalSharedPool + totalNoFirst + totalThreeFirsts}`,
  );
  trace.log(
    `Soft rules:  consecutive_hosting=${totalConsecutiveHost}  equity_penalty=${totalEquityPenalty.toFixed(1)}km  avg_travel=${poolCount > 0 ? Math.round(totalTravel / poolCount) : 0}km`,
  );
  trace.groupEnd();
};

// --- Last Played Pool Day ---
// Finds the most recent day with actual pool data, searching backward from `day`.
// Used to resolve hosts and rankings when `day` itself may not be played yet.

const findLastPlayedPoolDay = (competition: Competition, day: number): number => {
  for (let d = day; d >= 1; d--) {
    const dayData = competition.days[d];
    if (dayData && !dayData.pf && dayData.pools.size > 0) return d;
  }
  return 0;
};

// --- Main Entry Point ---

export const predictPools = (competition: Competition, day: number, config: PoolPredictionConfig): PoolPrediction => {
  const trace = createTrace(config.debug ?? false);

  // Get teams in course
  const allTeams = Array.from(competition.teams.values()).filter((t) => isTeamInCourse(competition, t, day));

  // Filter 3rd-place eliminated teams if current day is played
  const isPFday = competition.days[day]?.pf;
  const teams = !isPFday && isDayPlayed(competition, day) ? filterThirdPlace(allTeams, day) : allTeams;

  // Sort by sliding window ranking
  const slidingDay = getSlidingDay(competition, day);
  const sorted = [...teams].sort(matchSorter(slidingDay, true, true, 4));

  const numPools = Math.floor(sorted.length / 3);
  if (numPools === 0) {
    return {
      poolMap: new Map(),
      pools: [],
      metrics: { avgPairDistance: 0, avgHostDistance: 0, constraintViolations: 0 },
    };
  }

  // Only use the top numPools*3 teams
  const eligible = sorted.slice(0, numPools * 3);

  // Resolve the last played pool day — may differ from `day` if it's not yet played
  const lastPoolDay = findLastPlayedPoolDay(competition, day);

  // Compute role history and current-day hosts if equity is enabled
  const roleHistory = config.enableRoleEquity
    ? computeRoleHistory(competition, lastPoolDay, config.clubLocations)
    : undefined;
  const currentDayHosts = config.enableRoleEquity ? getDayHosts(competition, lastPoolDay, trace) : undefined;

  trace.group(
    `predictPools: Day ${day}, ${config.approach}, ${eligible.length} teams → ${numPools} pools, equity=${config.enableRoleEquity ? 'ON' : 'OFF'}`,
  );
  if (lastPoolDay !== day) {
    trace.log(`Last played pool day: ${lastPoolDay} (day ${day} not yet played)`);
  }
  trace.log(`Input: ${eligible.length} teams, sliding rank [1..${eligible.length}]`);
  if (roleHistory) {
    trace.log(`Role history: ${roleHistory.size} teams with prior data`);
  }
  if (currentDayHosts && currentDayHosts.size > 0) {
    const hostNames = [...currentDayHosts].map((id) => eligible.find((t) => t.id === id)?.name ?? id).join(', ');
    trace.log(`Current-day hosts (${currentDayHosts.size}): ${hostNames}`);
  }

  // Delegate to approach — use lastPoolDay for constraint checks (shared pools, firsts rankings)
  let pools: Team[][];
  switch (config.approach) {
    case 'greedy-geographic':
      trace.group(`Greedy geographic`);
      pools = greedyGeographic(eligible, numPools, lastPoolDay, config.clubLocations, trace);
      trace.groupEnd();
      trace.group('Host selection (post-hoc)');
      selectHosts(pools, config.clubLocations, roleHistory, currentDayHosts, trace);
      trace.groupEnd();
      break;
    case 'swap-optimization':
      trace.group('Swap optimization');
      pools = swapOptimization(
        eligible,
        numPools,
        lastPoolDay,
        config.clubLocations,
        roleHistory,
        currentDayHosts,
        trace,
      );
      trace.groupEnd();
      break;
    case 'geographic-clustering':
      trace.group('Geographic clustering');
      pools = geographicClustering(
        eligible,
        numPools,
        lastPoolDay,
        config.clubLocations,
        roleHistory,
        currentDayHosts,
        trace,
      );
      trace.groupEnd();
      break;
  }

  // Final repair pass to eliminate any remaining constraint violations
  const preRepairViolations = countViolations(pools, lastPoolDay);
  if (preRepairViolations > 0) {
    trace.group(`Repair violations (${preRepairViolations} remaining)`);
    repairViolations(pools, lastPoolDay, trace);
    trace.groupEnd();
  }

  auditPools(pools, lastPoolDay, config.clubLocations, roleHistory, currentDayHosts, trace);

  trace.groupEnd(); // predictPools

  return {
    poolMap: buildPoolMap(pools),
    pools,
    metrics: computeMetrics(pools, config.clubLocations, lastPoolDay),
  };
};
