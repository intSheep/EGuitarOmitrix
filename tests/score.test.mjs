import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import * as a from "@coderline/alphatab";
const fixture = {
  title: "Synthetic score",
  tempo: 60,
  tuning: [64, 59, 55, 50, 45, 40],
  source: "Synthetic test only",
  bars: [[{ string: 1, fret: 0, quarters: 4 }]],
};
test("reviewed transcription preserves string/fret, pitch and duration through MusicXML and GP", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eguitar-score-"));
  try {
    const input = join(dir, "test.json"),
      xml = join(dir, "test.musicxml");
    await writeFile(input, JSON.stringify(fixture));
    const result = spawnSync(
      "python3",
      ["scripts/write-musicxml.py", input, xml],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const score = a.importer.ScoreLoader.loadScoreFromBytes(
      new Uint8Array(await readFile(xml)),
    );
    const gp = new a.exporter.Gp7Exporter().export(score),
      back = a.importer.ScoreLoader.loadScoreFromBytes(gp);
    const beat = back.tracks[0].staves[0].bars[0].voices[0].beats[0];
    assert.equal(beat.duration, 1);
    assert.equal(beat.notes[0].fret, 0);
    assert.equal(beat.notes[0].realValue, 64);
    assert.equal(back.masterBars.length, 1);
  } finally {
    await rm(dir, { recursive: true });
  }
});
test("transcription refuses unbalanced measures and orphan ties", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eguitar-invalid-"));
  try {
    for (const note of [
      { string: 1, fret: 0, quarters: 3 },
      { string: 1, fret: 0, quarters: 4, tie: "stop" },
    ]) {
      const input = join(dir, "bad.json");
      await writeFile(input, JSON.stringify({ ...fixture, bars: [[note]] }));
      const result = spawnSync(
        "python3",
        ["scripts/write-musicxml.py", input, join(dir, "bad.musicxml")],
        { encoding: "utf8" },
      );
      assert.notEqual(result.status, 0);
    }
  } finally {
    await rm(dir, { recursive: true });
  }
});
