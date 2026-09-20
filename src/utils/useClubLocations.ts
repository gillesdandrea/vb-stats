import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import axios from 'axios';

import { type ClubLocations } from '@/model/model-geography';

const useClubLocations = (): UseQueryResult<ClubLocations> =>
  useQuery({
    queryKey: ['club-locations'],
    queryFn: async () => (await axios.get<ClubLocations>(import.meta.env.BASE_URL + '/data/club-locations.json')).data,
    staleTime: Infinity,
  });

export default useClubLocations;
