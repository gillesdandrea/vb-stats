import { Rating, TrueSkill, quality, rate } from 'ts-trueskill';

const ts = new TrueSkill(undefined, undefined, undefined, undefined, 0);
const TIGHT_FACTOR = 4 / 5; // 1 to disable tight score management
const MIN_DELTA = 0.0001;

export const rateMatch = (ratingWinner, ratingLoser, tightScore = false) => {
  // return rate_1vs1(ratingWinner, ratingLoser, undefined, undefined, ts);
  const ranks = [0, 1];
  const weights = [[1], [tightScore ? TIGHT_FACTOR : 1]];
  const teams = ts.rate([[ratingWinner], [ratingLoser]], ranks, weights, MIN_DELTA);
  return [teams[0][0], teams[1][0]];
};

const ra = new Rating();
const rb = new Rating();
const rc = new Rating();
const rd = new Rating();
console.log(ra.toString(), rb.toString(), rc.toString(), rd.toString());

const [ra1, rb1] = rateMatch(ra, rb); // 1-0
const [ra2, rb2] = rateMatch(ra1, rb1); // 2-0
console.log(ra2.toString(), rb2.toString(), '2-0');

const [ra1t, rb1t] = rateMatch(ra, rb, true); // 1-0
const [ra2t, rb2t] = rateMatch(ra1t, rb1t); // 2-0
console.log(ra2t.toString(), rb2t.toString(), '2-0 tight');

const [ra1tt, rb1tt] = rateMatch(ra, rb, true); // 1-0
const [ra2tt, rb2tt] = rateMatch(ra1tt, rb1tt, true); // 2-0
console.log(ra2tt.toString(), rb2tt.toString(), '2-0 tight tight');

const [rc1tl, rd1tl] = rateMatch(rc, rd); // 1-0
const [rd2tl, rc2tl] = rateMatch(rd1tl, rc1tl, true); // 1-1
const [rc3tl, rd3tl] = rateMatch(rc2tl, rd2tl); // 2-1
console.log(rc3tl.toString(), rd3tl.toString(), '2-1 tight lose');

const [rc1, rd1] = rateMatch(rc, rd); // 1-0
const [rd2, rc2] = rateMatch(rd1, rc1); // 1-1
const [rc3, rd3] = rateMatch(rc2, rd2); // 2-1
console.log(rc3.toString(), rd3.toString(), '2-1');

const [rc1tw, rd1tw] = rateMatch(rc, rd, true); // 1-0
const [rd2tw, rc2tw] = rateMatch(rd1tw, rc1tw); // 1-1
const [rc3tw, rd3tw] = rateMatch(rc2tw, rd2tw, true); // 2-1
console.log(rc3tw.toString(), rd3tw.toString(), '2-1 tight win');

const [rc1at, rd1at] = rateMatch(rc, rd, true); // 1-0
const [rd2at, rc2at] = rateMatch(rd1at, rc1at, true); // 1-1
const [rc3at, rd3at] = rateMatch(rc2at, rd2at, true); // 2-1
console.log(rc3at.toString(), rd3at.toString(), '2-1 all tight');

/*
const team1 = [new Rating(), new Rating()];
const team2 = [new Rating(), new Rating()];

// console.log(team1.toString());
// console.log(team2.toString());

// q is quality of the match with the players at their current rating
const q = quality([team1, team2], undefined, ts);

// Assumes the first team was the winner by default
const [rated1, rated2] = rate([team1, team2], undefined, undefined, 0.0001, ts); // rate also takes weights of winners or draw
// rated1 and rated2 are now arrays with updated scores from result of match

//console.log(rated1.toString()); // team 1 went up in rating
// >> Rating(mu=28.108, sigma=7.774),Rating(mu=28.108, sigma=7.774)
//console.log(rated2.toString()); // team 2 went down in rating
// >> Rating(mu=21.892, sigma=7.774),Rating(mu=21.892, sigma=7.774)

team1[0] = rated1[0];
team2[0] = rated2[0];
console.log(team1[0].toString(), team2[0].toString());

const [r1d, r2d] = rate([[team1[0]], [team2[0]]], [0, 0], [[1], [1]], undefined, ts);
console.log(r1d.toString(), r2d.toString(), 'draw weight');

const [r1e, r2e] = rate([[team1[0]], [team2[0]]], [0, 0], undefined, undefined, ts);
console.log(r1e.toString(), r2e.toString(), 'draw');

const [r1f, r2f] = rate([[team1[0]], [team2[0]]], [0, 1], undefined, undefined, ts);
console.log(r1f.toString(), r2f.toString(), 'current');

const [r1, r2] = rate([[team1[0]], [team2[0]]], [0, 1], [[1], [1]], undefined, ts);
console.log(r1.toString(), r2.toString(), 'weighted');

const [r3a, r4a] = rate([[team1[0]], [team2[0]]], [0, 1], [[1], [2 / 3]], undefined, ts);
console.log(r3a.toString(), r4a.toString(), '0.67');

const [r3b, r4b] = rate([[team1[0]], [team2[0]]], [0, 1], [[1], [0.5]], undefined, ts);
console.log(r3b.toString(), r4b.toString(), '0.5');

const [r3c, r4c] = rate([[team1[0]], [team2[0]]], [0, 1], [[1], [0.25]], undefined, ts);
console.log(r3c.toString(), r4c.toString(), '0.25');

// console.log(quality([r3, r4], undefined, ts));
*/
