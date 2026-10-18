// Isolated read-only acceptance of local multi-score navigation.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const course=JSON.parse(await readFile(new URL('../app/data/course.json',import.meta.url),'utf8')).entries;
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
try {
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:960}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.EGUITAR_QA_URL||'http://localhost:5173');
  async function open(number){const e=course.find(e=>e.page===number);await page.evaluate(async e=>(await import('./score-viewer.js')).showScore(e.id,e.title),e);}
  await open(70);
  assert.ok(await page.locator('#score-choice option').count()>=5);
  await page.waitForFunction(()=>!document.querySelector('#score-gp').disabled);
  for(const n of ['1','2','3','4']) {await page.locator('#score-choice').selectOption(n);await page.waitForFunction(()=>!document.querySelector('#score-gp').disabled);}
  await page.screenshot({path:`/tmp/score-collection-${width}.png`});
  assert.equal(await page.locator('#score-dialog').evaluate(e=>e.scrollWidth>e.clientWidth),false);
  await page.locator('#score-close').click();await open(49);
  await page.waitForFunction(()=>!document.querySelector('#score-play').disabled);
  assert.equal(await page.locator('#score-gp').isDisabled(),true);
  assert.equal(await page.locator('#score-xml').isVisible(),true);
  await page.locator('#score-close').click();await open(101);
  await page.locator('#score-status').filter({hasText:'课程图示'}).waitFor();
  assert.equal(await page.locator('#score-images').isVisible(),true);
  assert.equal(await page.locator('#score-gp').isDisabled(),true);
  assert.equal(await page.locator('#score-play').isDisabled(),true);
  assert.equal(await page.locator('#score-xml').isVisible(),false);
  await page.locator('#score-close').click();await open(72);
  await page.locator('#score-status').filter({hasText:'内嵌音频'}).waitFor();
  assert.equal(await page.locator('#score-bpm').inputValue(),'100');
  if(width===1440) {
   const downloading=page.waitForEvent('download');await page.locator('#score-gp').click();const downloaded=await downloading;
   const actual=await readFile(await downloaded.path());const expected=await readFile(new URL('../app/local-scores/p072/score.gp',import.meta.url));
   assert.equal(createHash('sha256').update(actual).digest('hex'),createHash('sha256').update(expected).digest('hex'));
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 const context=await browser.newContext(),page=await context.newPage();
 let release,started;const blocked=new Promise(r=>release=r),requested=new Promise(r=>started=r);
 await page.route('**/local-scores/index.json',async route=>{started();await blocked;await route.continue();});
 await page.goto(process.env.EGUITAR_QA_URL||'http://localhost:5173');
 const entry=course.find(e=>e.page===70);
 await page.evaluate(e=>{import('./score-viewer.js').then(m=>m.showScore(e.id,e.title));},entry);
 await requested;
 await page.locator('#score-file').setInputFiles(new URL('../app/local-scores/p026/score.gp',import.meta.url).pathname);
 await page.waitForFunction(()=>!document.querySelector('#score-gp').disabled);
 const status=await page.locator('#score-status').innerText();release();await page.waitForTimeout(500);
 assert.equal(await page.locator('#score-status').innerText(),status);assert.equal(await page.locator('#score-choice-label').isVisible(),false);
 await context.close();
 console.log('Collection: multi-piece switching, short-bar XML, reference-only images, embedded audio and mobile layout passed.');
}finally{await browser.close();}
