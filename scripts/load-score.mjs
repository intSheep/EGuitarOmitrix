import {execFileSync} from 'node:child_process';
import * as a from '@coderline/alphatab';
// MusicXML represents a legato slide with both a slide and a slur. alphaTab
// imports their endpoints but leaves slideOutType as Shift; restore that intent.
export function loadScore(bytes) {
 const score=a.importer.ScoreLoader.loadScoreFromBytes(bytes);
 if (new TextDecoder().decode(bytes.subarray(0,200)).includes('<?xml')) {
  for (const t of score.tracks) for (const st of t.staves) for (const b of st.bars)
   for (const v of b.voices) for (const beat of v.beats) for (const n of beat.notes) {
    n.isPalmMute = beat.isPalmMute;
    n.isLetRing = beat.isLetRing;
    if (n.slideTarget && n.slideTarget===n.slurDestination) n.slideOutType=a.model.SlideOutType.Legato;
   }
 }
 const xml=new TextDecoder().decode(bytes);
 if (xml.includes('<software>EGuitarOmitrix reviewed writer</software>')) {
  const patches=JSON.parse(execFileSync('python3',[new URL('./musicxml-techniques.py',import.meta.url).pathname],{input:xml,encoding:'utf8',maxBuffer:1024*1024}));
  for(const p of patches) {
   const n=score.tracks[p.track]?.staves[0]?.bars[p.bar]?.voices[0]?.beats[p.beat]?.notes[p.note];
   if(!n) throw Error('Technique mapping did not match imported notation');
   if(p.dead) n.isDead=true;
   if('hammerPullOrigin' in p) n.isHammerPullOrigin=p.hammerPullOrigin;
   if(p.slideInBelow) n.slideInType=a.model.SlideInType.IntoFromBelow;
   if(p.slideOutDown) n.slideOutType=a.model.SlideOutType.OutDown;
  }
 }
 return score;
}
