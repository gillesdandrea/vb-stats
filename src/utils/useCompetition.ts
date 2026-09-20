import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import axios from 'axios';
import Papa from 'papaparse';

import { createMetaStats, metaAddMatch, metaToString } from '@/model/meta';
import { type Competition, type Entity, getResourceName, type MatchRow } from '@/model/model';
import { createCompetition } from '@/model/model-helpers';
import { processCompetition } from '@/model/model-process';

const DATA_STALE_TIME_MS = 60 * 60 * 1000; // 1 hour

const useCompetition = (season: number, entity: Entity, category: string): UseQueryResult<Competition, Error> => {
  const resource = getResourceName(season, entity, category);
  return useQuery<Competition, Error>({
    queryKey: [resource, season, entity, category],
    queryFn: async () => {
      const now = Date.now();

      const request = await axios.get(import.meta.env.BASE_URL + '/data/' + resource);
      const { data } = Papa.parse<MatchRow>(request.data, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
      });

      const competition = createCompetition('Volley-Ball Stats', `${season - 1}/${season}`, entity, category);
      try {
        data.length > 0 && processCompetition(competition, [data]);
      } catch (e) {
        console.error(e);
        throw e;
      }
      console.log(
        `${competition.name} ${competition.season} ${competition.category}:Processed ${competition.matchs.length} matchs on ${competition.lastDay}/${competition.dayCount} day(s).`,
      );

      const meta = createMetaStats();
      competition.matchs.forEach((match) => metaAddMatch(meta, match));
      console.log(metaToString(meta));

      console.log('Processed in', Date.now() - now, 'ms.');
      return competition;
    },
    // A data-only deploy leaves the bundle untouched, so the service worker
    // never updates and the reload prompt never fires: results have to go stale
    // on their own for an open tab to ever see new ones.
    staleTime: DATA_STALE_TIME_MS,
  });
};

export default useCompetition;
