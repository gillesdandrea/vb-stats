# How Does the FFVB Assemble Pools? A Data-Driven Investigation into the Coupe de France Youth Volleyball Competition

## Abstract

This report presents a comprehensive, data-driven investigation into how the French Volleyball Federation (FFVB) assembles pools of three teams for the national rounds (day 5 onward) of the Coupe de France (CDF) youth volleyball competition. Analyzing 5 seasons (2022--2026), 6 categories, 88 national days, 833 pools, and 2,499 team pairs -- with 607 geocoded clubs -- we tested 15 distinct hypotheses spanning ranking-based ordering, constraint enforcement, statistical distribution, and geographic proximity. The central finding is that geography is the dominant factor: actual pools are on average 27% closer in distance than randomly assembled pools (distance ratio 0.734), with an asymmetric "1 close + 1 far" visitor pattern (avg 202 km vs 398 km), while no ranking-based method predicts pool composition above random chance. Two hard constraints -- no-repeat matchups and no-three-firsts -- are perfectly enforced. The system is competitively fair: host selection is ranking-neutral, and ranking spread within pools is statistically indistinguishable from random.

---

## 1. Introduction

### 1.1 The Coupe de France Youth Competition

The FFVB organizes the Coupe de France (CDF) for youth categories across France. The competition spans multiple "days" (rounds), each consisting of pools of 3 teams. Within each pool, every team plays the other two, producing 3 matches per pool. After each day, teams are ranked and a subset is eliminated; the remaining teams advance to the next round.

The early days (days 1--4) are organized regionally: teams are grouped within their geographic area. From day 5 onward, the competition becomes national -- only teams that have performed well enough continue. These later rounds raise a fundamental question: **how does the FFVB decide which three teams form a pool?**

### 1.2 Motivation

The pool assembly process is a black box. The FFVB publishes match results and pool compositions, but does not publicly document the algorithm or rules governing how pools are formed for the national rounds. Understanding this process matters for several reasons:

- **Competitive fairness**: Are strong teams separated? Are weak teams protected?
- **Travel logistics**: France is a large country; do pools minimize travel distance for young athletes?
- **Transparency**: Clubs, coaches, and parents want to understand why their team was placed in a particular pool.

This investigation systematically tests every plausible pool-formation mechanism against the actual data, using the vb-stats application's data pipeline and domain model.

### 1.3 Scope

The analysis focuses on national days only (day >= 5), excluding:

- Regional preliminary rounds (days 1--4), where geography is the explicit organizing principle
- Final phases (day 99 / playoffs), which follow bracket-style elimination
- M13 categories, which were excluded from this particular analysis to focus on the 6 main categories: M15F, M15M, M18F, M18M, M21F, M21M

---

## 2. Data Scope

| Dimension              | Value                                  |
| ---------------------- | -------------------------------------- |
| Seasons                | 5 (2022, 2023, 2024, 2025, 2026)       |
| Categories             | 6 (M15F, M15M, M18F, M18M, M21F, M21M) |
| National days analyzed | 88                                     |
| Pools analyzed         | 833                                    |
| Team pairs analyzed    | 2,499 (3 pairs per pool of 3)          |
| Geocoded clubs         | 607                                    |
| Data format            | CSV files (one per season/category)    |

Each CSV file follows the naming convention `FFVB-{season}-CDF-{category}.CSV` and contains match-level records with team identifiers, scores, set results, pool codes, and day numbers.

---

## 3. Methodology

### 3.1 Overview

We tested 15 distinct analyses, organized into five thematic groups:

1. **Ranking-based hypotheses** -- Do pools follow a deterministic ordering based on team rankings?
2. **Constraint analysis** -- Are there hard rules that always hold?
3. **Statistical analysis** -- What do the distributions of rankings within pools look like?
4. **Geographic analysis** -- Does physical distance between clubs explain pool composition?
5. **Host analysis** -- Is the team that hosts the pool selected based on ranking?

For each hypothesis, we compared the observed pool compositions against a null model (typically random assignment subject to known constraints) and measured whether the observed data deviates significantly from random.

### 3.2 Ranking Hypotheses

#### 3.2.1 Serpentine Ordering

**Hypothesis**: Teams are sorted by their ranking from the previous day, then assigned to pools in a serpentine (zigzag) pattern: pool 1 gets ranks 1, 6, 7; pool 2 gets ranks 2, 5, 8; pool 3 gets ranks 3, 4, 9; and so on.

**Method**: For each national day, we sorted teams by their previous-day ranking and generated the serpentine assignment. We then compared the predicted pools to the actual pools.

**Result**: Match rates were no better than random. Serpentine ordering does not explain pool composition.

#### 3.2.2 Sequential Ordering

**Hypothesis**: Teams are simply assigned sequentially by ranking: pool 1 gets ranks 1, 2, 3; pool 2 gets ranks 4, 5, 6; and so on.

**Method**: Same approach as serpentine, but with sequential assignment.

**Result**: Match rates were no better than random. Sequential ordering does not explain pool composition.

#### 3.2.3 Swiss System

**Hypothesis**: Pools are formed by grouping teams based on their finish position in the previous day's pool (all 1st-place finishers together, all 2nd-place, all 3rd-place), as in a Swiss-system tournament.

**Method**: We grouped teams by their previous pool finish (1st, 2nd, 3rd) and checked whether actual pools preferentially contain teams with the same previous finish.

**Result**: No statistically significant tendency. Moreover, the no-three-firsts constraint (see Section 3.3.2) actively prevents the most extreme form of this pattern.

#### 3.2.4 Tier/Pot System

**Hypothesis**: Teams are divided into tiers (top third, middle third, bottom third) by ranking, and each pool draws one team from each tier -- similar to UEFA Champions League group-stage draws.

**Method**: We divided the ranked teams into three equal-sized pots and checked whether each actual pool contains exactly one team from each pot.

**Result**: Pools do not consistently follow a tier/pot structure. The distribution of tier combinations in actual pools is indistinguishable from random assignment.

#### 3.2.5 Two-Group Analysis

**Hypothesis**: Teams are split into two halves (top half and bottom half) by ranking, and pools are formed by mixing across halves.

**Method**: We split teams at the median ranking and checked whether pools preferentially contain a mix of top-half and bottom-half teams.

**Result**: No significant deviation from random mixing.

#### 3.2.6 Spearman Rank Correlation

**Hypothesis**: If pools are formed based on ranking, the pool assignments should show a monotonic relationship with rankings -- e.g., higher-ranked teams systematically appear in lower-numbered pools.

**Method**: We computed the Spearman rank correlation coefficient between team ranking and pool number across all national days.

**Result**: Correlation values were near zero, confirming no systematic relationship between ranking and pool assignment.

### 3.3 Constraint Analysis

#### 3.3.1 No-Repeat Matchups

**Hypothesis**: Two teams that have already been in the same pool in a previous day will never be placed in the same pool again.

**Method**: For every pair of teams sharing a pool on a given national day, we checked whether they had previously shared a pool on any earlier day in the same season.

**Result**: **Perfectly enforced.** Across all 2,499 pairs in all 833 pools across all 88 national days and 5 seasons, there is not a single instance of two teams sharing a pool twice. This is a hard constraint.

#### 3.3.2 No Three Firsts

**Hypothesis**: A pool never contains three teams that all finished 1st in their respective pools on the previous day.

**Method**: For each pool on days >= 6 (where previous pool finishes are available), we checked whether all three teams had finished 1st on the previous day.

**Result**: **Perfectly enforced.** No pool ever contains three teams that all finished 1st on the previous day. This prevents the Swiss system's most extreme grouping and ensures competitive balance.

#### 3.3.3 Previous Pool Carryover

**Hypothesis**: Some teams from the same previous-day pool may carry over into the same next-day pool.

**Method**: We measured how often two teams that shared a pool on day N end up sharing a pool on day N+1.

**Result**: This never happens, which is a direct consequence of the no-repeat constraint (Section 3.3.1). Teams from the same previous pool are always scattered into different pools.

### 3.4 Statistical Analysis

#### 3.4.1 Ranking Spread Within Pools

**Hypothesis**: If pools are formed with competitive balance in mind, the spread of rankings within each pool (max rank - min rank) should differ from random.

**Method**: For each pool, we computed the ranking spread (difference between the highest- and lowest-ranked team). We compared the distribution of spreads in actual pools against 10,000 Monte Carlo simulations of random pool assignment (subject to the no-repeat constraint).

**Result**: The observed ranking spread distribution is statistically indistinguishable from the random baseline. Pools are neither more balanced nor more imbalanced than random chance would produce.

#### 3.4.2 Between/Within Variance (ANOVA-style)

**Hypothesis**: If ranking matters for pool formation, the variance of rankings between pools should exceed the variance within pools.

**Method**: We computed between-pool and within-pool variance of team rankings for each national day and compared the F-ratios against the random baseline.

**Result**: F-ratios are consistent with random assignment. There is no evidence that ranking influences pool composition.

#### 3.4.3 Pair Distance Analysis

**Hypothesis**: Teams in the same pool are geographically closer to each other than randomly paired teams.

**Method**: Using geocoded club locations (latitude/longitude from Nominatim), we computed the haversine distance between every pair of teams within each pool. We compared these distances against the expected distances from random pool assignment.

**Result**: **Strong geographic signal.** The average pairwise distance within actual pools is approximately 270 km, compared to approximately 370 km for random pools -- a **distance ratio of 0.734**, meaning actual pools are **27% closer** than random.

#### 3.4.4 Monte Carlo Baseline

**Method**: To establish the random baseline, we performed Monte Carlo simulations of pool assignment. For each national day, we randomly shuffled the list of eligible teams and assigned them to pools of 3, subject to the no-repeat constraint. We repeated this 10,000 times per day to build robust null distributions for ranking spread, distance, and other metrics.

**Result**: The Monte Carlo baseline confirms that the only dimension on which actual pools deviate from random is geography. All ranking-based metrics fall squarely within the random distribution.

### 3.5 Geographic Analysis

#### 3.5.1 Same-Region Pair Rate

**Hypothesis**: Teams in the same pool are more likely to come from the same administrative region than random chance would predict.

**Method**: For each pair of teams within a pool, we checked whether they belong to the same French administrative region (using the department-to-region mapping from `geography.ts`). We compared this rate against the expected rate under random assignment.

**Result**: Approximately **32% of actual pool pairs** share the same region, compared to approximately **11% under random assignment** -- a roughly 3x enrichment.

#### 3.5.2 Haversine Distance Distribution

**Method**: Using geocoded club locations, we computed haversine (great-circle) distances between all pairs of teams within each pool and plotted the distribution.

**Result**: The actual distance distribution is shifted substantially to the left (shorter distances) relative to the random baseline. The median pair distance is also lower than the random median.

#### 3.5.3 Distance by Day

**Finding**: Geographic clustering varies by day:

| Day   | Approximate Average Pair Distance | Explanation                                                   |
| ----- | --------------------------------- | ------------------------------------------------------------- |
| Day 5 | ~186 km                           | Many teams remain; strong geographic clustering is feasible   |
| Day 6 | ~250 km                           | Fewer teams, slightly wider pools                             |
| Day 7 | ~350 km                           | Pool of remaining teams is thinning                           |
| Day 8 | ~500+ km                          | Very few teams left; geographic clustering becomes impossible |

As the competition progresses and teams are eliminated, the pool of remaining teams shrinks. With fewer teams to choose from, the no-repeat constraint becomes increasingly binding, and the FFVB has less freedom to form geographically compact pools. By the late rounds, pools necessarily span large distances.

#### 3.5.4 City-Level Geocoding

**Method**: Club locations were geocoded at the city level using OpenStreetMap's Nominatim geocoding service. Each club's city name (extracted from the FFVB team data) was geocoded to latitude/longitude coordinates. The results are stored in `public/data/club-locations.json`.

**Result**: 607 clubs were successfully geocoded, covering the vast majority of teams participating in the CDF across all 5 seasons. A small number of clubs could not be geocoded due to ambiguous or unusual city names; these were excluded from distance calculations.

#### 3.5.5 Department and Region Persistence

**Method**: Beyond same-region pair rates, we also examined same-department pair rates (teams from the same department in a pool) and cross-region mixing patterns.

**Result**: Same-department rates are elevated compared to random but less dramatically than same-region rates, which is expected given that departments are smaller geographic units. The pattern is consistent with a distance-minimization objective operating at the geographic level rather than at the administrative-boundary level.

#### 3.5.6 Near/Far Visitor Asymmetry

**Hypothesis**: In each pool of 3, the FFVB ensures one visitor is nearby while accepting one traveling far -- an asymmetric "1 close + 1 far" pattern rather than minimizing total travel equally.

**Method**: For each of the 833 pools, we computed the haversine distance from the host to each of the two visitors. The shorter distance was classified as d_near (the closer visitor) and the longer as d_far (the farther visitor). We then analyzed the distributions of d_near and d_far separately.

**Results**:

| Metric  | Closer visitor | Farther visitor |
| ------- | -------------- | --------------- |
| Average | 202 km         | 398 km          |
| Median  | 182 km         | 376 km          |

The far/near ratio averages 3.79 (mean) with a median of 1.84. The distribution is heavily skewed: 87.4% of near visitors travel under 300 km, while 27.6% of far visitors travel 500 km or more.

**Interpretation**: The FFVB does not minimize total travel distance equally across both visitors. Instead, it prioritizes having at least one nearby visitor -- ensuring a short trip for one team -- while accepting asymmetric long-distance travel for the other. This is a pragmatic trade-off: attempting to get both visitors equally close would likely mean neither is truly close.

### 3.6 Host Analysis

#### 3.6.1 Host Ranking Distribution

**Hypothesis**: The team designated as the host (the team that provides the venue) is systematically the highest-ranked or lowest-ranked team in the pool.

**Method**: For each pool, we identified the host team and recorded its ranking relative to the other two teams. We examined whether the host tends to be the highest-ranked, middle-ranked, or lowest-ranked team.

**Result**: The distribution of host rankings across pools is approximately uniform. There is no systematic bias toward assigning hosting duties to higher-ranked or lower-ranked teams. Host selection appears to be **ranking-neutral**.

#### 3.6.2 Host Equity

**Method**: We examined whether certain teams disproportionately host across multiple days, or whether hosting duties are distributed equitably.

**Result**: Hosting is distributed without a ranking-based pattern. The selection likely depends on practical factors (venue availability, geographic centrality within the pool) rather than competitive standing.

---

## 4. Data Pipeline

### 4.1 Source Data

The FFVB publishes competition results through its official systems. The vb-stats application scrapes these results using the `cdf-scrap` script (`src/scripts/cdf-scrap.ts`), which fetches match data for all seasons and categories. The raw data is stored as CSV files in `public/data/`, with one file per season and category, following the naming convention:

```
FFVB-{season}-CDF-{category}.CSV
```

For example: `FFVB-2026-CDF-M18M.CSV`

Each CSV row represents a single match and includes fields such as:

- `Jo` -- Day number
- `Match` -- Match identifier (encodes pool information in the first characters)
- `EQA_no`, `EQA_nom` -- Team A identifier and name
- `EQB_no`, `EQB_nom` -- Team B identifier and name
- `Set` -- Set score (e.g., "2/1")
- `Score` -- Point-by-point set scores (e.g., "25-20,23-25,25-18")
- `Total` -- Total points
- `Date`, `Heure` -- Date and time
- `Entite` -- Entity code (ACJEUNES for CDF)

### 4.2 Data Processing

The CSV files are loaded at runtime using PapaParse and processed through the `processCompetition()` function (`src/model/model-process.ts`), which:

1. **Parses teams**: Creates `Team` objects with department information (derived from the team's 2-digit department code)
2. **Identifies pools**: Extracts pool assignments from match identifiers (the pool name is encoded in positions 2--3 of the `Match` field)
3. **Creates matches**: Builds `Match` objects with scores, sets, win probabilities (TrueSkill-based), and prediction accuracy
4. **Computes rankings**: After each day, teams are sorted using a multi-criteria ranking system (points, match wins, set ratio, point ratio, TrueSkill rating)
5. **Tracks statistics**: Maintains per-team, per-day, and cumulative statistics

### 4.3 Geocoding Pipeline

Club locations are geocoded in a separate pipeline:

1. **Club extraction**: Team identifiers and names are extracted from the CSV data
2. **City resolution**: The club's city is determined from its name or FFVB registration data
3. **Nominatim geocoding**: Each city is geocoded using OpenStreetMap's Nominatim service, yielding latitude and longitude
4. **Storage**: Results are cached in `public/data/club-locations.json`, a JSON file mapping club codes to location records:

```json
{
  "0444976": {
    "code": "0444976",
    "name": "LES NEPTUNES NANTES VOLLEY ASSOCIATION",
    "city": "NANTES",
    "department": "44",
    "lat": 47.2186371,
    "lon": -1.5541362
  }
}
```

### 4.4 Domain Model

The core domain types (`src/model/model.ts`) include:

- **`Competition`**: Top-level container with teams, matches, and days
- **`CompetitionDay`**: A single round, containing teams, matches, and a map of pools
- **`Pool`**: A group of 3 teams and their 3 intra-pool matches
- **`Team`**: A club with rankings (global, qualified, daily, pool-level), statistics, and department information
- **`Match`**: A single match with scores, TrueSkill ratings, win probabilities, and prediction outcomes
- **`Department`**: Geographic information linking a team to a French department and administrative region

Geographic data is managed through `geography.ts`, which maps all 101 French departments (including overseas territories) to their administrative regions and assigns display colors.

---

## 5. Results Summary

### 5.1 What Does NOT Explain Pool Composition

| Hypothesis           | Method                              | Result                    |
| -------------------- | ----------------------------------- | ------------------------- |
| Serpentine ordering  | Deterministic assignment by ranking | No match above random     |
| Sequential ordering  | Deterministic assignment by ranking | No match above random     |
| Swiss system         | Group by previous pool finish       | No significant tendency   |
| Tier/pot system      | One team per ranking tier           | Not consistently observed |
| Two-group split      | Mix top/bottom halves               | No deviation from random  |
| Spearman correlation | Ranking vs. pool number             | Correlation near zero     |
| TrueSkill rating     | Group by TrueSkill mu               | No predictive power       |

**Conclusion**: No ranking-based method predicts pool composition above random chance.

### 5.2 What DOES Explain Pool Composition

| Finding                        | Metric                           | Value                         |
| ------------------------------ | -------------------------------- | ----------------------------- |
| Distance ratio (actual/random) | Average pair distance            | **0.734** (27% closer)        |
| Same-region pair rate (actual) | Proportion of same-region pairs  | **~32%**                      |
| Same-region pair rate (random) | Expected under random assignment | **~11%**                      |
| Enrichment factor              | Same-region rate ratio           | **~3x**                       |
| Near/far visitor asymmetry     | Avg distance ratio (far/near)    | **1.97x** (avg 202 vs 398 km) |

**Conclusion**: Geography is the dominant factor in pool assembly, with an asymmetric "1 close + 1 far" visitor pattern.

### 5.3 Hard Constraints

| Constraint                 | Description                                           | Enforcement                                     |
| -------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| No-repeat matchups         | Two teams never share a pool twice in a season        | **100% enforced** (0 violations in 2,499 pairs) |
| No-three-firsts            | Never 3 previous-day 1st-place finishers in same pool | **100% enforced**                               |
| No previous-pool carryover | Teams from same previous pool never reunited          | **100% enforced** (consequence of no-repeat)    |

### 5.4 Fairness

| Dimension                 | Finding                                 |
| ------------------------- | --------------------------------------- |
| Ranking spread            | Indistinguishable from random           |
| Between/within variance   | Consistent with random                  |
| Host ranking distribution | Approximately uniform (ranking-neutral) |

---

## 6. Conclusion

The FFVB's pool assembly process for the Coupe de France youth competition follows a **geography-first, constraint-enforced** approach:

1. **Geography is primary, with asymmetric travel**: Pools are 27% closer in distance than random assignment, with same-region pairings at approximately 3 times the random rate. Crucially, this geographic optimization follows an asymmetric "1 close + 1 far" pattern: in each pool, one visitor is nearby (avg 202 km) while the other travels significantly farther (avg 398 km). The FFVB doesn't minimize total distance equally -- it ensures at least one short trip while accepting one long one. This is a sensible priority for a youth competition where families and clubs bear travel costs.

2. **Hard constraints are absolute**: The no-repeat rule (teams never share a pool twice) and the no-three-firsts rule (never three previous-day winners in a single pool) are enforced without exception across all 5 seasons analyzed. These constraints ensure variety of opponents and prevent the formation of "groups of death."

3. **Ranking plays no role in pool formation**: Every ranking-based hypothesis tested -- serpentine, sequential, Swiss system, tier/pot, two-group, Spearman correlation, TrueSkill rating -- fails to predict pool composition above random chance. Rankings determine which teams remain in the competition (elimination), but not how surviving teams are grouped.

4. **The system is fair**: Ranking spread within pools matches the random baseline, meaning pools are neither stacked with strong teams nor artificially balanced. Host selection is ranking-neutral. The system does not advantage or disadvantage teams based on their competitive standing.

5. **Geographic clustering degrades in late rounds**: As the competition progresses and fewer teams remain, the no-repeat constraint becomes increasingly binding and the pool of eligible nearby opponents shrinks. By day 8, average pair distances exceed 500 km because there are simply not enough remaining teams to form geographically compact pools.

In summary, the FFVB pool assembly algorithm can be characterized as: **minimize the nearest visitor's travel distance while accepting asymmetric long-distance travel for the second visitor, subject to hard constraints (no repeated matchups, no three first-place teams), with no consideration of ranking.** The result is a system that is logistically practical, competitively fair, and operationally transparent once the underlying principles are understood.

---

## 7. References

- **vb-stats application**: [https://gillesdandrea.github.io/vb-stats](https://gillesdandrea.github.io/vb-stats)
- **FFVB** (Federation Francaise de Volley-Ball): Official governing body for volleyball in France
- **OpenStreetMap Nominatim**: Geocoding service used to resolve club city names to latitude/longitude coordinates
- **TrueSkill**: Bayesian skill rating system (Microsoft Research), used in vb-stats for win probability estimation
- **Haversine formula**: Great-circle distance calculation between two points on a sphere, used for all geographic distance measurements
- **PapaParse**: CSV parsing library used in the data pipeline
- **Source data**: CSV files in `public/data/FFVB-{season}-CDF-{category}.CSV`
- **Club locations**: `public/data/club-locations.json` (607 geocoded clubs)
- **Domain model**: `src/model/model.ts`, `src/model/model-process.ts`, `src/model/model-helpers.ts`
- **Geography mapping**: `src/model/geography.ts` (101 French departments, 13 metropolitan regions)
- **Data scraper**: `src/scripts/cdf-scrap.ts`
