// Synthetic isolated browser data only.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
try {
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'Asia/Shanghai'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.EGUITAR_QA_URL||'http://localhost:5173');await page.locator('[data-start]:enabled').waitFor();
  const ids=await page.evaluate(async()=>{
   const assignments=(await (await fetch('./data/assignments.json')).json()).items,m=await import('./practice-store.js'),db=await m.openPracticeDB();
   const a=assignments.find(a=>a.page===3),now=Date.now();
   for(const [id,end,seconds] of [['synthetic-today',now,120],['synthetic-yesterday',now-86400000,2400]]){
    const start=end-seconds*1000,stamp=new Date(start).toISOString();
    await m.saveLog(db,{id,entryId:a.entryId,assignmentVersion:a.version,source:'timer',minutes:seconds/60,seconds,intervals:[{start,end}],outcome:null,bpm:null,practicedAt:stamp,createdAt:stamp,updatedAt:stamp,note:'Synthetic acceptance',nextFocus:'',deletedAt:null});
   }
   db.close();return Object.fromEntries(assignments.map(a=>[a.page,a.entryId]));
  });
  await page.reload();await page.locator('[data-start]:enabled').waitFor();
  assert.match(await page.locator('.daily-progress').innerText(),/已练 02:00/);assert.match(await page.locator('.daily-progress').innerText(),/还差 03:00/);
  assert.equal(await page.locator('.daily-progress progress').getAttribute('max'),'300');
  assert.match(await page.locator('.teacher-tempo').innerText(),/固定 40 BPM/);
  await page.screenshot({path:`/tmp/daily-workspace-${width}.png`});
  await page.locator('[data-start]').click();await page.waitForFunction(()=>Number(document.querySelector('.daily-progress progress')?.value)>=122);
  const live=Number(await page.locator('.daily-progress progress').getAttribute('value'));assert.ok(live>=122&&live<130);
  await page.locator('[data-action=pause]').click();const paused=await page.locator('.daily-values').innerText();await page.waitForTimeout(1200);assert.equal(await page.locator('.daily-values').innerText(),paused);
  await page.locator('[data-action=finish]').click();await page.locator('#finish-form').waitFor();
  assert.equal(await page.locator('#finish-form input:checked').count(),0);
  await page.locator('#finish-form button[type=submit]').click();await page.locator('.completion').waitFor();
  await page.locator('.completion a[href^="#practice"]').click();
  assert.ok(Number(await page.locator('.daily-progress progress').getAttribute('value'))<130);
  await page.goto((process.env.EGUITAR_QA_URL||'http://localhost:5173')+`/#practice?lesson=${ids[117]}`);await page.locator('.daily-progress').waitFor();
  assert.match(await page.locator('.daily-progress').innerText(),/每日时长未明确/);assert.equal(await page.locator('.daily-progress progress').count(),0);assert.doesNotMatch(await page.locator('.daily-values').innerText(),/还差/);
  await page.screenshot({path:`/tmp/daily-unknown-${width}.png`});
  await page.goto((process.env.EGUITAR_QA_URL||'http://localhost:5173')+`/#practice?lesson=${ids[70]}`);await page.locator('.teacher-tempo').waitFor();assert.match(await page.locator('.teacher-tempo').innerText(),/40 BPM 起步.*目标 BPM 未明确/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Daily progress passed: explicit target, no backlog, active draft/pause/save without duplicates, unknown duration/BPM, desktop/mobile.');
}finally{await browser.close();}
