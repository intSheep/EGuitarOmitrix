// Synthetic isolated contexts; never touches the owner's browser profile.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
try {
 for(const width of [1440,768,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.EGUITAR_QA_URL||'http://localhost:5173');
  await page.locator('[data-start]:enabled').waitFor();
  await page.locator('[data-goals]').click();
  await page.locator('#goal-form [name=minutes]').fill('5');await page.locator('#goal-form [name=weekly]').fill('3');await page.locator('#goal-form [name=bpm]').fill('80');
  await page.locator('#goal-form button[type=submit]').click();
  await page.locator('[data-start]').click();await page.locator('#timer-value').waitFor();
  await page.locator('[data-action=metronome]').click();await page.locator('[data-action=metro-toggle]').click();
  await page.waitForTimeout(2200);
  assert.equal(await page.locator('dialog[open]').count(),0);
  await page.locator('[data-action=finish]').click();await page.locator('#finish-form').waitFor();
  assert.equal(await page.locator('#stable-bpm').inputValue(),'');assert.equal(await page.locator('#finish-form input:checked').count(),0);
  assert.match(await page.locator('.tempo-evidence').innerText(),/40 BPM/);
  await page.locator('#stable-bpm').fill('35');await page.locator('#finish-form label').filter({hasText:'还不熟'}).click();
  assert.equal(await page.locator('#finish-form input[value=learning]').isChecked(),true);
  await page.waitForFunction(async()=>{const m=await import('./practice-store.js');const db=await m.openPracticeDB();const d=await m.readDraft(db);db.close();return d?.review?.outcome==='learning';});
  await page.reload();await page.locator('#finish-form').waitFor();
  assert.equal(await page.locator('#finish-form input[value=learning]').isChecked(),true);
  assert.equal(await page.locator('#stable-bpm').inputValue(),'35');
  await page.screenshot({path:`/tmp/eguitar-finish-${width}.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(width===1440) {
    await page.evaluate(()=>{const add=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(...args){if(this.name==='logs'){IDBObjectStore.prototype.add=add;throw new DOMException('Synthetic quota failure','QuotaExceededError');}return add.apply(this,args);};});
    await page.locator('#finish-form button[type=submit]').click();await page.locator('#finish-error').filter({hasText:'保存失败'}).waitFor();
    assert.equal(await page.locator('#stable-bpm').inputValue(),'35');
  }
  await page.locator('#finish-form button[type=submit]').click();await page.locator('.completion').waitFor();
  const result=await page.evaluate(async()=>{const m=await import('./practice-store.js');const db=await m.openPracticeDB();const logs=await m.allLogs(db);db.close();return logs;});
  assert.equal(result.length,1);assert.equal(result[0].bpm,35);assert.equal(result[0].outcome,'learning');assert.ok(result[0].tempoUsage[0].seconds>0);
  if(width===1440){
   const rollback=await page.evaluate(async()=>{
    const m=await import('./practice-store.js'),db=await m.openPracticeDB(),before=await m.allLogs(db),goals=await m.readGoals(db);
    let importRejected=false,staleRejected=false;
    try{await m.importLogs(db,[{...before[0],id:'synthetic-rollback'}],{...goals,weeklySessions:4});}catch{importRejected=true;}
    try{await m.saveGoals(db,{...goals,weeklySessions:7},{weeklySessions:null,lessons:{}});}catch{staleRejected=true;}
    const after=await m.allLogs(db),afterGoals=await m.readGoals(db);db.close();return {importRejected,staleRejected,count:after.length,weekly:afterGoals.weeklySessions};
   });
   assert.deepEqual(rollback,{importRejected:true,staleRejected:true,count:1,weekly:3});
  }

  await page.locator('.completion a[href^="#practice"]').click();await page.reload();
  await page.getByRole('button',{name:'接着练',exact:true}).waitFor();assert.match(await page.locator('.resume-panel').innerText(),/稳定 35 BPM/);
  assert.match(await page.locator('.resume-panel').innerText(),/固定速度/);
  await page.screenshot({path:`/tmp/eguitar-resume-${width}.png`});
  await page.getByRole('button',{name:'接着练',exact:true}).click();await page.locator('#timer-value').waitFor();
  assert.equal(await page.locator('#bpm').inputValue(),'40');
  await page.locator('[data-action=pause]').click();assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Guidance: goals, quiet practice, metronome evidence, recoverable confirmation, save, resume and fixed-tempo constraint passed at 1440/768/390.');
}finally{await browser.close();}
