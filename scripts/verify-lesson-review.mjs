// Synthetic records in disposable browser contexts only.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
try {for(const width of [1440,768,390]) {
 const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.EGUITAR_QA_URL||'http://localhost:5173');await page.locator('[data-start]:enabled').waitFor();
 await page.evaluate(()=>location.hash='#history');await page.getByText('完成第一次练习后，这里会展示每课的变化。').waitFor();
 const info=await page.evaluate(async()=>{
  const {items}=await(await fetch('./data/assignments.json')).json(),a=items[0],m=await import('./practice-store.js'),db=await m.openPracticeDB();
  for(let i=0;i<23;i++) {const at=new Date(Date.UTC(2026,0,i+1,10)).toISOString();await m.saveLog(db,{id:`synthetic-review-${i}`,entryId:a.entryId,assignmentVersion:i===22?'synthetic-old':a.version,minutes:5,practicedAt:at,createdAt:at,updatedAt:at,note:'Synthetic QA',nextFocus:'',deletedAt:null,outcome:i===21?'learning':'mastered',bpm:i===20?50:60,...(i===21?{}:{bpmBasis:'self-reported-stable'})});}
  db.close();return {id:a.entryId,version:a.version};
 });
 await page.reload();await page.locator('.lesson-progress-row').first().waitFor();assert.equal(await page.locator('.lesson-progress-row').count(),2);
 await page.locator('.review-filters a[href$="continue"]').click();await page.waitForFunction(()=>document.querySelectorAll('.lesson-progress-row').length===1);
 await page.locator('.lesson-progress-row a').click();await page.locator('.tempo-chart').waitFor();
 assert.equal(await page.locator('.tempo-chart circle').count(),21);assert.equal(await page.locator('.tempo-chart polyline').count(),0);
 assert.match(await page.locator('.lesson-metrics').innerText(),/50 BPM/);assert.match(await page.locator('.lesson-metrics').innerText(),/还不熟/);
 assert.equal(await page.locator('tbody tr').count(),20);await page.getByRole('link',{name:'下一页',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===2);
 await page.locator('#review-version').selectOption({label:'历史要求 · synthetic-old'});await page.waitForFunction(()=>document.querySelectorAll('.tempo-chart circle').length===1);
 await page.locator('#review-version').selectOption({label:`当前要求 · ${info.version}`});
 await page.waitForFunction(()=>document.querySelectorAll('.tempo-chart circle').length===21);await page.locator('tbody tr a').first().click();await page.locator('[data-edit-result]').click();await page.locator('#result-form input[name=bpm]').fill('55');
 await page.locator('#result-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('.lesson-metrics')?.textContent.includes('55 BPM'));
 await page.screenshot({path:`/tmp/eguitar-review-${width}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);await context.close();
}console.log('Lesson review: empty, versions, filters, exact pagination, single point, result edit and 1440/768/390 layout passed.');}finally{await browser.close();}
