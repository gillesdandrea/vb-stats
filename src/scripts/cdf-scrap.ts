#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
import { PromisePool } from '@supercharge/promise-pool';
import { writeFileSync } from 'fs';
import path from 'path';

type Competition = 'CDF';
type Category = 'M13M' | 'M15M' | 'M18M' | 'M21M' | 'M13F' | 'M15F' | 'M18F' | 'M21F';

const competitions: Record<string, string> = {
  CDF: 'ACJEUNES',
};

const divisions: Record<string, string> = {
  M13M: 'BMX', // benjamins
  M15M: 'MMX', // minimes
  M18M: 'CMX', // cadets
  M21M: 'JMX', // juniors
  M13F: 'BFX', // benjamins
  M15F: 'MFX', // minimes
  M18F: 'CFX', // cadets
  M21F: 'JFX', // juniors
};

// https://www.ffvbbeach.org/ffvbapp/resu/jeunes/2023-2024/
const getFFVBResults = async (
  season: number,
  competition: Competition,
  category: Category,
  day?: number,
): Promise<string[]> => {
  const codent = competitions[competition];
  const division = divisions[category];
  const tour = day ? day.toString().padStart(2, '0') : '';
  const filepath = path.join(
    process.cwd(),
    `public/data/FFVB-${season}-${competition}-${category}${day ? `-J${tour}` : ''}.CSV`,
  );
  console.log('Fetching', `${season - 1}-${season} ${competition} ${category} ${day ? `J${tour}` : ''}...`);
  try {
    const response = await fetch('https://www.ffvbbeach.org/ffvbapp/resu/vbspo_calendrier_export.php', {
      headers: {
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-US,en;q=0.9,fr-FR;q=0.8,fr;q=0.7,und;q=0.6',
        'cache-control': 'max-age=0',
        'content-type': 'application/x-www-form-urlencoded',
        'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
      },
      referrer: `https://www.ffvbbeach.org/ffvbapp/resu/vbspo_calendrier.php?saison=${
        season - 1
      }/${season}&codent=${codent}&division=${division}`,
      referrerPolicy: 'strict-origin-when-cross-origin',
      body: `cal_saison=${
        season - 1
      }%2F${season}&cal_codent=${codent}&cal_codpoule=&cal_coddiv=${division}&cal_codtour=${tour}&typ_edition=E&type=RES&rech_equipe=&x=16&y=16`,
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
    });

    const data: string = await response.text();
    if (response.ok) {
      const [header, ...lines] = data.split('\n');
      lines.sort();
      writeFileSync(filepath, [header, ...lines].filter((line) => line).join('\n') + '\n', 'utf8');
      console.log('Written', filepath);
      return lines;
    } else {
      console.error(response.status, response.statusText);
    }
  } catch (error) {
    console.error(error);
  }
  return [];
};

(async () => {
  // const years = [2022, 2023, 2024];
  const years = [2024];

  const results = years.flatMap((season) => {
    return Object.keys(competitions).flatMap((competition) => {
      return Object.keys(divisions).map((category) => {
        return { season, competition, category };
      });
    });
  });

  await PromisePool.withConcurrency(4)
    .for(results)
    .process(async ({ season, competition, category }) => {
      await getFFVBResults(season, competition as Competition, category as Category);
    });
})();
