// Convert a local structured score; never recognizes notes from images.
import { readFile, writeFile } from "node:fs/promises";
import * as alphaTab from "@coderline/alphatab";
const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error(
    "Usage: node scripts/convert-score.mjs input.musicxml output.gp",
  );
  process.exit(1);
}
const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
  new Uint8Array(await readFile(input)),
);
const signature = (s) =>
  JSON.stringify({
    bars: s.masterBars.map((b) => [
      b.timeSignatureNumerator,
      b.timeSignatureDenominator,
    ]),
    tracks: s.tracks.map((t) =>
      t.staves.map((st) => ({
        tuning: st.tuning,
        bars: st.bars.map((b) =>
          b.voices.map((v) =>
            v.beats.map((x) => ({
              duration: x.duration,
              dots: x.dots,
              notes: x.notes.map((n) => [
                n.string,
                n.fret,
                n.realValue,
                n.isTieDestination,
              ]),
            })),
          ),
        ),
      })),
    ),
  });
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
