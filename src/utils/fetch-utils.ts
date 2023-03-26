import axios from 'axios';
import Papa from 'papaparse';
import { addMatchMeta, metaToString } from '../model/meta';
import { addMatch, Competition, CompetitionCollection, createCompetition, createMatch } from '../model/model';

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
        processData(competition, data[season][category]);
        collection[season][category] = competition;
      }
    });
  });
  return collection;
};

const processData = (competition: Competition, datas: any[][]) => {
  // reorder matchs based on results of the first matchs
  datas
    .filter((data) => data)
    .forEach((data: any[]) => {
      // const data = udata.filter((data) => data.Jo); // remove empty lines
      const poolCount = data.length / 3;
      for (let i = 0; i < poolCount; i++) {
        const m1 = data[3 * i];
        const m2 = data[3 * i + 1];
        const m3 = data[3 * i + 2];
        const [ssetA, ssetB] = m1.Set ? m1.Set.split('/') : ['0', '0'];
        const setA = ssetA === 'F' ? 0 : Number(ssetA);
        const setB = ssetB === 'F' ? 0 : Number(ssetB);
        const winner = setA > setB ? m1.EQA_no : m1.EQB_no;
        if (winner !== m2.EQA_no && winner !== m2.EQB_no) {
          data[3 * i + 1] = m3;
          data[3 * i + 2] = m2;
        }
      }
    });
  datas.forEach((data: any[]) => {
    data.forEach((line: any) => {
      const match = createMatch(competition, line);
      addMatch(competition, match);
      addMatchMeta(match);
    });
  });
  console.log(
    `${competition.name} ${competition.season} ${competition.category}:Processed ${competition.matchs.length} matchs on ${competition.dayCount} day(s).`,
  );
  console.log(metaToString());
};
