import { type Competition, type Team } from './model';
import { type ClubLocations, getTeamCoords, getTeamDistance, haversineKm } from './model-geography';
import { filterThirdPlace, getSlidingDay, getVirtualPoolName, isDayPlayed, isTeamInCourse } from './model-helpers';
import { matchSorter } from './model-sorters';

// --- Types ---

export type PoolApproach = 'greedy-geographic' | 'swap-optimization' | 'geographic-clustering' | 'role-priority';

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
    readonly distanceStdDev: number;
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

const hasNoFirst = (pool: Team[], day: number): boolean => {
  if (day < 2) return false;
  const firstCount = pool.filter((t) => t.ranking.pools[day] === 1).length;
  return firstCount === 0;
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
    // Check firsts distribution (at least 1, at most 2)
    if (hasNoFirst(pool, day)) violations++;
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
        totalPairDist += getTeamDistance(pool[i], pool[j], clubLocations);
        pairCount++;
      }
      if (i > 0) {
        totalHostDist += getTeamDistance(host, pool[i], clubLocations);
        hostCount++;
      }
    }
  }

  const poolDistances = pools.map((p) => poolHostDistance(p, clubLocations));
  const poolMean = poolDistances.length > 1 ? poolDistances.reduce((s, d) => s + d, 0) / poolDistances.length : 0;
  const poolVariance =
    poolDistances.length > 1 ? poolDistances.reduce((s, d) => s + (d - poolMean) ** 2, 0) / poolDistances.length : 0;

  return {
    avgPairDistance: pairCount > 0 ? totalPairDist / pairCount : 0,
    avgHostDistance: hostCount > 0 ? totalHostDist / hostCount : 0,
    constraintViolations: countViolations(pools, day),
    distanceStdDev: Math.sqrt(poolVariance),
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
  balanceWeight: 1.5, // penalty per km of stddev between pool host distances
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
      distances.push(getTeamDistance(pool[i], pool[j], clubLocations));
    }
  }
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

// --- Distance Balance ---
// Penalizes variance in per-pool host distances to balance travel across pools.

const poolHostDistance = (pool: Team[], clubLocations: ClubLocations): number => {
  if (pool.length < 2) return 0;
  const host = pool[0];
  let total = 0;
  for (let i = 1; i < pool.length; i++) {
    total += getTeamDistance(host, pool[i], clubLocations);
  }
  return total;
};

const distanceBalancePenalty = (pools: Team[][], clubLocations: ClubLocations): number => {
  const distances = pools.map((p) => poolHostDistance(p, clubLocations));
  if (distances.length < 2) return 0;
  const mean = distances.reduce((s, d) => s + d, 0) / distances.length;
  const variance = distances.reduce((s, d) => s + (d - mean) ** 2, 0) / distances.length;
  return Math.sqrt(variance) * POOL_CONFIG.balanceWeight;
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

// --- Per-Day Role Tracking ---
// Returns per-team roles for the last N days: 'host' | 'nearby' | 'far' | undefined
// Most recent day first in the array (index 0 = most recent)

type DayRole = 'host' | 'nearby' | 'far' | undefined;

const computePerDayRoles = (
  competition: Competition,
  day: number,
  clubLocations: ClubLocations,
  lookback: number = 3,
): Map<string, DayRole[]> => {
  const result = new Map<string, DayRole[]>();
  const startDay = Math.max(1, day - lookback + 1);

  // Collect roles for each day in the lookback window
  const dayRoles: Map<string, DayRole>[] = [];
  for (let d = startDay; d <= day; d++) {
    const dayData = competition.days[d];
    const roles = new Map<string, DayRole>();
    if (dayData && !dayData.pf) {
      for (const pool of dayData.pools.values()) {
        if (pool.teams.length < 3) continue;
        const host = pool.teams[0];
        roles.set(host.id, 'host');

        const d1 = getTeamDistance(host, pool.teams[1], clubLocations);
        const d2 = getTeamDistance(host, pool.teams[2], clubLocations);
        if (d1 <= d2) {
          roles.set(pool.teams[1].id, 'nearby');
          roles.set(pool.teams[2].id, 'far');
        } else {
          roles.set(pool.teams[1].id, 'far');
          roles.set(pool.teams[2].id, 'nearby');
        }
      }
    }
    dayRoles.push(roles);
  }

  // Build per-team arrays, most recent day first
  const allTeamIds = new Set<string>();
  for (const roles of dayRoles) {
    for (const id of roles.keys()) allTeamIds.add(id);
  }
  for (const id of allTeamIds) {
    const roles: DayRole[] = [];
    for (let i = dayRoles.length - 1; i >= 0; i--) {
      roles.push(dayRoles[i].get(id));
    }
    result.set(id, roles);
  }

  return result;
};

// --- Host Need Score ---
// Higher score = team has traveled more recently = higher priority to host

const ROLE_WEIGHTS: Record<string, number> = { far: 2, nearby: 1, host: 0 };
const RECENCY_WEIGHTS = [1.0, 0.5, 0.25];
const DEFAULT_ROLE_WEIGHT = 1; // neutral for teams without history

const computeHostNeedScore = (roles: DayRole[]): number => {
  let score = 0;
  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    const roleW = role !== undefined ? (ROLE_WEIGHTS[role] ?? DEFAULT_ROLE_WEIGHT) : DEFAULT_ROLE_WEIGHT;
    const recencyW = i < RECENCY_WEIGHTS.length ? RECENCY_WEIGHTS[i] : 0;
    score += roleW * recencyW;
  }
  return score;
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
  const [nearTeam, farTeam] = d1 <= d2 ? [pool[1], pool[2]] : [pool[2], pool[1]];

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
  day?: number,
): void => {
  for (const [poolIdx, pool] of pools.entries()) {
    if (pool.length < 2) continue;
    const coords = pool.map((t) => getTeamCoords(t, clubLocations));
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
      const nearbyIdx = d1 <= d2 ? 1 : 2;
      if (!currentDayHosts.has(pool[nearbyIdx].id)) {
        reason += ` → escape hatch: swapped with nearby ${pool[nearbyIdx].name}`;
        [pool[0], pool[nearbyIdx]] = [pool[nearbyIdx], pool[0]];
      }
    }

    trace.log(`Pool ${getVirtualPoolName(poolIdx)}: picked ${pool[0].name} (${reason})`);
  }

  // --- Cross-pool repair pass: eliminate remaining consecutive hostings ---
  // Evaluate all valid candidates and pick the one with the least distance penalty
  if (currentDayHosts && currentDayHosts.size > 0) {
    const problemPools = pools
      .map((pool, idx) => ({ pool, idx }))
      .filter(({ pool }) => pool.length >= 2 && currentDayHosts.has(pool[0].id));

    for (const { pool: problemPool, idx: problemIdx } of problemPools) {
      interface Candidate {
        donorIdx: number;
        k: number;
        costDelta: number;
      }
      const candidates: Candidate[] = [];
      const stuckHost = problemPool[0];
      const preProblemCost = travelCost(problemPool, clubLocations);

      for (const [donorIdx, donorPool] of pools.entries()) {
        if (donorIdx === problemIdx || donorPool.length < 2) continue;
        if (currentDayHosts.has(donorPool[0].id)) continue;

        const preDonorCost = travelCost(donorPool, clubLocations);
        const preViolations = day !== undefined ? countViolations([problemPool, donorPool], day) : 0;

        for (let k = 1; k < donorPool.length; k++) {
          if (currentDayHosts.has(donorPool[k].id)) continue;

          // Tentatively swap
          const donorTeam = donorPool[k];
          problemPool[0] = donorTeam;
          donorPool[k] = stuckHost;

          // Check hard constraints
          if (day !== undefined) {
            const postViolations = countViolations([problemPool, donorPool], day);
            if (postViolations > preViolations) {
              problemPool[0] = stuckHost;
              donorPool[k] = donorTeam;
              continue;
            }
          }

          const costDelta =
            travelCost(problemPool, clubLocations) +
            travelCost(donorPool, clubLocations) -
            preProblemCost -
            preDonorCost;

          // Revert — we'll apply the best candidate later
          problemPool[0] = stuckHost;
          donorPool[k] = donorTeam;

          candidates.push({ donorIdx, k, costDelta });
        }
      }

      if (candidates.length > 0) {
        // Pick the candidate with the least distance penalty
        candidates.sort((a, b) => a.costDelta - b.costDelta);
        const best = candidates[0];
        const donorPool = pools[best.donorIdx];
        const donorTeam = donorPool[best.k];
        problemPool[0] = donorTeam;
        donorPool[best.k] = stuckHost;
        trace.log(
          `Cross-pool repair: Pool ${getVirtualPoolName(problemIdx)} host ${stuckHost.name} ↔ Pool ${getVirtualPoolName(best.donorIdx)} member ${donorTeam.name} (cost delta: ${best.costDelta >= 0 ? '+' : ''}${Math.round(best.costDelta)}km)`,
        );
      } else {
        trace.log(
          `Cross-pool repair: Pool ${getVirtualPoolName(problemIdx)} host ${stuckHost.name} — no valid donor found, consecutive host remains`,
        );
      }
    }
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
  const withCoords = teams.map((t) => ({ team: t, coords: getTeamCoords(t, clubLocations) }));

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
    return Math.min(...pools.map((p) => getTeamDistance(team, p[0], clubLocations)));
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
    cost += distanceBalancePenalty(ps, clubLocations);
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
  selectHosts(pools, clubLocations, roleHistory, currentDayHosts, trace, day);
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
  const withCoords = teams.map((t) => ({ team: t, coords: getTeamCoords(t, clubLocations) }));

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

  const pairCost = (p: number, q: number): number => {
    let cost = travelCost(pools[p], clubLocations) + travelCost(pools[q], clubLocations);
    if (roleHistory) {
      cost += poolEquityPenalty(pools[p], roleHistory, clubLocations);
      cost += poolEquityPenalty(pools[q], roleHistory, clubLocations);
    }
    cost += distanceBalancePenalty(pools, clubLocations);
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
  selectHosts(pools, clubLocations, roleHistory, currentDayHosts, trace, day);
  trace.groupEnd();

  return pools;
};

// --- Approach D: Role-Priority Pools ---
// Primary driver: role fairness (teams that traveled far should host next)
// Secondary: geographic spreading + swap optimization

const rolePriorityPools = (
  teams: Team[],
  numPools: number,
  day: number,
  clubLocations: ClubLocations,
  competition: Competition,
  roleHistory?: Map<string, RoleHistory>,
  currentDayHosts?: Set<string>,
  trace: Trace = nullTrace,
): Team[][] => {
  // --- Phase A: Host selection by role-priority + geographic spreading ---
  const perDayRoles = computePerDayRoles(competition, day, clubLocations);

  // Score all teams by host need
  const teamScores = teams.map((t) => ({
    team: t,
    hostNeed: computeHostNeedScore(perDayRoles.get(t.id) ?? []),
    coords: getTeamCoords(t, clubLocations),
  }));

  // Sort by hostNeed descending, then by ranking as tie-breaker
  teamScores.sort((a, b) => {
    if (b.hostNeed !== a.hostNeed) return b.hostNeed - a.hostNeed;
    return 0; // preserve original ranking order
  });

  // Select hosts: walk sorted list with geographic spreading
  const hosts: Team[] = [];
  const usedDepts = new Set<string>();

  // First pass: pick hosts from highest need, spread by department
  for (const entry of teamScores) {
    if (hosts.length >= numPools) break;
    // Skip teams that hosted yesterday (soft constraint)
    if (currentDayHosts?.has(entry.team.id)) continue;
    // Geographic spread: skip same department
    if (usedDepts.has(entry.team.department.num_dep)) continue;
    usedDepts.add(entry.team.department.num_dep);
    hosts.push(entry.team);
  }

  // Fallback: relax department constraint if not enough hosts
  if (hosts.length < numPools) {
    for (const entry of teamScores) {
      if (hosts.length >= numPools) break;
      if (hosts.includes(entry.team)) continue;
      if (currentDayHosts?.has(entry.team.id)) continue;
      hosts.push(entry.team);
    }
  }

  // Last resort: allow yesterday's hosts
  if (hosts.length < numPools) {
    for (const entry of teamScores) {
      if (hosts.length >= numPools) break;
      if (hosts.includes(entry.team)) continue;
      hosts.push(entry.team);
    }
  }

  trace.log(
    `Host selection (role-priority): ${hosts.map((h) => `${h.name}(need=${computeHostNeedScore(perDayRoles.get(h.id) ?? []).toFixed(2)})`).join(', ')}`,
  );

  // Initialize pools with hosts
  const pools: Team[][] = hosts.slice(0, numPools).map((h) => [h]);
  const assigned = new Set(hosts.slice(0, numPools).map((h) => h.id));

  // --- Phase B: Round-robin nearby assignment (2nd team per pool) ---
  const remaining = teams.filter((t) => !assigned.has(t.id));

  // Sort remaining by distance to nearest host for efficient assignment
  const assignTeamToPool = (team: Team, slot: 'nearby' | 'far', roundOffset: number): void => {
    // Evaluate all non-full pools, rotating start to prevent bias
    const poolOrder: number[] = [];
    for (let k = 0; k < numPools; k++) {
      poolOrder.push((k + roundOffset) % numPools);
    }

    let bestPool = -1;
    let bestDist = Infinity;
    let bestViolation = true;
    let bestThreeFirsts = true;

    for (const pIdx of poolOrder) {
      const targetSize = slot === 'nearby' ? 2 : 3;
      if (pools[pIdx].length >= targetSize) continue;
      if (slot === 'far' && pools[pIdx].length < 2) continue;

      const hasViolation = pools[pIdx].some((member) => haveSharedPool(team, member, day));
      const wouldHaveThreeFirsts = hasThreeFirsts([...pools[pIdx], team], day);
      const dist = getTeamDistance(team, pools[pIdx][0], clubLocations);

      // Prefer: no violation > no three-firsts > closest (for nearby) or farthest (for far)
      const isBetter =
        (!hasViolation && bestViolation) ||
        (hasViolation === bestViolation && !wouldHaveThreeFirsts && bestThreeFirsts) ||
        (hasViolation === bestViolation &&
          wouldHaveThreeFirsts === bestThreeFirsts &&
          (slot === 'nearby' ? dist < bestDist : dist > bestDist));

      if (isBetter) {
        bestPool = pIdx;
        bestDist = dist;
        bestViolation = hasViolation;
        bestThreeFirsts = wouldHaveThreeFirsts;
      }
    }

    if (bestPool >= 0) {
      pools[bestPool].push(team);
      assigned.add(team.id);
      trace.log(
        `Assign ${slot} ${team.name} → Pool ${getVirtualPoolName(bestPool)} (dist=${Math.round(bestDist)}km${bestViolation ? ', ⚠ violation' : ''})`,
      );
    }
  };

  // Sort remaining by distance to nearest host (closest first for nearby assignment)
  const nearbyQueue = [...remaining].sort((a, b) => {
    const aDist = Math.min(...pools.map((p) => getTeamDistance(a, p[0], clubLocations)));
    const bDist = Math.min(...pools.map((p) => getTeamDistance(b, p[0], clubLocations)));
    return aDist - bDist;
  });

  // Assign nearby teams (2nd slot) with round-robin offset
  for (let i = 0; i < nearbyQueue.length; i++) {
    const team = nearbyQueue[i];
    if (assigned.has(team.id)) continue;
    assignTeamToPool(team, 'nearby', i);
  }

  // --- Phase C: Round-robin far assignment (3rd team per pool) ---
  // Sort remaining unassigned by distance to nearest host (farthest first for far assignment)
  const farQueue = teams
    .filter((t) => !assigned.has(t.id))
    .sort((a, b) => {
      const aDist = Math.min(...pools.map((p) => getTeamDistance(a, p[0], clubLocations)));
      const bDist = Math.min(...pools.map((p) => getTeamDistance(b, p[0], clubLocations)));
      return bDist - aDist; // farthest first
    });

  for (let i = 0; i < farQueue.length; i++) {
    const team = farQueue[i];
    if (assigned.has(team.id)) continue;
    assignTeamToPool(team, 'far', i);
  }

  // --- Phase D: Swap optimization ---
  const combinedCost = (ps: Team[][]): number => {
    let cost = totalTravelCost(ps, clubLocations);
    if (roleHistory) cost += totalEquityPenalty(ps, roleHistory, clubLocations);
    cost += distanceBalancePenalty(ps, clubLocations);
    return cost;
  };

  let currentCost = combinedCost(pools);
  let currentViolations = countViolations(pools, day);
  let swapCount = 0;

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

  // --- Phase E: Host confirmation ---
  trace.group('Host confirmation');
  selectHosts(pools, clubLocations, roleHistory, currentDayHosts, trace, day);
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
      if (d1 <= d2) {
        nearbyTeam = pool[1];
        roles.push(`Nearby(${Math.round(d1)}km)`, `Far(${Math.round(d2)}km)`);
      } else {
        nearbyTeam = pool[2];
        roles.push(`Nearby(${Math.round(d2)}km)`, `Far(${Math.round(d1)}km)`);
      }
    } else if (pool.length === 2) {
      const d = getTeamDistance(host, pool[1], clubLocations);
      nearbyTeam = pool[1];
      roles.push(`Visitor(${Math.round(d)}km)`);
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

    // Travel cost and host distance
    const cost = travelCost(pool, clubLocations);
    totalTravel += cost;
    const hostDist = poolHostDistance(pool, clubLocations);

    const teamNames = pool.map((t) => t.name).join(', ');
    const roleStr = roles.join(', ');
    const status = warnings.length === 0 ? 'OK' : warnings.map((w) => `⚠ ${w}`).join(', ');
    trace.log(`Pool ${poolName}: [${roleStr}] hostDist=${Math.round(hostDist)}km ${teamNames} — ${status}`);
  }
  trace.groupEnd();

  const poolDistances = pools.filter((p) => p.length >= 2).map((p) => poolHostDistance(p, clubLocations));
  const distMean = poolDistances.length > 1 ? poolDistances.reduce((s, d) => s + d, 0) / poolDistances.length : 0;
  const distVariance =
    poolDistances.length > 1 ? poolDistances.reduce((s, d) => s + (d - distMean) ** 2, 0) / poolDistances.length : 0;
  const distStdDev = Math.sqrt(distVariance);

  trace.group('Summary');
  trace.log(
    `Hard rules:  shared_pool=${totalSharedPool}  no_first=${totalNoFirst}  three_firsts=${totalThreeFirsts}  total_violations=${totalSharedPool + totalNoFirst + totalThreeFirsts}`,
  );
  trace.log(
    `Soft rules:  consecutive_hosting=${totalConsecutiveHost}  equity_penalty=${totalEquityPenalty.toFixed(1)}km  avg_travel=${poolCount > 0 ? Math.round(totalTravel / poolCount) : 0}km  distance_balance=±${Math.round(distStdDev)}km`,
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
      metrics: { avgPairDistance: 0, avgHostDistance: 0, constraintViolations: 0, distanceStdDev: 0 },
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
      selectHosts(pools, config.clubLocations, roleHistory, currentDayHosts, trace, lastPoolDay);
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
    case 'role-priority':
      trace.group('Role-priority');
      pools = rolePriorityPools(
        eligible,
        numPools,
        lastPoolDay,
        config.clubLocations,
        competition,
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

    // Re-select hosts after repair — swaps may have moved yesterday-hosts into position 0
    // Safe: only reorders within each pool, cannot introduce hard constraint violations
    trace.group('Host re-selection (post-repair)');
    selectHosts(pools, config.clubLocations, roleHistory, currentDayHosts, trace, lastPoolDay);
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
