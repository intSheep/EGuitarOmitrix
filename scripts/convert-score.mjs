import { loadScore } from './load-score.mjs';
// Convert a local structured score; never recognizes notes from images.
import { readFile, writeFile } from "node:fs/promises";
import { scoreSignature as signature } from "./score-signature.mjs";
import * as alphaTab from "@coderline/alphatab";
const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error(
    "Usage: node scripts/convert-score.mjs input.musicxml output.gp",
  );
  process.exit(1);
}
const score = loadScore(
  new Uint8Array(await readFile(input)),
);
const bytes = new alphaTab.exporter.Gp7Exporter().export(score);
const roundTrip = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes);
if (signature(score) !== signature(roundTrip))
  throw Error("Round-trip note/rhythm/tuning mismatch; output not written");
await writeFile(output, bytes, { flag: "wx" });
console.log(
  JSON.stringify(
    {
      title: score.title,
      measures: score.masterBars.length,
      tracks: score.tracks.length,
      tempo: score.tempo,
      roundTrip: "passed",
      guitarProDesktop: "not tested",
    },
    null,
    2,
  ),
);
