# How Does the FFVB Assemble Pools? A Data-Driven Investigation into the Coupe de France Youth Volleyball Competition

## Abstract

This report presents a comprehensive, data-driven investigation into how the French Volleyball Federation (FFVB) assembles pools of three teams for the national rounds (day 5 onward) of the Coupe de France (CDF) youth volleyball competition. Analyzing 5 seasons (2022--2026), 6 categories, 96 national days, 887 pools, and 2,661 team pairs -- with 616 geocoded clubs -- we tested 17 distinct analyses spanning ranking-based ordering, constraint enforcement, statistical distribution, geographic proximity, role equity, and consecutive hosting patterns.

The central finding is that geography is the dominant factor: actual pools are on average 27% closer in distance than randomly assembled pools (distance ratio 0.734), with an asymmetric "1 close + 1 far" visitor pattern (avg 201 km vs 398 km), while no ranking-based method predicts pool composition above random chance. Two hard constraints -- no-repeat matchups and no-three-firsts -- are enforced almost without exception (one repeat pairing in 2,661 national-round pairs, four across all days; zero three-firsts pools). The system is competitively fair: host selection is ranking-neutral, ranking spread within pools is statistically indistinguishable from random, and role equity (host/nearby/far) is approximately balanced.

These findings guided the design of a pool prediction algorithm that reproduces observed patterns. See the [Pool Prediction Algorithm Specification](pool-prediction-algorithm.md) for details.

_Figures in this report come from `pnpm cdf-analysis` and `pnpm cdf-validation` run against the CSV data in `public/data/` as of September 2026. Re-running them after a data refresh will shift the numbers._

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
| National days analyzed | 96                                     |
| Pools analyzed         | 887                                    |
| Team pairs analyzed    | 2,661 (3 pairs per pool of 3)          |
| Geocoded clubs         | 616                                    |
| Data format            | CSV files (one per season/category)    |

Each CSV file follows the naming convention `FFVB-{season}-CDF-{category}.CSV` and contains match-level records with team identifiers, scores, set results, pool codes, and day numbers.

---

## 3. Methodology

### 3.1 Overview

We tested 17 distinct analyses, organized into seven thematic groups:

1. **Ranking-based hypotheses** -- Do pools follow a deterministic ordering based on team rankings?
2. **Constraint analysis** -- Are there hard rules that always hold?
3. **Statistical analysis** -- What do the distributions of rankings within pools look like?
4. **Geographic analysis** -- Does physical distance between clubs explain pool composition?
5. **Host analysis** -- Is the team that hosts the pool selected based on ranking?
6. **Role equity analysis** -- Are hosting, nearby, and far visitor roles distributed fairly?
7. **Consecutive hosting analysis** -- Does the same team avoid hosting on consecutive days?

For each hypothesis, we compared the observed pool compositions against a null model (typically random assignment subject to known constraints) and measured whether the observed data deviates significantly from random.

---

## 4. Results: What Does NOT Explain Pool Composition

### 4.1 Ranking-Based Hypotheses

Seven distinct ranking-based hypotheses were tested:

| Hypothesis           | Method                              | Result                    |
| -------------------- | ----------------------------------- | ------------------------- |
| Serpentine ordering  | Deterministic assignment by ranking | No match above random     |
| Sequential ordering  | Deterministic assignment by ranking | No match above random     |
| Swiss system         | Group by previous pool finish       | No significant tendency   |
| Tier/pot system      | One team per ranking tier           | Not consistently observed |
| Two-group split      | Mix top/bottom halves               | No deviation from random  |
| Spearman correlation | Ranking vs. pool number             | Correlation near zero     |
| TrueSkill rating     | Group by TrueSkill mu               | No predictive power       |

**Conclusion**: No ranking-based method predicts pool composition above random chance. Rankings determine which teams remain in the competition (elimination), but not how surviving teams are grouped.

### 4.2 Ranking Spread and Variance

**Ranking spread within pools**: The observed distribution of ranking spreads (max rank - min rank per pool) is statistically indistinguishable from the Monte Carlo random baseline. Pools are neither more balanced nor more imbalanced than random chance would produce.

**Between/within variance (ANOVA-style)**: F-ratios of between-pool vs. within-pool ranking variance are consistent with random assignment across all national days. There is no evidence that ranking influences pool composition.

---

## 5. Results: What DOES Explain Pool Composition

### 5.1 Geographic Dominance

Geography is the dominant factor in pool assembly. We established this through multiple convergent analyses:

**Pair distance analysis**: Using geocoded club locations (616 clubs, Nominatim), we computed haversine distances between every pair of teams within each pool. The average pairwise distance within actual pools is 327 km, compared to 445 km for random pools -- a **distance ratio of 0.734**, meaning actual pools are **27% closer** than random.

**Same-region pair rate**: **16.2% of actual pool pairs** (430/2,661) share the same French administrative region, compared to **7.2% under random assignment** -- a roughly **2.2x enrichment**. Same-department rates are elevated but less dramatically (3.2%), consistent with distance-minimization operating at the geographic level rather than at administrative boundaries.

**Monte Carlo baseline**: 200 constrained random simulations per day confirm that the only dimension on which actual pools deviate from random is geography. All ranking-based metrics fall squarely within the random distribution.

### 5.2 Hard Constraints

Two hard constraints hold almost without exception across all 5 seasons (`pnpm cdf-validation`, all days: 5,402 pools / 16,206 pairs):

| Constraint                 | Description                                           | Enforcement                                                         |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| No-repeat matchups         | Two teams never share a pool twice in a season        | **1 violation in 2,661 national pairs**; 4 in 16,206 pairs all days |
| No-three-firsts            | Never 3 previous-day 1st-place finishers in same pool | **100% enforced** (0 in 5,402 pools)                                |
| No previous-pool carryover | Teams from same previous pool never reunited          | Same single national-day incident (day 5 pool repeated on day 6)    |

The three other repeat pairings all occur on regional days 1--3. A related rule is weaker still: 6 pools out of 5,402 contain no previous-day winner at all, so "at least 1 first per pool" is a strong tendency rather than an absolute.

These constraints ensure variety of opponents and prevent the formation of "groups of death."

### 5.3 Near/Far Visitor Asymmetry

In each pool of 3, the FFVB ensures one visitor is nearby while accepting one traveling far -- an asymmetric "1 close + 1 far" pattern rather than minimizing total travel equally.

For each of the 887 pools, we computed the haversine distance from the host to each visitor. The shorter distance was classified as d_near and the longer as d_far:

| Metric  | Closer visitor | Farther visitor |
| ------- | -------------- | --------------- |
| Average | 201 km         | 398 km          |
| Median  | 182 km         | 376 km          |

The far/near ratio averages 3.79 (mean) with a median of 1.85. The distribution is heavily skewed: **77.6% of near visitors** travel under 300 km, while **27.5% of far visitors** travel 500 km or more.

**Interpretation**: The FFVB prioritizes having at least one nearby visitor -- ensuring a short trip for one team -- while accepting asymmetric long-distance travel for the other. This is a pragmatic trade-off: attempting to get both visitors equally close would likely mean neither is truly close.

### 5.4 Distance by Day — Geographic Decay

Geographic clustering varies systematically by day:

| Day   | Average Pair Distance | Pools | Explanation                                                   |
| ----- | --------------------- | ----- | ------------------------------------------------------------- |
| Day 5 | 270 km                | 389   | Many teams remain; strong geographic clustering is feasible   |
| Day 6 | 316 km                | 253   | Fewer teams, slightly wider pools                             |
| Day 7 | 408 km                | 156   | Pool of remaining teams is thinning                           |
| Day 8 | 461 km                | 89    | Very few teams left; geographic clustering becomes impossible |

As the competition progresses and teams are eliminated, the pool of remaining teams shrinks. With fewer teams to choose from, the no-repeat constraint becomes increasingly binding, and the FFVB has less freedom to form geographically compact pools. By the late rounds, pools necessarily span large distances.

### 5.5 Role Equity: Host/Nearby/Far Distribution

For each team with 2+ national days, we tracked how many times it was assigned the host, nearby visitor, or far visitor role. If roles were assigned randomly, each team should have roughly equal counts of each role (1/3 each).

**Chi-square test**: For each team with 3+ national days, we computed the chi-square statistic testing whether the observed host/nearby/far distribution differs from uniform (df=2, critical value 5.99 at p=0.05). The average chi-square value across all teams falls well below the critical threshold, indicating that the observed role distribution is **not significantly different from uniform** for most teams.

**Monte Carlo comparison**: 1,000 random role assignments show the actual distribution is in fact _more_ balanced than chance: the average deviation from ideal (sum of |actual - N/3| across roles) is 1.60 versus 1.98 for random, and 54.4% of teams with 3+ national days hold all three roles versus 34.7% under random assignment.

**Extreme imbalances**: A small fraction of teams with 3+ national days have never hosted or always played as the far visitor. However, these rates are consistent with random variation given the small number of national days per team (typically 2--4).

**Finding**: The data confirms approximate role equity exists in FFVB pool assignments. While not perfectly balanced (which would be impossible with small samples), the distribution shows no systematic bias toward overloading certain teams with unfavorable roles. This observation motivated adding the equity penalty to the prediction algorithm.

### 5.6 Consecutive Hosting Patterns

We analyzed whether the same team avoids hosting on consecutive days -- a fairness concern since hosting involves logistical effort.

**Method**: For all days (not just national days), we identified cases where a team hosted on day N and also hosted on day N+1.

**Finding**: Consecutive hosting is rare but does occur -- 60 occurrences across the 30 competitions, concentrated on days 1--3. When they happen, it is typically in late rounds where very few teams remain and geographic constraints leave little flexibility. This motivated adding a soft no-consecutive-hosting rule to the prediction algorithm, with an escape hatch for cases where all candidates hosted the previous day.

### 5.7 L/D/R/N Distance Classification

The vb-stats UI classifies each team's distance role per day using four categories, implemented in `getDayDistance()`:

| Code | Meaning    | Criterion                             |
| ---- | ---------- | ------------------------------------- |
| L    | Local      | Team is the host (position 0 in pool) |
| D    | Department | Visitor shares the host's department  |
| R    | Regional   | Visitor shares the host's region      |
| N    | National   | Visitor is from a different region    |

This classification provides a human-readable summary of travel burden per day. It is displayed alongside day numbers in the team graph and trophy views, helping coaches and parents quickly understand whether a given day involves local, regional, or national travel.

---

## 6. Fairness

### 6.1 Competitive Fairness

| Dimension                 | Finding                                 |
| ------------------------- | --------------------------------------- |
| Ranking spread            | Indistinguishable from random           |
| Between/within variance   | Consistent with random                  |
| Host ranking distribution | Approximately uniform (ranking-neutral) |

The system does not advantage or disadvantage teams based on their competitive standing. Pools are neither stacked with strong teams nor artificially balanced.

### 6.2 Host Selection

The team designated as host shows no systematic bias toward higher-ranked or lower-ranked teams. Host selection appears ranking-neutral, likely depending on practical factors (venue availability, geographic centrality within the pool) rather than competitive standing.

### 6.3 Travel Equity

Role equity analysis (Section 5.5) shows that hosting, nearby, and far visitor duties are distributed approximately equally across teams. No systematic pattern of "always traveling far" or "always hosting" was detected beyond what random variation would produce.

---

## 7. From Analysis to Algorithm

### 7.1 Observed Biases → Algorithm Design

Each finding from the data analysis directly motivated a feature in the pool prediction algorithm:

| Observation in Data                           | Algorithm Feature                                                                               | Validation                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Pools are 27% closer than random              | Geographic distance minimization as primary objective                                           | Predicted pools achieve similar distance ratios                     |
| "1 close + 1 far" pattern (201 km vs 398 km)  | Asymmetric travel cost with weights [2.0, 1.0, 0.5] favoring one short distance                 | Predicted pools reproduce the near/far asymmetry                    |
| No-repeat matchups: 1 in 2,661 national pairs | Hard constraint: `haveSharedPool()` check                                                       | Zero violations in all predictions                                  |
| No-three-firsts: 100% enforced                | Hard constraint: `hasThreeFirsts()` check                                                       | Zero violations in all predictions                                  |
| Approximate role equity across days           | Equity penalty: penalizes overloading a team's host/nearby/far proportion beyond 1/3            | Reduces role concentration vs. pure geographic optimization         |
| Consecutive hosting is rare                   | Soft constraint: deprioritize yesterday's hosts in host selection                               | Consecutive hosting occurs only when forced by pool constraints     |
| Geographic decay in late rounds               | No special handling needed — the algorithm naturally produces wider pools as fewer teams remain | Distance ratios increase with day number, matching observed pattern |
| Host selection is ranking-neutral             | Host selected by centroid proximity with equity tie-breaking, not by ranking                    | Predicted hosts match geographic centrality pattern                 |

### 7.2 Prediction Tool Overview

The prediction algorithm is implemented in `src/model/model-pools.ts`, run offline through `pnpm cdf-comparison` rather than from the web app, and supports four approaches:

1. **Greedy Geographic**: Spread hosts by latitude, assign visitors to closest pool
2. **Swap Optimization**: Start from serpentine seed, iteratively improve by swapping
3. **Geographic Clustering**: Sort by latitude, chunk into groups of 3, refine with swaps
4. **Role-Priority**: Primary driver is role fairness; hosts chosen by travel history

All approaches share the same constraint framework and host selection logic. See the [Pool Prediction Algorithm Specification](pool-prediction-algorithm.md) for the complete technical specification.

---

## 8. Data Pipeline

### 8.1 Source Data

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

### 8.2 Data Processing

The CSV files are loaded at runtime using PapaParse and processed through the `processCompetition()` function (`src/model/model-process.ts`), which:

1. **Parses teams**: Creates `Team` objects with department information (derived from the team's 2-digit department code)
2. **Identifies pools**: Extracts pool assignments from match identifiers (the pool name is encoded in positions 2--3 of the `Match` field)
3. **Creates matches**: Builds `Match` objects with scores, sets, win probabilities (TrueSkill-based), and prediction accuracy
4. **Computes rankings**: After each day, teams are sorted using a multi-criteria ranking system (points, match wins, set ratio, point ratio, TrueSkill rating)
5. **Tracks statistics**: Maintains per-team, per-day, and cumulative statistics

### 8.3 Geocoding Pipeline

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

### 8.4 Domain Model

The core domain types (`src/model/model.ts`) include:

- **`Competition`**: Top-level container with teams, matches, and days
- **`CompetitionDay`**: A single round, containing teams, matches, and a map of pools
- **`Pool`**: A group of 3 teams and their 3 intra-pool matches
- **`Team`**: A club with rankings (global, qualified, daily, pool-level), statistics, and department information
- **`Match`**: A single match with scores, TrueSkill ratings, win probabilities, and prediction outcomes
- **`Department`**: Geographic information linking a team to a French department and administrative region

Geographic data is managed through `geography.ts`, which maps all 101 French departments (including overseas territories) to their administrative regions and assigns display colors.

---

## 9. Conclusion

The FFVB's pool assembly process for the Coupe de France youth competition follows a **geography-first, constraint-enforced** approach:

1. **Geography is primary, with asymmetric travel**: Pools are 27% closer in distance than random assignment, with same-region pairings at roughly 2.2 times the random rate. Crucially, this geographic optimization follows an asymmetric "1 close + 1 far" pattern: in each pool, one visitor is nearby (avg 201 km) while the other travels significantly farther (avg 398 km). The FFVB doesn't minimize total distance equally -- it ensures at least one short trip while accepting one long one. This is a sensible priority for a youth competition where families and clubs bear travel costs.

2. **Hard constraints are near-absolute**: The no-three-firsts rule (never three previous-day winners in a single pool) holds without exception across all 5 seasons, and the no-repeat rule (teams never share a pool twice) is breached once in 2,661 national-round pairs (four times in 16,206 pairs across all days, the rest on regional days). These constraints ensure variety of opponents and prevent the formation of "groups of death."

3. **Ranking plays no role in pool formation**: Every ranking-based hypothesis tested -- serpentine, sequential, Swiss system, tier/pot, two-group, Spearman correlation, TrueSkill rating -- fails to predict pool composition above random chance. Rankings determine which teams remain in the competition (elimination), but not how surviving teams are grouped.

4. **The system is fair**: Ranking spread within pools matches the random baseline, meaning pools are neither stacked with strong teams nor artificially balanced. Host selection is ranking-neutral. Role equity (host/nearby/far) is approximately balanced across teams.

5. **Geographic clustering degrades in late rounds**: As the competition progresses and fewer teams remain, the no-repeat constraint becomes increasingly binding and the pool of eligible nearby opponents shrinks. By day 8, average pair distances reach 460 km because there are simply not enough remaining teams to form geographically compact pools.

6. **The analysis enables prediction**: Each observed pattern -- geographic optimization, constraint enforcement, role equity, consecutive hosting avoidance -- was translated into a corresponding algorithm feature. The resulting prediction tool reproduces historical pool compositions with encouraging accuracy, validating the analysis findings.

In summary, the FFVB pool assembly algorithm can be characterized as: **minimize the nearest visitor's travel distance while accepting asymmetric long-distance travel for the second visitor, subject to hard constraints (no repeated matchups, no three first-place teams), with approximate role equity and no consideration of ranking.** The result is a system that is logistically practical, competitively fair, and operationally transparent once the underlying principles are understood.

---

## 10. References

- **vb-stats application**: [https://gillesdandrea.github.io/vb-stats](https://gillesdandrea.github.io/vb-stats)
- **Pool prediction algorithm**: [Pool Prediction Algorithm Specification](pool-prediction-algorithm.md)
- **FFVB** (Federation Francaise de Volley-Ball): Official governing body for volleyball in France
- **OpenStreetMap Nominatim**: Geocoding service used to resolve club city names to latitude/longitude coordinates
- **TrueSkill**: Bayesian skill rating system (Microsoft Research), used in vb-stats for win probability estimation
- **Haversine formula**: Great-circle distance calculation between two points on a sphere, used for all geographic distance measurements
- **PapaParse**: CSV parsing library used in the data pipeline
- **Source data**: CSV files in `public/data/FFVB-{season}-CDF-{category}.CSV`
- **Club locations**: `public/data/club-locations.json` (616 geocoded clubs)
- **Domain model**: `src/model/model.ts`, `src/model/model-process.ts`, `src/model/model-helpers.ts`
- **Geography mapping**: `src/model/geography.ts` (101 French departments, 13 metropolitan regions)
- **Data scraper**: `src/scripts/cdf-scrap.ts`
- **Analysis script**: `src/scripts/cdf-pool-analysis.ts`
