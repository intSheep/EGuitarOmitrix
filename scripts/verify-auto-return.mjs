// Isolated browser storage and synthetic page-visibility/external-video events.
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
const base = process.env.EGUITAR_QA_URL || 'http://localhost:5173';
const read = page => page.evaluate(async () => {const m=await import('/practice-store.js');return m.readDraft(await m.openPracticeDB());});
const running = (page,value) => page.waitForFunction(async value => {
  const m=await import('/practice-store.js'),s=await m.readDraft(await m.openPracticeDB()),button=document.querySelector('[data-action=pause]');
  return s?.running===value && (!button || button.textContent===(value?'暂停':'继续练习'));
},value);
const visible = (page,value) => page.evaluate(value => {
  Object.defineProperty(document,'hidden',{configurable:true,value:!value});
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event(value?'focus':'blur'));
},value);
try {
 for (const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];
  await context.route('https://www.bilibili.com/**',r=>r.fulfill({contentType:'text/html',body:'<h1>Synthetic course page</h1>'}));
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('[data-start]:enabled').click();await running(page,true);
  await page.waitForTimeout(1200);
  await page.locator('[data-position-reference]').click();
  await page.locator('[data-position="3"]').click();
  await visible(page,false);await running(page,false);
  const paused=await read(page);await page.waitForTimeout(1300);
  assert.equal((await read(page)).elapsedMs,paused.elapsedMs);
  const returnedAt=Date.now();
  await visible(page,true);await running(page,true);
  assert.equal((await read(page)).elapsedMs,paused.elapsedMs);
  assert.equal(await page.locator('[data-position="3"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-floating-state]').innerText(),'练习中');
  await page.waitForTimeout(1200);
  const resumed=await read(page);
  assert.ok(resumed.elapsedMs>paused.elapsedMs);
  assert.ok(resumed.intervals.at(-1).start>=returnedAt-50);
  // Duplicate return events cannot create extra elapsed time or a second session.
  await visible(page,true);assert.equal((await read(page)).id,paused.id);
  await page.locator('[data-action=pause]').click();await running(page,false);
  const manual=await read(page);
  await visible(page,false);await visible(page,true);await page.waitForTimeout(1100);
  assert.equal((await read(page)).elapsedMs,manual.elapsedMs);
  assert.equal((await read(page)).running,false);
  assert.equal((await read(page)).reason,'已暂停');
  await page.locator('[data-action=pause]').click();await running(page,true);
  await page.evaluate(()=>location.hash='history');await running(page,false);
  const navigated=await read(page);await page.waitForTimeout(1200);
  assert.equal((await read(page)).elapsedMs,navigated.elapsedMs);
  await page.evaluate(()=>location.hash='focus');await running(page,true);
  await page.locator('[data-tuner]').first().click();await running(page,false);
  await visible(page,false);await visible(page,true);
  assert.equal((await read(page)).running,false);
  await page.locator('#tuner-close').click();
  assert.equal((await read(page)).running,false);
  await page.locator('[data-material]').click();
  const pausedPopup=context.waitForEvent('page');await page.locator('#video-launch').click();const preview=await pausedPopup;
  await preview.waitForURL('https://www.bilibili.com/**');
  await visible(page,false);await page.waitForTimeout(1100);await visible(page,true);
  await page.locator('#watch-form').waitFor();await page.locator('[data-action=watch-discard]').click();
  await page.waitForFunction(()=>!document.querySelector('#watch-form'));
  assert.equal((await read(page)).running,false);await preview.close();
  // Viewing must be confirmed first; confirmation continues formerly active practice.
  await page.locator('[data-action=pause]').click();await running(page,true);
  if (!await page.locator('#video-launch').isVisible()) await page.locator('[data-material]').click();
  const nextPage=context.waitForEvent('page');await page.locator('#video-launch').click();const video=await nextPage;
  await video.waitForURL('https://www.bilibili.com/**');
  await visible(page,false);await page.waitForTimeout(1200);await visible(page,true);
  await page.locator('#watch-form').waitFor();assert.equal((await read(page)).running,false);
  await page.locator('[name=watchDuration]').fill('00:01');await page.locator('#watch-form [type=submit]').click();await running(page,true);
  await video.close();
  // Saving an automatic resume must fail visibly and remain paused on abort.
  await visible(page,false);await running(page,false);
  await page.evaluate(()=>{
    const original=IDBDatabase.prototype.transaction;
    window.restoreTransactions=()=>IDBDatabase.prototype.transaction=original;
    let fail=true;
    IDBDatabase.prototype.transaction=function(stores,...args){const tx=original.call(this,stores,...args);if(fail&&stores==='session'&&args[0]==='readwrite'){fail=false;queueMicrotask(()=>tx.abort());}return tx;};
  });
  await visible(page,true);
  await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('未能保存'));
  assert.equal((await read(page)).running,false);
  await page.evaluate(()=>window.restoreTransactions());
  await visible(page,true);assert.equal((await read(page)).running,false);
  // Page reload and finish confirmation never inherit a live return intention.
  await page.locator('[data-action=pause]').click();await running(page,true);
  await page.reload();await page.locator('#timer-state').waitFor();
  assert.equal(await page.locator('[data-action=pause]').innerText(),'继续练习');
  const recovered=await page.locator('#timer-value').innerText();
  await visible(page,true);await page.waitForTimeout(1100);
  assert.equal(await page.locator('#timer-value').innerText(),recovered);
  assert.equal(await page.locator('[data-action=pause]').innerText(),'继续练习');
  await page.locator('[data-action=pause]').click();await running(page,true);
  await page.locator('[data-action=finish]').click();await page.locator('#finish-form').waitFor();
  await visible(page,false);await visible(page,true);assert.equal((await read(page)).running,false);
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Automatic return passed at desktop/phone: background gaps excluded, timer/selected tool restored, duplicate events, route return, manual pause, tuner, watch confirmation, failed resume, reload and finish safeguards.');
} finally {await browser.close();}
