// Uses fresh browser contexts and synthetic records only. Never connects to an existing browser profile.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
const baseURL=process.env.EGUITAR_QA_URL || 'http://localhost:5173';
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(`${baseURL}/`);await page.locator('.practice-form').waitFor();
assert.equal(await page.locator('.resume-card').count(),0);
assert.match(await page.locator('.assignment-section').innerText(),/固定 40 BPM，不加速/);
assert.equal(await page.locator('[name=minutes]').inputValue(),'');
let form=page.locator('.practice-form');await form.locator('[name=minutes]').fill('12.5');await form.locator('[name=outcome]').selectOption('slow');await form.locator('[name=bpm]').fill('40');await form.locator('[name=nextFocus]').fill('Synthetic: next time keep rhythm');await form.locator('[name=note]').fill('<script>synthetic</script>');
await page.reload();await page.locator('.practice-form').waitFor();assert.equal(await page.locator('[name=minutes]').inputValue(),'12.5');
await page.locator('.practice-form [type=submit]').dblclick();await page.locator('.resume-card').waitFor();
await page.reload();await page.locator('.resume-card').waitFor();assert.match(await page.locator('.resume-card').innerText(),/12.5 分钟/);
await page.goto(`${baseURL}/#history`);await page.locator('.history-card').waitFor();assert.equal(await page.locator('.history-card').count(),1);assert.match(await page.locator('.history-card').innerText(),/<script>synthetic/);
await page.locator('[data-edit-log]').click();await page.locator('#record-dialog[open]').waitFor();await page.locator('#record-dialog [name=minutes]').fill('15');await page.locator('#record-dialog [type=submit]').click();await page.waitForFunction(()=>document.querySelector('.history-result')?.textContent.includes('15 分钟'));
await page.locator('[data-delete-log]').click();await page.locator('.empty-state').waitFor();await page.locator('.deleted-history summary').click();await page.locator('[data-restore-log]').click();await page.locator('.history-card').waitFor();
const downloadPromise=page.waitForEvent('download');await page.locator('#export-practice').click();const download=await downloadPromise;await download.saveAs('/tmp/synthetic-practice-backup.json');
await page.locator('#import-practice').setInputFiles('/tmp/synthetic-practice-backup.json');await page.locator('#confirm-import').waitFor();assert.match(await page.locator('#import-preview').innerText(),/新增 0 条记录/);await page.locator('#confirm-import').click();await page.locator('#confirm-import').waitFor({state:'detached'});await page.locator('.history-card').waitFor();assert.equal(await page.locator('.history-card').count(),1);
await page.locator('#import-practice').setInputFiles({name:'future.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({app:'EGuitarOmitrix',schemaVersion:99,logs:[]}))});await page.waitForFunction(()=>document.querySelector('#import-preview').textContent.includes('版本不支持'));assert.equal(await page.locator('.history-card').count(),1);
// Two-tab optimistic edit conflict must not lose the first save.
const other=await context.newPage();await other.goto(`${baseURL}/#history`);await other.locator('[data-edit-log]').click();
await page.locator('[data-edit-log]').click();await page.locator('#record-dialog [name=minutes]').fill('16');await page.locator('#record-dialog [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#record-dialog').open);
await other.locator('#record-dialog [name=minutes]').fill('18');await other.locator('#record-dialog [type=submit]').click();await other.locator('.form-error:not([hidden])').waitFor();assert.match(await other.locator('.form-error:not([hidden])').innerText(),/另一窗口/);await other.close();
// Record a different stage, then visit root: resume that exercise instead of video cursor.
await page.goto(`${baseURL}/#practice?stage=3`);await page.locator('.practice-form').waitFor();await page.locator('.practice-form [name=minutes]').fill('6');await page.locator('.practice-form [name=outcome]').selectOption('learning');await page.locator('.practice-form [name=nextFocus]').fill('Synthetic W3 focus');await page.locator('.practice-form [type=submit]').click();await page.waitForFunction(()=>document.querySelector('.resume-card').textContent.includes('Synthetic W3'));
await page.goto(`${baseURL}/`);await page.locator('.resume-card').waitFor();assert.equal(await page.locator('[data-stage="3"]').getAttribute('aria-pressed'),'true');
await page.screenshot({path:'/tmp/practice-desktop.png'});
await page.setViewportSize({width:820,height:1180});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('.exercise-select').first().click();await page.locator('#lesson-dialog[open]').waitFor();await page.locator('#lesson-dialog .practice-form [name=minutes]').fill('7');await page.locator('#lesson-dialog .practice-form [name=outcome]').selectOption('steady');await page.locator('#lesson-dialog .practice-form [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#lesson-dialog').open);await page.screenshot({path:'/tmp/practice-mobile.png'});
// Restore into fresh isolated storage.
const fresh=await browser.newContext();const fp=await fresh.newPage();await fp.goto(`${baseURL}/#history`);await fp.locator('#import-practice').waitFor();await fp.locator('#import-practice').setInputFiles('/tmp/synthetic-practice-backup.json');await fp.locator('#confirm-import').click();await fp.locator('.history-card').waitFor();assert.equal(await fp.locator('.history-card').count(),1);
const blocked=await browser.newContext();await blocked.addInitScript(()=>Object.defineProperty(window,'indexedDB',{get(){throw new Error('Synthetic blocked storage');}}));const bp=await blocked.newPage();await bp.goto(`${baseURL}/`);await bp.locator('.storage-error').first().waitFor();assert.equal(await bp.locator('.practice-form').count(),0);assert.ok(await bp.locator('[data-video-id]').count()>0);
// Simulated write failure: retain inputs and show failure, never a success message.
const failed=await browser.newContext();const failPage=await failed.newPage();
await failPage.goto(`${baseURL}/`);await failPage.locator('.practice-form').waitFor();
await failPage.evaluate(()=>{IDBObjectStore.prototype.put=function(){throw new DOMException('Synthetic disk full','QuotaExceededError');};});
await failPage.locator('[name=minutes]').fill('9');await failPage.locator('[name=outcome]').selectOption('slow');await failPage.locator('.practice-form [type=submit]').click();
await failPage.locator('.form-error:not([hidden])').waitFor();assert.equal(await failPage.locator('[name=minutes]').inputValue(),'9');assert.equal(await failPage.locator('.resume-card').count(),0);
await failPage.reload();await failPage.locator('.practice-form').waitFor();assert.equal(await failPage.locator('.resume-card').count(),0);
// Video-card sources have task text and direct card timestamp links.
await fp.goto(`${baseURL}/#catalog?q=P119`);await fp.locator('[data-lesson]').click();
await fp.locator('#lesson-dialog[open]').waitFor();assert.match(await fp.locator('#dialog-content .assignment-section').innerText(),/固定 50 BPM，不加速/);
await fp.locator('#dialog-content .evidence-details summary').click();assert.equal(await fp.getByRole('link',{name:'查看末页任务卡 ↗'}).count(),1);
await fp.keyboard.press('Escape');
await page.goto(`${baseURL}/#practice`);await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.exercise-row').first().waitFor();assert.equal(await page.locator('.lesson-detail > h2').evaluate(e=>getComputedStyle(e).animationName),'none');
assert.deepEqual(errors,[]);console.log('PASS: drafts, actual save/reload, edit/delete/restore, idempotent backup, future rejection, two-tab conflict, cross-stage resume, mobile save, fresh restore, storage unavailable/write failure, video-card source, reduced motion; no page errors.');await browser.close();
