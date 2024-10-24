import { writeFileSync } from 'node:fs';
import https from 'node:https';
import path from 'node:path';

import axios from 'axios';
import qs from 'query-string';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const iaxios = axios.create({ httpsAgent });

export type Entity = 'ACJEUNES' | 'ABCCS' | 'LICA'; // TODO
export type Division = 'M13M' | 'M15M' | 'M18M' | 'M21M' | 'M13F' | 'M15F' | 'M18F' | 'M21F';
export type Pool = 'PMA';

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

const fetchCalendar = async ({
  season,
  entity,
  pool,
  division,
  tour,
}: {
  season: number;
  entity: string;
  pool?: string;
  division?: string;
  tour?: number;
}) => {
  try {
    const response = await iaxios.request({
      method: 'POST',
      url: 'https://www.ffvbbeach.org/ffvbapp/resu/vbspo_calendrier_export.php',
      headers: {
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-US,en;q=0.9,fr-FR;q=0.8,fr;q=0.7,und;q=0.6',
        'cache-control': 'max-age=0',
        'content-type': 'application/x-www-form-urlencoded',
        // 'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
        // 'sec-ch-ua-mobile': '?0',
        // 'sec-ch-ua-platform': '"macOS"',
        // 'sec-fetch-dest': 'document',
        // 'sec-fetch-mode': 'navigate',
        // 'sec-fetch-site': 'same-origin',
        // 'sec-fetch-user': '?1',
        // 'upgrade-insecure-requests': '1',
        // cookie:
        //   '_ga=GA1.1.945702207.1671449106; __utmc=7271653; PHPSESSID=hpkd3fhmdlhhlv25li28cnpav7; cto_bundle=Ix4TKF9qSSUyRkhpOXJsNFh3dSUyRnlNMHY3THZ2ZVJ2QnJFbGQ1bGw2cXpDMEN1STBBR3h1bXR4RGFIT0h6azBhQVBDOUd6b3NHdXpPaEpuY2lCcnFqJTJCd2NNTmtQVk50TmY2V3JFUmRneHpERjl5SFdFWGE5WmRCalAzR2pHWDllWERwcWZIRHZpa0pQWlZIbjlJY2JpNHNYZVg3NmhvMGVNeUtXRmh4dGt0ejBOOVJzVEklM0Q; __utmz=7271653.1721225974.154.39.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); __utma=7271653.945702207.1671449106.1721556300.1721568117.171; __utmt=1; __utmb=7271653.4.10.1721568117; _ga_G41692G2SG=GS1.1.1721568117.209.1.1721568199.51.0.0',
        // Referer: 'https://www.ffvbbeach.org/ffvbapp/resu/vbspo_calendrier.php?saison=2023/2024&codent=ABCCS&division=INT',
        // 'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
      data: qs.stringify({
        cal_saison: `${season - 1}/${season}`,
        cal_codent: entity,
        cal_codpoule: pool,
        cal_coddiv: division,
        cal_codtour: tour ? String(tour).padStart(2, '0') : undefined,
        typ_edition: 'E',
        type: 'RES',
        rech_equipe: undefined,
        x: 25,
        y: 19,
      }),
      responseType: 'arraybuffer',
      responseEncoding: 'binary',
    });
    const decoder = new TextDecoder('ISO-8859-1');
    const text = decoder.decode(response.data);
    return text;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// https://www.ffvbbeach.org/ffvbapp/resu/jeunes/2023-2024/
export const fetchFFVBResults = async ({
  season,
  entity,
  division,
  pool,
  day,
}: {
  season: number;
  entity: Entity;
  division?: Division;
  pool?: Pool;
  day?: number;
}): Promise<string[]> => {
  const codent = competitions[entity] ?? entity;
  const coddiv = divisions[division ?? ''] ?? division;
  const codpool = pool;
  const tour = day ? day.toString().padStart(2, '0') : '';
  const filepath = path.join(
    process.cwd(),
    `public/data/FFVB-${season}-${entity}-${division ?? pool}${day ? `-J${tour}` : ''}.CSV`,
  );
  console.log('Fetching', `${season - 1}-${season} ${entity} ${division ?? pool} ${day ? `J${tour}` : ''}...`);
  try {
    const data = await fetchCalendar({ season, entity: codent, division: coddiv, pool: codpool });
    const [header, ...lines] = data.split('\n');
    lines.sort();
    writeFileSync(filepath, [header, ...lines].filter((line) => line).join('\n') + '\n', 'utf8');
    console.log('Written', filepath);
    return lines;
  } catch (error) {
    console.error(error);
  }
  return [];
};
