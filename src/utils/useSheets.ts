import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import axios from 'axios';

import { type Competition, seasonToNumber } from '@/model/model';
import { type SheetMatch, type TeamSheetsMap } from '@/model/sheet';
import { createSheet } from '@/model/sheet-helpers';

type SheetMatchMap = Record<string, SheetMatch>;

const useSheets = (competition: Competition): UseQueryResult<TeamSheetsMap, Error> => {
  const resource = `FFVB-${seasonToNumber(competition?.season)}-${competition?.entity}-${competition?.category}.JSON`;
  return useQuery<SheetMatchMap, Error, TeamSheetsMap>({
    queryKey: [resource],
    queryFn: async () => {
      const request = await axios.get<SheetMatchMap | string>(`${import.meta.env.BASE_URL}/sheets/${resource}`, {
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
      if (typeof request.data === 'string') {
        // ensure error in dev mode
        throw new Error();
      }
      return request.data;
    },
    // `resource` already identifies the competition, so the competition-dependent mapping belongs in
    // `select` rather than the cache key, which would otherwise serialize the whole domain model
    select: (matchs: SheetMatchMap): TeamSheetsMap => {
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
    enabled: !!competition,
    retry: 0,
    staleTime: Infinity,
  });
};

export default useSheets;
