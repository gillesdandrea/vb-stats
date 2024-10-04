import fs from 'node:fs/promises';
import path from 'node:path';

import axios from 'axios';
import Papa from 'papaparse';
import PDFParser from 'pdf2json';

import { seasonToString } from '@/model/model';
import { Licenced, Referee, SheetMatch, SheetSet, SheetTeam } from '@/model/sheet';

// TODO
// [ ] référence match, jour, date
// [ ] Titre, ville, salle
// [ ] début, fin, durée
// [ ] Temps morts
// [ ] Sanctions, remarques (petite finale régionale)
// [ ] scores
// [ ] Process "forfait", see https://www.ffvbbeach.org/ffvbapp/resu/ffvolley_fdme.php?saison=2023/2024&codent=ACJEUNES&codmatch=JFQ005

interface Token {
  x: number;
  y: number;
  s: number;
  text: string;
}

type Elements = Record<string, string>;

const check = (a: Token, b: Token) => {
  return a.y < b.y && Math.abs(a.x - b.x) < 1;
};

const createOptional = (tokens: Token[], columns: string[], index = 0): [number, Elements] => {
  const element: Elements = {};
  let max = index;
  let stop = false;
  columns.forEach((column, idx) => {
    if (!stop && (idx === 0 || check(tokens[index], tokens[index + idx]))) {
      element[column] = tokens[index + idx].text;
      max = index + idx;
    } else {
      stop = true;
    }
  });
  return [max + 1, element];
};

const create = <T>(tokens: Token[], columns: string[], index = 0): T => {
  const element: Elements = {};
  columns.forEach((column, idx) => {
    element[column] = tokens[index * columns.length + idx]?.text;
  });
  return element as T;
};

const interval = (texts: Token[], marker: string, end?: string) => {
  let tokens = texts;
  const idx = tokens.findIndex((token) => token.text === marker);
  if (idx >= 0) {
    tokens = tokens.slice(idx);
  } else {
    throw new Error(`Can't find ${marker}`);
  }
  if (end) {
    const idx = tokens.findIndex((token) => token.text === end);
    if (idx >= 0) {
      tokens = tokens.slice(0, idx);
    } else {
      throw new Error(`Can't find ${end}`);
    }
  }
  return tokens;
};

const skip = (texts: Token[], markers: string[] = [], end?: string) => {
  let tokens = texts;
  markers.forEach((marker, index) => {
    const idx = tokens.findIndex((token) => token.text === marker);
    if (idx >= 0) {
      tokens = tokens.slice(idx + 1);
    } else {
      throw new Error(`Can't find ${marker}`);
    }
  });
  if (end) {
    const idx = tokens.findIndex((token) => token.text === end);
    if (idx >= 0) {
      tokens = tokens.slice(0, idx);
    } else {
      throw new Error(`Can't find ${end}`);
    }
  }
  return tokens;
};

const getArray = <T>(texts: Token[], columns: string[]): [Token[], T[]] => {
  const elements: T[] = [];
  const x = texts[0].x;
  const index = texts.findIndex((text, index) => {
    if (index % columns.length !== 0) {
      return false;
    }
    return text.x !== x;
  });
  const tokens = texts.slice(0, index);
  for (let i = 0; i < tokens.length / columns.length; i++) {
    elements.push(create(tokens, columns, i) as T);
  }
  return [texts.slice(elements.length * columns.length), elements];
};

const parseSet = (teamA: string, texts: Token[], index: number): SheetSet | null => {
  const path = [];
  for (let i = 0; i < index; i++) {
    path.push('S');
    path.push('E');
    path.push('T');
    path.push(`${i + 1}`);
  }
  const tokens = skip(texts, path);
  const tiebreak = index === 5;
  const inverted = tiebreak ? teamA.startsWith(tokens[0].text.trim()) : !teamA.startsWith(tokens[0].text.trim());
  if (tokens[1].text === 'I' || tokens[1].text === 'II') {
    return null;
  }
  let tokens1 = tokens;
  if (index === 5) {
    const idx1 = tokens.findIndex((token) => token.text === 'I');
    const idx2 = tokens.findIndex((token, index) => index > idx1 && token.text === 'I');
    tokens1 = tokens.slice(idx2 - 2);
  }
  const tokens2 = skip(tokens1, ['VI']);

  const [idx1A, p1A] = createOptional(tokens2, ['player', 'substitute', 'scoreIn', 'scoreOut'], 0);
  const [idx2A, p2A] = createOptional(tokens2, ['player', 'substitute', 'scoreIn', 'scoreOut'], idx1A);
  const [idx3A, p3A] = createOptional(tokens2, ['player', 'substitute', 'scoreIn', 'scoreOut'], idx2A);
  const [idx4A, p4A] = createOptional(tokens2, ['player', 'substitute', 'scoreIn', 'scoreOut'], idx3A);
  const [idx5A, p5A] = createOptional(tokens2, ['player', 'substitute', 'scoreIn', 'scoreOut'], idx4A);
  const [idx6A, p6A] = createOptional(tokens2, ['player', 'substitute', 'scoreIn', 'scoreOut'], idx5A);
  const positionA = [p1A, p2A, p3A, p4A, p5A, p6A].map((pos) => ({
    player: pos.player.padStart(2, '0'),
    substitute: pos.substitute ? pos.substitute.padStart(2, '0') : undefined,
    scoreIn: pos.scoreIn,
    scoreOut: pos.scoreOut,
  }));

  const tokens3 = skip(tokens2, ['VI']);
  const [idx1B, p1B] = createOptional(tokens3, ['player', 'substitute', 'scoreIn', 'scoreOut'], 0);
  const [idx2B, p2B] = createOptional(tokens3, ['player', 'substitute', 'scoreIn', 'scoreOut'], idx1B);
  const [idx3B, p3B] = createOptional(tokens3, ['player', 'substitute', 'scoreIn', 'scoreOut'], idx2B);
  const [idx4B, p4B] = createOptional(tokens3, ['player', 'substitute', 'scoreIn', 'scoreOut'], idx3B);
  const [idx5B, p5B] = createOptional(tokens3, ['player', 'substitute', 'scoreIn', 'scoreOut'], idx4B);
  const [idx6B, p6B] = createOptional(tokens3, ['player', 'substitute', 'scoreIn', 'scoreOut'], idx5B);
  const positionB = [p1B, p2B, p3B, p4B, p5B, p6B].map((pos) => ({
    player: pos.player.padStart(2, '0'),
    substitute: pos.substitute ? pos.substitute.padStart(2, '0') : undefined,
    scoreIn: pos.scoreIn,
    scoreOut: pos.scoreOut,
  }));

  const tokens4 = interval(tokens3, 'X', 'T');
  const tokens5 = tokens4.filter((token) => token.s === 9);
  const x0 = Math.min(...tokens5.map((token) => token.x)) - 1;
  const tokenst = interval(interval(tokens3, 'X'), 'T');
  const x1 = tiebreak ? Math.max(tokenst[0].x, x0) : x0;
  const x2 = x1 + 9;
  const pointsA = tokens5
    .filter((token) => token.x > x1 && token.x < x2)
    .map((x) => (x.text === 'X' ? -1 : Number.parseInt(x.text)))
    .sort((a, b) => a - b);
  let pointsB = tokens5
    .filter((token) => token.x > x2)
    .map((x) => (x.text === 'X' ? -1 : Number.parseInt(x.text)))
    .sort((a, b) => a - b);
  if (pointsA[0] !== -1 && pointsB[0] !== -1) {
    if (!tiebreak) console.log('Missing X');
    // missing X in tie break when serve is reversed
    pointsB = [-1, ...pointsB];
  }

  return inverted
    ? {
        positionA: positionB,
        positionB: positionA,
        pointsA: pointsB,
        pointsB: pointsA,
      }
    : {
        positionA,
        positionB,
        pointsA,
        pointsB,
      };

  // return index === 0 // TODO check with 5 sets
  //   ? {
  //       positionA: positionB,
  //       positionB: positionA,
  //       pointsA: pointsA,
  //       pointsB: pointsB,
  //     }
  //   : {
  //       positionA: positionA,
  //       positionB: positionB,
  //       pointsA: pointsA,
  //       pointsB: pointsB,
  //     };
};

const parseSheetMatch = (texts: Token[]): SheetMatch => {
  const tokens1 = skip(texts, ['Licence', 'Licence', 'Licence']);
  const [tokens2, playersL] = getArray(tokens1, ['number', 'name', 'licence']);
  const [tokens3, playersR] = getArray(tokens2, ['number', 'name', 'licence']);

  const xl = tokens1[0].x;
  const xr = tokens2[0].x;
  const normal = xl < xr;

  const tokens4 = skip(tokens3, ['LIBEROS']);
  const [tokens5, liberosL] = getArray<Licenced>(tokens4, ['number', 'name', 'licence']);
  const [tokens6, liberosR] = getArray<Licenced>(tokens5, ['number', 'name', 'licence']);

  const tokens7 = skip(tokens4, ['OFFICIELS']);
  const [tokens8, officielsL] = getArray<Licenced>(tokens7, ['number', 'name', 'licence']);
  const [tokens9, officielsR] = getArray<Licenced>(tokens8, ['number', 'name', 'licence']);

  const first = skip(texts, ['1er'], '2ème');
  const second = skip(texts, ['2ème'], 'Marqueur');
  const marker = skip(texts, ['Marqueur'], 'Marq.Ass.');
  //const assistant = skip(texts, ['Marq.Ass.'], 'R.Salle');
  //const local = skip(texts, ['R.Salle'], 'Juges');

  const setLicence = (player: any) => (player.licence !== '0' ? player : { ...player, licence: player.number });

  const teamA: SheetTeam = {
    name: texts[7].text,
    players: normal ? playersL.map(setLicence) : playersR.map(setLicence),
    liberos: normal ? liberosL.map(setLicence) : liberosR.map(setLicence),
    officials: (normal ? officielsL : officielsR) as Licenced[],
  };
  const teamB: SheetTeam = {
    name: texts[8].text,
    players: normal ? playersR.map(setLicence) : playersL.map(setLicence),
    liberos: normal ? liberosR.map(setLicence) : liberosL.map(setLicence),
    officials: normal ? officielsR : officielsL,
  };
  const sets: SheetSet[] = [
    parseSet(teamA.name, texts, 1),
    parseSet(teamA.name, texts, 2),
    parseSet(teamA.name, texts, 3),
    parseSet(teamA.name, texts, 4),
    parseSet(teamA.name, texts, 5),
  ].filter((set) => set) as SheetSet[];
  const elements = texts[2].text.split(' ');

  return {
    day: elements[4],
    match: elements[1],
    description: texts[1].text,
    date: texts[3].text,
    teamA,
    teamB,
    approbation: {
      first: create<Referee>(first, ['name', 'league', 'licence']),
      second: create<Referee>(second, ['name', 'league', 'licence']),
      marker: create<Referee>(marker, ['name', 'league', 'licence']),
      //assistant: create(assistant, ['name', 'league', 'licence']),
      //local: create(local, ['name', 'league', 'licence']),
    },
    sets,
  };
};

const parsePDF = async (season: number, matchId: string): Promise<SheetMatch> => {
  // const resource = `https://www.ffvbbeach.org/ffvbapp/resu/ffvolley_fdme.php?saison=${seasonToString(season)}&codent=ABCCS&codmatch=${matchId}`;
  const resource = `https://www.ffvbbeach.org/ffvbapp/resu/ffvolley_fdme.php?saison=${seasonToString(season)}&codent=ACJEUNES&codmatch=${matchId}`;
  console.log(`- Parsing ${resource}`);
  const request = await axios.get(resource, {
    responseType: 'arraybuffer',
  });
  const buffer = request.data;

  return new Promise<SheetMatch>((resolve, reject) => {
    const pdfParser = new PDFParser();
    pdfParser.on('pdfParser_dataError', (errData) => {
      console.error(errData);
      reject(errData);
    });
    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      const texts: Token[] = [];
      pdfData.Pages.forEach((page) => {
        page.Texts.forEach((text) => {
          text.R.map((t) => ({ x: text.x, y: text.y, s: t.TS[1], text: decodeURIComponent(t.T) })).forEach((text) => {
            texts.push(text);
          });
        });
      });
      try {
        const match = {
          url: resource,
          ...parseSheetMatch(texts),
        };
        resolve(match);
      } catch (e) {
        reject(e);
      }
    });
    pdfParser.parseBuffer(buffer);
  });
};

//

if (process.argv.length <= 4) {
  console.log('pdf-parse <season> <category> <pattern>');
  console.log('  i.e. pdf-parse 2024 M21F 0138032');
  console.log('  i.e. pdf-parse 2024 M21F VENELLES');
  process.exit(0);
}

const season = Number.parseInt(process.argv[2]);
const category = process.argv[3].toUpperCase();
const pattern = process.argv[4].toUpperCase();

const spath = `./public/sheets/FFVB-${season}-CDF-${category}.JSON`;
const sexists = await fs
  .access(spath, fs.constants.F_OK)
  .then(() => true)
  .catch(() => false);
const sfile = sexists ? await fs.readFile(spath, { encoding: 'utf8' }) : '{}';

const cachedMatchs: Record<string, SheetMatch> = JSON.parse(sfile);

const mpath = `./public/data/FFVB-${season}-CDF-${category}.CSV`;
const mfile = await fs.readFile(mpath, { encoding: 'utf8' });
const { data: csv } = await Papa.parse(mfile, {
  header: true,
  delimiter: ';',
  skipEmptyLines: true,
});

const sheetMatchs: Record<string, SheetMatch> = {};
for (const { Match: matchId } of csv.filter(
  (line: any): boolean =>
    !!cachedMatchs[line.Match] ||
    ((line.Match === pattern ||
      line.EQA_no.includes(pattern) ||
      line.EQB_no.includes(pattern) ||
      line.EQA_nom.includes(pattern) ||
      line.EQB_nom.includes(pattern)) &&
      line.Set),
) as any[]) {
  try {
    const cached = cachedMatchs[matchId];
    const match = cached ? cached : await parsePDF(season, matchId);
    sheetMatchs[matchId] = match;
    console.log(`${cached ? '-' : '+'} ${matchId}: ${match.teamA.name} v ${match.teamB.name}`);
    // console.log(JSON.stringify(match, null, 2));
  } catch (e) {
    console.warn(`!!! ${matchId}`, e);
  }
}

console.log(`Updating: ${spath}...`);
await fs.writeFile(path.resolve(spath), JSON.stringify(sheetMatchs, null, 2));
