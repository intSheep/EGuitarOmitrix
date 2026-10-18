// Isolated browser check for a locally prepared GP with embedded audio.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as a from '@coderline/alphatab';
const input=process.argv[2];
if(!input) throw Error('Usage: node scripts/verify-audio-score.mjs local-score.gp');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
try {
 const context=await browser.newContext({acceptDownloads:true});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const original=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(...args){window.__testAudio=this;return original.apply(this,args);};
 });
 await page.goto((process.env.EGUITAR_QA_URL || 'http://localhost:5175')+'/#practice?stage=1');
 await page.locator('[data-start]').click();
 await page.locator('[data-score]').click();
 await page.waitForFunction(()=>document.querySelector('#score-status')?.textContent.includes('还没有谱'));
 await page.locator('#score-file').setInputFiles(input);
 await page.waitForFunction(()=>document.querySelector('#score-status')?.textContent.includes('内嵌音频') && !document.querySelector('#score-play').disabled);
 await page.locator('#score-play').click();
 await page.waitForFunction(()=>window.__testAudio && !window.__testAudio.paused && window.__testAudio.currentTime>0);
 if(process.env.EGUITAR_QA_SCREENSHOT) await page.screenshot({path:process.env.EGUITAR_QA_SCREENSHOT,fullPage:true});
 const time=await page.evaluate(()=>window.__testAudio.currentTime);
 await page.waitForFunction(t=>window.__testAudio.currentTime>t+.2,time);
 await page.locator('#score-bpm').fill('50');await page.locator('#score-bpm').dispatchEvent('change');
 assert.equal(await page.evaluate(()=>window.__testAudio.playbackRate),.5);
 await page.locator('#score-loop').check();
 await page.locator('#score-play').click();
 assert.equal(await page.evaluate(()=>window.__testAudio.paused),true);
 const downloading=page.waitForEvent('download');await page.locator('#score-gp').click();
 const file=await downloading;
 const bytes=new Uint8Array(await readFile(await file.path()));
 const restored=a.importer.ScoreLoader.loadScoreFromBytes(bytes);
 const source=a.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(await readFile(input)));
 assert.deepEqual(restored.backingTrack.rawAudioFile,source.backingTrack.rawAudioFile);
 assert.deepEqual(restored.exportFlatSyncPoints(),source.exportFlatSyncPoints());
 await page.locator('#score-close').click();
 assert.equal(await page.evaluate(()=>window.__testAudio.paused),true);
 assert.deepEqual(errors,[]);
 console.log('PASS embedded audio decodes and advances, BPM changes rate, pause/close stop audio, download retains bytes and sync points. Not a listening or GP8 check.');
} finally {await browser.close();}
