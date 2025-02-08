import { useQuery, UseQueryResult } from '@tanstack/react-query';
import axios from 'axios';

import { Competition, seasonToNumber } from '@/model/model';
import { SheetMatch, TeamSheetsMap } from '@/model/sheet';
import { createSheet } from '@/model/sheet-helpers';

const useSheets = (competition: Competition): UseQueryResult<TeamSheetsMap, Error> => {
  const resource = `FFVB-${seasonToNumber(competition?.season)}-${competition?.entity}-${competition?.category}.JSON`;
  return useQuery<TeamSheetsMap, Error>({
    queryKey: [resource],
    queryFn: async () => {
      if (!competition) {
        return {};
      }
      console.log(import.meta.env.BASE_URL + '/sheets/' + resource);
      const request = await axios.get(import.meta.env.BASE_URL + '/sheets/' + resource, {
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
      if (typeof request.data === 'string') {
        // ensure error in dev mode
        throw new Error();
      }
      const matchs: Record<string, SheetMatch> = request.data;

      const teamsSheets: TeamSheetsMap = {};
      competition.teams.forEach((team) => (teamsSheets[team.id] = []));
      competition.matchs.forEach((match) => {
        const sheetMatch = matchs[match.id];
        if (sheetMatch) {
          teamsSheets[match.teamA.id].push(createSheet(match.teamA, match, sheetMatch));
          teamsSheets[match.teamB.id].push(createSheet(match.teamB, match, sheetMatch));
        }
      });
      return teamsSheets;
    },
    retry: 0,
    staleTime: Infinity,
  });
};

export default useSheets;
