#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { PromisePool } from '@supercharge/promise-pool';

import { Division, Entity, fetchFFVBResults } from './vb-utils';

const competitions = {
  CDF: ['M13M', 'M15M', 'M18M', 'M21M', 'M13F', 'M15F', 'M18F', 'M21F'],
};

(async () => {
  // const years = [2022, 2023, 2024, 2025];
  const years = [2025];

  const results = years.flatMap((season) => {
    return Object.entries(competitions).flatMap(([entity, divisions]) => {
      return divisions.map((division) => {
        return { season, entity, division };
      });
    });
  });

  await PromisePool.withConcurrency(4)
    .for(results)
    .process(async ({ season, entity, division }) => {
      await fetchFFVBResults({ season, entity: entity as Entity, division: division as Division });
    });
})();
