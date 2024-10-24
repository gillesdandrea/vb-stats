import { useQuery, UseQueryResult } from '@tanstack/react-query';
import axios from 'axios';
import Papa from 'papaparse';

import { createMetaStats, metaAddMatch, metaToString } from '@/model/meta';
import { Competition, Entity, getResourceName } from '@/model/model';
import { createCompetition } from '@/model/model-helpers';
import { processCompetition } from '@/model/model-process';

const useCompetition = (season: number, entity: Entity, category: string): UseQueryResult<Competition, Error> => {
  const resource = getResourceName(season, entity, category);
  return useQuery<Competition, Error>({
    queryKey: [resource],
    queryFn: async () => {
      const now = Date.now();

      const request = await axios.get(import.meta.env.BASE_URL + '/data/' + resource);
      const { data } = Papa.parse<string[]>(request.data, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
      });

      const competition = createCompetition('Volley-Ball Stats', `${season - 1}/${season}`, entity, category);
      data.length > 0 && processCompetition(competition, [data]);
      console.log(
        `${competition.name} ${competition.season} ${competition.category}:Processed ${competition.matchs.length} matchs on ${competition.lastDay}/${competition.dayCount} day(s).`,
      );

      const meta = createMetaStats();
      competition.matchs.forEach((match) => metaAddMatch(meta, match));
      console.log(metaToString(meta));

      console.log('Processed in', Date.now() - now, 'ms.');
      return competition;
    },
    staleTime: Infinity,
  });
};

export default useCompetition;
