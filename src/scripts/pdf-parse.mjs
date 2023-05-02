import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';

// TODO
// [ ] référence match, jour, date
// [ ] Titre, ville, salle
// [ ] début, fin, durée
// [ ] Temps morts
// [ ] Sanctions, remarques (petite finale régionale)
// [ ] scores

const days = {};

const addMatch = (match) => {
  let day = days[match.day];
  if (!day) {
    day = {};
    days[match.day] = day;
  }
  day[match.match] = match;
};

const check = (a, b) => {
  return a.y < b.y && Math.abs(a.x - b.x) < 1;
};

const createOptional = (tokens, columns, index = 0) => {
  const element = {};
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

const create = (tokens, columns, index = 0) => {
  const element = {};
  columns.forEach((column, idx) => {
    element[column] = tokens[index * columns.length + idx]?.text;
  });
  return element;
};

const interval = (texts, marker, end = undefined) => {
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

const skip = (texts, markers = [], end = undefined) => {
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

const getArray = (texts, columns) => {
  const elements = [];
  const x = texts[0].x;
  const index = texts.findIndex((text, index) => {
    if (index % columns.length !== 0) {
      return false;
    }
    return text.x !== x;
  });
  const tokens = texts.slice(0, index);
  for (let i = 0; i < tokens.length / columns.length; i++) {
    elements.push(create(tokens, columns, i));
  }
  return [texts.slice(elements.length * columns.length), elements];
};

const parseSet = (teamA, texts, index) => {
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
  const pointsB = tokens5
    .filter((token) => token.x > x2)
    .map((x) => (x.text === 'X' ? -1 : Number.parseInt(x.text)))
    .sort((a, b) => a - b);

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

const parseMatch = (texts) => {
  const tokens1 = skip(texts, ['Licence', 'Licence', 'Licence']);
  const [tokens2, playersL] = getArray(tokens1, ['number', 'name', 'licence']);
  const [tokens3, playersR] = getArray(tokens2, ['number', 'name', 'licence']);

  const xl = tokens1[0].x;
  const xr = tokens2[0].x;
  const normal = xl < xr;

  const tokens4 = skip(tokens3, ['LIBEROS']);
  const [tokens5, liberosL] = getArray(tokens4, ['number', 'name', 'licence']);
  const [tokens6, liberosR] = getArray(tokens5, ['number', 'name', 'licence']);

  const tokens7 = skip(tokens4, ['OFFICIELS']);
  const [tokens8, officielsL] = getArray(tokens7, ['number', 'name', 'licence']);
  const [tokens9, officielsR] = getArray(tokens8, ['number', 'name', 'licence']);

  const first = skip(texts, ['1er'], '2ème');
  const second = skip(texts, ['2ème'], 'Marqueur');
  const marker = skip(texts, ['Marqueur'], 'Marq.Ass.');
  const assistant = skip(texts, ['Marq.Ass.'], 'R.Salle');
  const local = skip(texts, ['R.Salle'], 'Juges');

  const setLicence = (player) => (player.licence !== '0' ? player : { ...player, licence: player.number });

  const teamA = {
    name: texts[7].text,
    players: normal ? playersL.map(setLicence) : playersR.map(setLicence),
    liberos: normal ? liberosL.map(setLicence) : liberosR.map(setLicence),
    officials: normal ? officielsL : officielsR,
  };
  const teamB = {
    name: texts[8].text,
    players: normal ? playersR.map(setLicence) : playersL.map(setLicence),
    liberos: normal ? liberosR.map(setLicence) : liberosL.map(setLicence),
    officials: normal ? officielsR : officielsL,
  };
  const sets = [
    parseSet(teamA.name, texts, 1),
    parseSet(teamA.name, texts, 2),
    parseSet(teamA.name, texts, 3),
    parseSet(teamA.name, texts, 4),
    parseSet(teamA.name, texts, 5),
  ].filter((set) => set);
  const elements = texts[2].text.split(' ');

  return {
    day: elements[4],
    match: elements[1],
    description: texts[1].text,
    date: texts[3].text,
    teamA,
    teamB,
    approbation: {
      first: create(first, ['name', 'league', 'licence']),
      second: create(second, ['name', 'league', 'licence']),
      marker: create(marker, ['name', 'league', 'licence']),
      assistant: create(assistant, ['name', 'league', 'licence']),
      local: create(local, ['name', 'league', 'licence']),
    },
    sets,
  };
};

const parsePDF = async (filePath, last) => {
  const pdfParser = new PDFParser();

  const texts = [];
  pdfParser.on('pdfParser_dataError', (errData) => {
    console.error(errData.parserError);
  });
  pdfParser.on('pdfParser_dataReady', (pdfData) => {
    pdfData.Pages.forEach((page) => {
      page.Texts.forEach((text) => {
        text.R.map((t) => ({ x: text.x, y: text.y, s: t.TS[1], text: decodeURIComponent(t.T) })).forEach((text) => {
          texts.push(text);
        });
      });
    });
    // console.log(JSON.stringify(texts));
    const match = parseMatch(texts);
    // console.log(JSON.stringify(match, null, 2));
    addMatch(match);

    if (last) {
      // console.log(JSON.stringify(days, null, 2));
      Object.keys(days).forEach((key) => {
        console.log(path.resolve(`./public/sheets/2022-23/2022-23-cdfm15m-j${key}.json`));
        writeFileSync(
          path.resolve(`./public/sheets/2022-23/2022-23-cdfm15m-j${key}.json`),
          JSON.stringify(days[key], null, 2),
        );
      });
    }
  });
  // const buffer = readFileSync(path.resolve(filePath));
  // await pdfParser.parseBuffer(buffer);
  await pdfParser.loadPDF(path.resolve(filePath));
  // return parseMatch(texts);
};

//

if (process.argv.length <= 2) {
  console.log('pdf-parse <pdf-file>');
  process.exit(0);
}

const paths = process.argv.slice(2);
console.log(`pdf-parse ${paths.join(' ')}`);
paths.forEach(async (path, index) => {
  console.log(`- parsing ${path}...`);
  const match = await parsePDF(path, index === paths.length - 1);
  // console.log(match);
});
