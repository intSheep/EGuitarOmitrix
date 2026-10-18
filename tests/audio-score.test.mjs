import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,readFile,rm,access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import * as a from '@coderline/alphatab';
import { validateSync,packageAudioScore } from '../scripts/package-audio-score.mjs';
const points = [{barIndex:0,barPosition:0,barOccurence:0,millisecondOffset:500,evidence:'Synthetic click start'}, {barIndex:0,barPosition:1,barOccurence:0,millisecondOffset:4500,evidence:'Synthetic four-beat end'}];
test('sync validation rejects missing, unordered, out-of-range and unsupported repeat anchors',()=>{
 const s={masterBars:[{}]};
 validateSync(s,points,5000);
 for(const bad of [[],[points[0]],points.map(p=>({...p,evidence:''})),points.map(p=>({...p,barOccurence:1})),[points[0],{...points[1],millisecondOffset:6000}],[points[0],{...points[1],millisecondOffset:400}],[{...points[0],barPosition:0.2},points[1]]]) assert.throws(()=>validateSync(s,bad,5000));
 assert.throws(()=>validateSync({masterBars:[{repeatCount:2}]},points,5000));
});
test('audio packaging preserves bytes, lead-in, score and sync; refuses overwrite',async()=>{
 const d=await mkdtemp(join(tmpdir(),'eguitar-audio-'));
 try {
  await writeFile(join(d,'notes.json'),JSON.stringify({title:'Synthetic audio test',tempo:60,tuning:[64,59,55,50,45,40],source:'Synthetic only',bars:[[{string:1,fret:0,quarters:4}]]}));
  execFileSync('python3',['scripts/write-musicxml.py',join(d,'notes.json'),join(d,'score.musicxml')]);
  execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=5','-c:a','pcm_s16le',join(d,'source.wav')]);
  const cfg={schemaVersion:1,scoreSource:'score.musicxml',audioSource:'source.wav',audioKind:'backing',syncReview:'candidate',trimStartSeconds:0,durationSeconds:5,syncPoints:points};
  await writeFile(join(d,'config.json'),JSON.stringify(cfg));
  const r=await packageAudioScore(join(d,'config.json'),join(d,'out'));
  assert.equal(r.checks.audioBytes,'passed');
  assert.equal(r.checks.guitarPro8,'not tested');
  const gp=new Uint8Array(await readFile(join(d,'out/score.gp')));
  const restored=a.importer.ScoreLoader.loadScoreFromBytes(gp);
  assert.ok(restored.backingTrack.rawAudioFile.length>1000);
  assert.equal(restored.exportFlatSyncPoints()[0].millisecondOffset,500);
  await assert.rejects(packageAudioScore(join(d,'config.json'),join(d,'out')));
  assert.deepEqual(new Uint8Array(await readFile(join(d,'out/score.gp'))),gp);
  await writeFile(join(d,'config.json'),JSON.stringify({...cfg,durationSeconds:10}));
  await assert.rejects(packageAudioScore(join(d,'config.json'),join(d,'bad')));
  await assert.rejects(access(join(d,'bad')));
 } finally { await rm(d,{recursive:true,force:true}); }
});
