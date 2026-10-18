import { loadScore } from './load-score.mjs';
// Local-only GP packaging. Sync points must be supplied from reviewed evidence.
import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { scoreSignature } from './score-signature.mjs';
import * as a from '@coderline/alphatab';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function validateSync(score, points, durationMs) {
  if (!Array.isArray(points) || points.length < 2) throw Error('At least two evidence-backed sync points are required');
  if (score.masterBars.some(b => b.isRepeatStart || b.repeatCount > 0 || b.alternateEndings || b.directions?.size)) throw Error('Repeat/jump synchronization is not supported by this pilot');
  let lastPosition = -1, lastMs = -1;
  for (const p of points) {
    if (!Number.isInteger(p.barIndex) || p.barIndex < 0 || p.barIndex >= score.masterBars.length || !Number.isFinite(p.barPosition) || p.barPosition < 0 || p.barPosition > 1 || p.barOccurence !== 0) throw Error('Invalid bar position or unsupported occurrence');
    const position = p.barIndex + p.barPosition;
    if (position <= lastPosition || !Number.isFinite(p.millisecondOffset) || p.millisecondOffset < 0 || p.millisecondOffset > durationMs || p.millisecondOffset <= lastMs) throw Error('Sync points must increase in score and audio time, within the audio duration');
    if (typeof p.evidence !== 'string' || !p.evidence.trim()) throw Error('Every point needs evidence');
    lastPosition = position; lastMs = p.millisecondOffset;
  }
  if (points[0].barIndex !== 0 || points[0].barPosition !== 0) throw Error('First point must anchor the score start');
  const end = points.at(-1);
  if (end.barIndex !== score.masterBars.length - 1 || end.barPosition !== 1) throw Error('Last point must anchor the score end');
}
export function embedAudio(score, audio, points, durationMs) {
  validateSync(score, points, durationMs);
  score.backingTrack = new a.model.BackingTrack();
  score.backingTrack.rawAudioFile = new Uint8Array(audio);
  score.applyFlatSyncPoints(points);
  const bytes = new a.exporter.Gp7Exporter().export(score);
  const restored = a.importer.ScoreLoader.loadScoreFromBytes(bytes);
  if (hash(restored.backingTrack?.rawAudioFile ?? []) !== hash(audio)) throw Error('Embedded audio changed in round trip');
  const actual = restored.exportFlatSyncPoints();
  if (actual.length !== points.length || points.some((p,i) => ['barIndex','barPosition','barOccurence'].some(k => p[k] !== actual[i][k]) || Math.abs(p.millisecondOffset - actual[i].millisecondOffset) > 1)) throw Error('Sync points changed in round trip');
  // GP container uses 44.1 kHz frame units; allow less than one millisecond rounding.
  if (scoreSignature(score) !== scoreSignature(restored)) throw Error('Musical notation changed in round trip');
  return { bytes, restored };
}
export async function packageAudioScore(configPath, outputDir) {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  if (config.schemaVersion !== 1 || !['candidate','reviewed'].includes(config.syncReview) || !['backing','demonstration'].includes(config.audioKind)) throw Error('Invalid schemaVersion, syncReview or audioKind');
  if (!config.audioSource || !config.scoreSource) throw Error('Score and audio sources are required');
  const base = dirname(resolve(configPath));
  const scorePath = resolve(base, config.scoreSource), audioPath = resolve(base, config.audioSource);
  const probe = JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',audioPath],{encoding:'utf8'}));
  if (!probe.streams.some(s => s.codec_type === 'audio')) throw Error('Source has no audio stream');
  const sourceDuration = Number(probe.format.duration), start = config.trimStartSeconds, duration = config.durationSeconds;
  if (!Number.isFinite(start) || start < 0 || !Number.isFinite(duration) || duration <= 0 || start + duration > sourceDuration + 0.01) throw Error('Invalid audio trim window');
  const scoreBytes = new Uint8Array(await readFile(scorePath));
  const score = loadScore(scoreBytes);
  validateSync(score,config.syncPoints,duration*1000);
  const dest = resolve(outputDir);
  await mkdir(dest); // exclusive: never replace an existing export or directory
  try {
    const wav = join(dest,'audio.wav');
    execFileSync('ffmpeg',['-v','error','-nostdin','-i',audioPath,'-ss',String(start),'-t',String(duration),'-map','0:a:0','-vn','-map_metadata','-1','-ar','44100','-ac','2','-c:a','pcm_s16le',wav]);
    const audio = await readFile(wav);
    const audioProbe = JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-of','json',wav],{encoding:'utf8'}));
    const {bytes,restored} = embedAudio(score,audio,config.syncPoints,Number(audioProbe.format.duration)*1000);
    await writeFile(join(dest,'score.gp'),bytes,{flag:'wx'});
    const report = {...config, scoreSource:scorePath,audioSource:audioPath, scoreSha256:hash(scoreBytes),sourceSha256:hash(await readFile(audioPath)),audioSha256:hash(audio),gpSha256:hash(bytes),audioDurationSeconds:Number(audioProbe.format.duration),audioBytes:(await stat(wav)).size, measures:restored.masterBars.length,checks:{audioBytes:'passed',syncPointRoundTrip:'passed within 1 ms',notes:'passed',guitarPro8:'not tested',listening:'not tested'},syncPoints:config.syncPoints};
    await writeFile(join(dest,'manifest.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    return report;
  } catch(error) { await rm(dest,{recursive:true,force:true}); throw error; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 4) throw Error('Usage: node scripts/package-audio-score.mjs local-config.json NEW-output-directory');
  const r = await packageAudioScore(process.argv[2],process.argv[3]);
  console.log(JSON.stringify({measures:r.measures,syncReview:r.syncReview,checks:r.checks},null,2));
}
