import { type Team } from './model';

// --- Types ---

export type ClubLocations = Record<string, { lat: number; lon: number }>;

// --- Department Centroids (approximate lat/lon) ---

export const departmentCentroids: Record<string, [lat: number, lon: number]> = {
  '01': [46.2, 5.3],
  '02': [49.5, 3.6],
  '03': [46.4, 3.2],
  '04': [44.1, 6.2],
  '05': [44.7, 6.3],
  '06': [43.8, 7.2],
  '07': [44.7, 4.4],
  '08': [49.6, 4.6],
  '09': [42.9, 1.5],
  '10': [48.3, 4.1],
  '11': [43.1, 2.4],
  '12': [44.3, 2.6],
  '13': [43.5, 5.1],
  '14': [49.1, -0.4],
  '15': [45.0, 2.7],
  '16': [45.7, 0.2],
  '17': [45.8, -0.8],
  '18': [47.0, 2.5],
  '19': [45.3, 1.9],
  '21': [47.3, 4.6],
  '22': [48.5, -3.0],
  '23': [46.1, 2.1],
  '24': [45.1, 0.7],
  '25': [47.2, 6.4],
  '26': [44.7, 5.2],
  '27': [49.1, 1.2],
  '28': [48.3, 1.5],
  '29': [48.4, -4.2],
  '2A': [41.9, 9.0],
  '2B': [42.3, 9.2],
  '30': [44.0, 4.1],
  '31': [43.4, 1.2],
  '32': [43.7, 0.6],
  '33': [44.8, -0.6],
  '34': [43.6, 3.5],
  '35': [48.1, -1.7],
  '36': [46.8, 1.6],
  '37': [47.3, 0.7],
  '38': [45.3, 5.7],
  '39': [46.7, 5.7],
  '40': [43.9, -0.8],
  '41': [47.6, 1.4],
  '42': [45.7, 4.2],
  '43': [45.1, 3.7],
  '44': [47.3, -1.7],
  '45': [47.9, 2.2],
  '46': [44.6, 1.7],
  '47': [44.3, 0.5],
  '48': [44.5, 3.5],
  '49': [47.4, -0.5],
  '50': [48.9, -1.3],
  '51': [48.9, 3.9],
  '52': [48.1, 5.3],
  '53': [48.1, -0.8],
  '54': [48.7, 6.2],
  '55': [49.0, 5.4],
  '56': [47.8, -2.8],
  '57': [49.0, 6.7],
  '58': [47.1, 3.5],
  '59': [50.4, 3.2],
  '60': [49.4, 2.4],
  '61': [48.6, 0.1],
  '62': [50.5, 2.3],
  '63': [45.7, 3.1],
  '64': [43.3, -0.8],
  '65': [43.0, 0.2],
  '66': [42.6, 2.5],
  '67': [48.6, 7.5],
  '68': [47.9, 7.2],
  '69': [45.8, 4.7],
  '70': [47.6, 6.2],
  '71': [46.6, 4.4],
  '72': [47.9, 0.2],
  '73': [45.5, 6.4],
  '74': [46.0, 6.3],
  '75': [48.9, 2.3],
  '76': [49.7, 1.0],
  '77': [48.6, 2.9],
  '78': [48.8, 1.9],
  '79': [46.5, -0.3],
  '80': [49.9, 2.3],
  '81': [43.8, 2.1],
  '82': [44.0, 1.3],
  '83': [43.5, 6.2],
  '84': [44.1, 5.2],
  '85': [46.7, -1.3],
  '86': [46.6, 0.5],
  '87': [45.9, 1.3],
  '88': [48.2, 6.4],
  '89': [47.8, 3.6],
  '90': [47.6, 6.9],
  '91': [48.5, 2.2],
  '92': [48.8, 2.2],
  '93': [48.9, 2.5],
  '94': [48.8, 2.5],
  '95': [49.1, 2.2],
  // Overseas departments
  '971': [16.2, -61.5], // Guadeloupe
  '972': [14.6, -61.0], // Martinique
  '973': [4.0, -53.0], // Guyane
  '974': [-21.1, 55.5], // La Réunion
  '976': [-12.8, 45.2], // Mayotte
};

// Haversine distance in km
export const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const FRANCE_CENTROID: [number, number] = [46.6, 2.5];

export const getTeamCoords = (team: Team, clubLocations: ClubLocations): [lat: number, lon: number] => {
  const club = clubLocations[team.id];
  if (club) return [club.lat, club.lon];
  return departmentCentroids[team.department.num_dep] ?? FRANCE_CENTROID;
};

export const getTeamDistance = (a: Team, b: Team, clubLocations: ClubLocations): number => {
  const ca = getTeamCoords(a, clubLocations);
  const cb = getTeamCoords(b, clubLocations);
  return haversineKm(ca[0], ca[1], cb[0], cb[1]);
};

export const computePoolsTotalDistance = (pools: Team[][], clubLocations: ClubLocations): number => {
  let total = 0;
  for (const pool of pools) {
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        total += getTeamDistance(pool[i], pool[j], clubLocations);
      }
    }
  }
  return total;
};
