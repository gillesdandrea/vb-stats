import fs from 'node:fs/promises';
import https from 'node:https';

import axios from 'axios';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const iaxios = axios.create({ httpsAgent });

// --- Configuration ---

const SEASONS = [2022, 2023, 2024, 2025, 2026];
const CATEGORY_CODES: Record<string, string> = {
  M15F: 'MFA',
  M15M: 'MMA',
  M18F: 'CFA',
  M18M: 'CMA',
  M21F: 'JFA',
  M21M: 'JMA',
};
const CACHE_PATH = './public/data/club-locations.json';
const NOMINATIM_DELAY_MS = 1100; // respect 1 req/s rate limit

// --- Types ---

interface ClubInfo {
  readonly code: string;
  readonly name: string;
  readonly city: string;
  readonly department: string;
}

interface ClubLocation {
  readonly code: string;
  readonly name: string;
  readonly city: string;
  readonly department: string;
  readonly lat: number;
  readonly lon: number;
}

type LocationCache = Record<string, ClubLocation>;

// --- FFVB Scraper ---

const fetchClubList = async (season: number, competCode: string): Promise<ClubInfo[]> => {
  const url = `https://www.ffvbbeach.org/ffvbapp/adressier/cdf_jeu_list.php?wss_saison=${season - 1}/${season}&wss_compet=${competCode}&eng_tri=LIGUE`;
  const response = await iaxios.get(url, { responseType: 'arraybuffer' });
  const html = new TextDecoder('windows-1252').decode(response.data);

  // Extract all TD contents
  const tds = [...html.matchAll(/<TD[^>]*>(.*?)<\/TD>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());

  // Skip header (7 TDs), then groups of 5: code, name, city, league, date
  const HEADER_SIZE = 7;
  const ROW_SIZE = 5;
  const clubs: ClubInfo[] = [];

  for (let i = HEADER_SIZE; i + ROW_SIZE <= tds.length; i += ROW_SIZE) {
    const code = tds[i];
    const name = tds[i + 1];
    const city = tds[i + 2];
    if (code && /^\d{7}$/.test(code)) {
      // Extract department from club code (digits 2-3, 1-indexed)
      const dept = code.substring(1, 3);
      clubs.push({ code, name, city, department: dept });
    }
  }

  return clubs;
};

// --- Nominatim Geocoder ---

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const cleanCity = (city: string): string =>
  city
    .replace(/\s+CEDEX\s*\d*/i, '')
    .replace(/\s+CX\s*\d*/i, '')
    .replace(/^ST-/, 'SAINT-')
    .replace(/^STE-/, 'SAINTE-')
    .trim();

const geocodeCity = async (city: string, department: string): Promise<{ lat: number; lon: number } | undefined> => {
  const cleaned = cleanCity(city);
  const queries = [
    `${cleaned}, ${department}, France`,
    `${cleaned}, France`,
    ...(cleaned !== city ? [`${city}, ${department}, France`] : []),
  ];

  for (const q of queries) {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q, format: 'json', limit: 1, countrycodes: 'fr' },
        headers: { 'User-Agent': 'vb-stats-cdf-analysis/1.0' },
      });
      if (response.data.length > 0) {
        return {
          lat: parseFloat(response.data[0].lat),
          lon: parseFloat(response.data[0].lon),
        };
      }
    } catch {
      // Continue to next query
    }
    await sleep(NOMINATIM_DELAY_MS);
  }

  return undefined;
};

// --- Department name lookup for better geocoding ---

const DEPT_NAMES: Record<string, string> = {
  '01': 'Ain',
  '02': 'Aisne',
  '03': 'Allier',
  '04': 'Alpes-de-Haute-Provence',
  '05': 'Hautes-Alpes',
  '06': 'Alpes-Maritimes',
  '07': 'Ardèche',
  '08': 'Ardennes',
  '09': 'Ariège',
  '10': 'Aube',
  '11': 'Aude',
  '12': 'Aveyron',
  '13': 'Bouches-du-Rhône',
  '14': 'Calvados',
  '15': 'Cantal',
  '16': 'Charente',
  '17': 'Charente-Maritime',
  '18': 'Cher',
  '19': 'Corrèze',
  '21': "Côte-d'Or",
  '22': "Côtes-d'Armor",
  '23': 'Creuse',
  '24': 'Dordogne',
  '25': 'Doubs',
  '26': 'Drôme',
  '27': 'Eure',
  '28': 'Eure-et-Loir',
  '29': 'Finistère',
  '2A': 'Corse-du-Sud',
  '2B': 'Haute-Corse',
  '30': 'Gard',
  '31': 'Haute-Garonne',
  '32': 'Gers',
  '33': 'Gironde',
  '34': 'Hérault',
  '35': 'Ille-et-Vilaine',
  '36': 'Indre',
  '37': 'Indre-et-Loire',
  '38': 'Isère',
  '39': 'Jura',
  '40': 'Landes',
  '41': 'Loir-et-Cher',
  '42': 'Loire',
  '43': 'Haute-Loire',
  '44': 'Loire-Atlantique',
  '45': 'Loiret',
  '46': 'Lot',
  '47': 'Lot-et-Garonne',
  '48': 'Lozère',
  '49': 'Maine-et-Loire',
  '50': 'Manche',
  '51': 'Marne',
  '52': 'Haute-Marne',
  '53': 'Mayenne',
  '54': 'Meurthe-et-Moselle',
  '55': 'Meuse',
  '56': 'Morbihan',
  '57': 'Moselle',
  '58': 'Nièvre',
  '59': 'Nord',
  '60': 'Oise',
  '61': 'Orne',
  '62': 'Pas-de-Calais',
  '63': 'Puy-de-Dôme',
  '64': 'Pyrénées-Atlantiques',
  '65': 'Hautes-Pyrénées',
  '66': 'Pyrénées-Orientales',
  '67': 'Bas-Rhin',
  '68': 'Haut-Rhin',
  '69': 'Rhône',
  '70': 'Haute-Saône',
  '71': 'Saône-et-Loire',
  '72': 'Sarthe',
  '73': 'Savoie',
  '74': 'Haute-Savoie',
  '75': 'Paris',
  '76': 'Seine-Maritime',
  '77': 'Seine-et-Marne',
  '78': 'Yvelines',
  '79': 'Deux-Sèvres',
  '80': 'Somme',
  '81': 'Tarn',
  '82': 'Tarn-et-Garonne',
  '83': 'Var',
  '84': 'Vaucluse',
  '85': 'Vendée',
  '86': 'Vienne',
  '87': 'Haute-Vienne',
  '88': 'Vosges',
  '89': 'Yonne',
  '90': 'Territoire de Belfort',
  '91': 'Essonne',
  '92': 'Hauts-de-Seine',
  '93': 'Seine-Saint-Denis',
  '94': 'Val-de-Marne',
  '95': "Val-d'Oise",
};

// --- Main ---

const main = async (): Promise<void> => {
  // Load existing cache
  let cache: LocationCache = {};
  try {
    const raw = await fs.readFile(CACHE_PATH, 'utf8');
    cache = JSON.parse(raw) as LocationCache;
    console.log(`Loaded ${Object.keys(cache).length} cached locations.`);
  } catch {
    console.log('No existing cache, starting fresh.');
  }

  // Scrape all club lists
  const allClubs = new Map<string, ClubInfo>();
  for (const season of SEASONS) {
    for (const [category, code] of Object.entries(CATEGORY_CODES)) {
      try {
        const clubs = await fetchClubList(season, code);
        console.log(`${season - 1}/${season} ${category}: ${clubs.length} clubs`);
        for (const club of clubs) {
          if (!allClubs.has(club.code)) {
            allClubs.set(club.code, club);
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`  Error fetching ${season} ${category}: ${msg}`);
      }
    }
  }

  console.log(`\nTotal unique clubs: ${allClubs.size}`);

  // Find clubs needing geocoding
  const toGeocode: ClubInfo[] = [];
  for (const [code, club] of allClubs) {
    if (!cache[code]) {
      toGeocode.push(club);
    }
  }

  console.log(`Already cached: ${allClubs.size - toGeocode.length}`);
  console.log(`Need geocoding: ${toGeocode.length}`);

  if (toGeocode.length > 0) {
    console.log(
      `\nGeocoding ${toGeocode.length} clubs (${Math.ceil((toGeocode.length * NOMINATIM_DELAY_MS) / 1000 / 60)} min estimated)...`,
    );

    let success = 0;
    let failed = 0;
    for (const club of toGeocode) {
      const deptName = DEPT_NAMES[club.department] ?? club.department;
      const coords = await geocodeCity(club.city, deptName);
      if (coords) {
        cache[club.code] = {
          code: club.code,
          name: club.name,
          city: club.city,
          department: club.department,
          lat: coords.lat,
          lon: coords.lon,
        };
        success++;
        process.stdout.write(`\r  Geocoded: ${success + failed}/${toGeocode.length} (${success} ok, ${failed} failed)`);
      } else {
        console.log(`\n  FAILED: ${club.code} ${club.name} - ${club.city} (dept ${club.department})`);
        failed++;
      }
      await sleep(NOMINATIM_DELAY_MS);
    }
    console.log(`\n\nGeocoding complete: ${success} succeeded, ${failed} failed.`);
  }

  // Save cache
  await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  console.log(`\nSaved ${Object.keys(cache).length} locations to ${CACHE_PATH}`);
};

main().catch(console.error);
