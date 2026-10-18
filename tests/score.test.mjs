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

test("staff-only transcription preserves rests, octave and dotted durations without fingering", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eguitar-staff-"));
  try {
    const input=join(dir,"notes.json"), xml=join(dir,"score.musicxml");
    await writeFile(input,JSON.stringify({title:"Synthetic staff",notation:"staff",tempo:80,source:"Synthetic only",bars:[[{rest:true,quarters:4}],[{midi:72,quarters:3},{midi:60,quarters:1}]]}));
    const result=spawnSync("python3",["scripts/write-musicxml.py",input,xml],{encoding:"utf8"});
    assert.equal(result.status,0,result.stderr);
    const content=await readFile(xml,"utf8");
    assert.doesNotMatch(content,/<technical>|<fret>|<string>|<staff-tuning/);
    const score=a.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(await readFile(xml)));
    const restored=a.importer.ScoreLoader.loadScoreFromBytes(new a.exporter.Gp7Exporter().export(score));
    const staff=restored.tracks[0].staves[0];
    assert.ok(staff.bars[0].voices[0].beats[0].isRest);
    const beats=staff.bars[1].voices[0].beats;
    assert.equal(beats[0].duration,2);assert.equal(beats[0].dots,1);
    assert.equal(beats[0].notes[0].realValue,72);assert.equal(beats[1].notes[0].realValue,60);
  } finally {await rm(dir,{recursive:true});}
});
test("staff writer rejects implied fingering, pitched rests and invalid MIDI",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"eguitar-staff-invalid-"));
 try {
  for(const note of [{midi:60,string:2,quarters:4},{rest:true,midi:60,quarters:4},{midi:128,quarters:4}]) {
   const input=join(dir,"notes.json");
   await writeFile(input,JSON.stringify({title:"Synthetic invalid",notation:"staff",tempo:80,source:"Synthetic only",bars:[[note]]}));
   const result=spawnSync("python3",["scripts/write-musicxml.py",input,join(dir,"bad.musicxml")],{encoding:"utf8"});
   assert.notEqual(result.status,0);
  }
 } finally {await rm(dir,{recursive:true});}
});

test('tuplets, accents, pick strokes and repeats survive MusicXML and GP', async () => {
 const dir=await mkdtemp(join(tmpdir(),'eguitar-tuplets-'));
 try {
  const notes=Array.from({length:24},(_,i)=>({string:1,fret:0,quarters:'1/6',tuplet:[6,4],accent:i%6===0,pick:i%2?'up':'down'}));
  const input=join(dir,'source.json'),xml=join(dir,'source.musicxml');
  await writeFile(input,JSON.stringify({...fixture,bars:[notes],repeatEnds:{1:2}}));
  const r=spawnSync('python3',['scripts/write-musicxml.py',input,xml],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  const original=a.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(await readFile(xml)));
  const restored=a.importer.ScoreLoader.loadScoreFromBytes(new a.exporter.Gp7Exporter().export(original));
  const {scoreSignature}=await import('../scripts/score-signature.mjs');
  assert.equal(scoreSignature(original),scoreSignature(restored));
  const beats=restored.tracks[0].staves[0].bars[0].voices[0].beats;
  assert.equal(beats.length,24);assert.equal(beats.reduce((n,b)=>n+b.playbackDuration,0),3840);
  assert.equal(beats[0].tupletNumerator,6);assert.equal(beats[0].tupletDenominator,4);
  assert.equal(beats[0].notes[0].accentuated,a.model.AccentuationType.Normal);
  assert.equal(beats[1].pickStroke,a.model.PickStroke.Up);assert.equal(restored.masterBars[0].repeatCount,2);
 } finally {await rm(dir,{recursive:true});}
});

test('chord ties, palm mute, let ring and legato slide survive the reviewed loader',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'eguitar-techniques-'));
 try {
  const input=join(dir,'source.json'),xml=join(dir,'score.musicxml');
  const fixture2={...fixture,bars:[
   [{string:5,fret:3,quarters:2,tie:'start',palmMute:true},{string:4,fret:5,quarters:2,tie:'start',chord:true,palmMute:true},{string:5,fret:3,quarters:2,tie:'stop',letRing:true},{string:4,fret:5,quarters:2,tie:'stop',chord:true,letRing:true}],
   [{string:3,fret:5,quarters:1,slide:'start',legato:true},{string:3,fret:7,quarters:1,slide:'stop',legato:true},{string:3,fret:5,quarters:1,hammer:'start'},{string:3,fret:7,quarters:1,hammer:'stop'}]
  ]};
  await writeFile(input,JSON.stringify(fixture2));const result=spawnSync('python3',['scripts/write-musicxml.py',input,xml],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const {loadScore}=await import('../scripts/load-score.mjs');const {scoreSignature}=await import('../scripts/score-signature.mjs');
  const original=loadScore(new Uint8Array(await readFile(xml)));const back=a.importer.ScoreLoader.loadScoreFromBytes(new a.exporter.Gp7Exporter().export(original));
  assert.equal(scoreSignature(original),scoreSignature(back));const bars=back.tracks[0].staves[0].bars;
  assert.equal(bars[0].voices[0].beats[0].notes.length,2);assert.equal(bars[0].voices[0].beats[0].isPalmMute,true);assert.equal(bars[0].voices[0].beats[1].isLetRing,true);
  const b=bars[1].voices[0].beats;assert.equal(b[0].notes[0].slideOutType,a.model.SlideOutType.Legato);assert.equal(b[2].notes[0].isHammerPullOrigin,true);assert.equal(b[3].notes[0].isHammerPullOrigin,false);
 } finally{await rm(dir,{recursive:true});}
});

test('grace slides, bends, dead notes and staccato survive GP export',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'eguitar-effects-'));
 try {
  const input=join(dir,'source.json'),xml=join(dir,'score.musicxml');
  await writeFile(input,JSON.stringify({...fixture,bars:[[
   {string:2,fret:5,quarters:0,grace:true,slideIn:'below'},
   {string:2,fret:7,quarters:1,bend:[{semitones:2},{semitones:0,release:true}]},
   {string:2,fret:7,quarters:1,staccato:true},
   {string:2,fret:7,quarters:1,dead:true},
   {string:2,fret:7,quarters:1,slideOut:'down',vibrato:true}
  ]]}));
  const result=spawnSync('python3',['scripts/write-musicxml.py',input,xml],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const {loadScore}=await import('../scripts/load-score.mjs');const {scoreSignature}=await import('../scripts/score-signature.mjs');
  const score=loadScore(new Uint8Array(await readFile(xml)));const back=a.importer.ScoreLoader.loadScoreFromBytes(new a.exporter.Gp7Exporter().export(score));
  assert.equal(scoreSignature(score),scoreSignature(back));
  const beats=back.tracks[0].staves[0].bars[0].voices[0].beats;
  assert.notEqual(beats[0].graceType,a.model.GraceType.None);
  assert.equal(beats[0].notes[0].slideInType,a.model.SlideInType.IntoFromBelow);
  assert.ok(beats[1].notes[0].bendPoints.length>1);
  assert.equal(beats[2].notes[0].isStaccato,true);assert.equal(beats[3].notes[0].isDead,true);
  assert.equal(beats[4].notes[0].slideOutType,a.model.SlideOutType.OutDown);
 } finally {await rm(dir,{recursive:true});}
});
