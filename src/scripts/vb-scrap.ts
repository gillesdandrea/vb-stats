import { Division, Entity, fetchFFVBResults, Pool } from './vb-utils';

if (process.argv.length <= 5) {
  console.log('vb-scrap <season> <entity> <division>');
  console.log('  i.e. vb-scrap 2025 CDF division M18M');
  console.log('  i.e. vb-scrap 2025 LICA pool PMA');
  process.exit(0);
}

const season = Number.parseInt(process.argv[2]);
const entity = process.argv[3].toUpperCase();
const type = process.argv[4].toUpperCase();
const divpool = process.argv[5].toUpperCase();

await fetchFFVBResults({
  season,
  entity: entity as Entity,
  division: type === 'DIVISION' ? (divpool as Division) : undefined,
  pool: type === 'POOL' ? (divpool as Pool) : undefined,
});
