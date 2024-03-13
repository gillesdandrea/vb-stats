import axios from 'axios';

import { SheetCollection } from '../model/model';

export const fetchSheets = async (): Promise<SheetCollection> => {
  const request = await axios.get(process.env.PUBLIC_URL + '/sheets/db-sheets.json');
  const { data } = request;
  const seasons = Object.keys(data);
  const promises: Array<() => Promise<any>> = [];
  seasons.forEach((season) => {
    Object.keys(data[season]).forEach(async (category) => {
      data[season][category].forEach(async (path: string) => {
        promises.push(async () => {
          const request = await axios.get(process.env.PUBLIC_URL + '/sheets/' + path);
          const { data: sheet } = request;
          const keys = Object.keys(sheet);
          if (keys.length > 0) {
            const index = Number.parseInt(sheet[keys[0]].day);
            data[season][category][index - 1] = sheet;
          }
        });
      });
    });
  });
  await Promise.all(promises.map((promise) => promise()));

  return data;
};
