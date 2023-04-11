import axios from 'axios';
import Papa from 'papaparse';
import { metaToString } from '../model/meta';
import { CompetitionCollection } from '../model/model';
import { createCompetition } from '../model/model-helpers';
import { processCompetition } from '../model/model-process';

// season / category / competition days | matchs data
type DataCollection = Record<string, Record<string, string[][]>>;

export const fetchData = async (): Promise<DataCollection> => {
  const request = await axios.get(process.env.PUBLIC_URL + '/data/db.json');
  const { data } = request;
  const seasons = Object.keys(data);
  const promises: Array<() => Promise<any>> = [];
  seasons.forEach((season) => {
    Object.keys(data[season]).forEach(async (category) => {
      data[season][category].forEach(async (path: string, index: number) => {
        promises.push(async () => {
          const request = await axios.get(process.env.PUBLIC_URL + '/data/' + path);
          const csv = Papa.parse(request.data, {
            header: true,
            delimiter: ';',
            skipEmptyLines: true,
          });
          data[season][category][index] = csv.data;
        });
      });
    });
  });
  await Promise.all(promises.map((promise) => promise()));

  return data;
};

export const createCompetitionCollection = (data: DataCollection): CompetitionCollection => {
  const collection: CompetitionCollection = {};
  const seasons = Object.keys(data);
  seasons.forEach((season) => {
    collection[season] = {};
    Object.keys(data[season]).forEach(async (category) => {
      const competition = createCompetition('Coupe de France Volley-Ball', season, category);
      if (data[season][category].length > 0) {
        processCompetition(competition, data[season][category]);
        collection[season][category] = competition;
        console.log(
          `${competition.name} ${competition.season} ${competition.category}:Processed ${competition.matchs.length} matchs on ${competition.dayCount} day(s).`,
        );
      }
    });
  });
  console.log(metaToString());
  return collection;
};
