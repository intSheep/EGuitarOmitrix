import {test,expect} from '@playwright/test';
const draft=page=>page.evaluate(async()=>{const m=await import('./practice-store.js'),db=await m.openPracticeDB();const d=await m.readDraft(db);db.close();return d;});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{window.eguitarMinPracticeMs=1000;});});
test('finish inputs survive reload, save once, and return to the quiet workspace',async({page})=>{
 await page.goto('/');await page.locator('[data-start]').click();await expect.poll(async()=>(await draft(page))?.elapsedMs||0).toBeGreaterThan(1000);
 await page.locator('[data-action=finish]').click();await page.locator('#stable-bpm').fill('65');await page.getByLabel('基本顺畅',{exact:true}).check();
 await expect.poll(async()=>(await draft(page))?.review?.bpm).toBe('65');
 await page.reload();await expect(page.locator('#stable-bpm')).toHaveValue('65');await expect(page.getByLabel('基本顺畅',{exact:true})).toBeChecked();
 await page.locator('#stable-bpm').fill('66');await page.locator('#finish-form button[type=submit]').click();
 await expect(page.locator('.saved-feedback')).toContainText('已保存');await expect(page.locator('.page-heading h1')).toHaveText('练习台');
 await page.locator('.saved-feedback a').click();await expect(page.locator('.completion')).toContainText('66 BPM');
 expect(await page.evaluate(async()=>{const m=await import('./practice-store.js'),db=await m.openPracticeDB();const records=await m.allLogs(db);db.close();return records.length;})).toBe(1);
});
test('save failure keeps inputs and draft, then retry commits exactly once',async({page})=>{
 await page.goto('/');await page.locator('[data-start]').click();await expect.poll(async()=>(await draft(page))?.elapsedMs||0).toBeGreaterThan(1000);
 await page.locator('[data-action=finish]').click();await page.locator('#stable-bpm').fill('70');
 await expect.poll(async()=>(await draft(page))?.review?.bpm).toBe('70');
 await page.evaluate(()=>{const original=IDBDatabase.prototype.transaction;window.restoreTransaction=()=>{IDBDatabase.prototype.transaction=original;};IDBDatabase.prototype.transaction=function(names,mode,...args){if(mode==='readwrite'&&Array.isArray(names)&&names.includes('logs'))throw Error('SYNTHETIC write failure');return original.call(this,names,mode,...args);};});
 await page.locator('#finish-form button[type=submit]').click();await expect(page.locator('#finish-error')).toContainText('SYNTHETIC write failure');await expect(page.locator('#stable-bpm')).toHaveValue('70');expect((await draft(page)).finishing).toBe(true);
 await page.evaluate(()=>window.restoreTransaction());await page.locator('#finish-form button[type=submit]').click();await expect(page.locator('.saved-feedback')).toBeVisible();
});
test('background cannot resurrect the draft during a save',async({page})=>{
 await page.goto('/');await page.locator('[data-start]').click();await expect.poll(async()=>(await draft(page))?.elapsedMs||0).toBeGreaterThan(1000);
 await page.locator('[data-action=finish]').click();
 // Repeated native background events while saving must never add an active draft
 // after the atomic log+draft transaction commits.
 await page.evaluate(()=>{window.backgroundBurst=setInterval(()=>window.eguitarPauseForBackground(),1);});
 await page.locator('#finish-form button[type=submit]').click();await expect(page.locator('.saved-feedback')).toBeVisible();
 await page.evaluate(()=>clearInterval(window.backgroundBurst));expect(await draft(page)).toBeNull();
});
test('a second window cannot overwrite the active session',async({page,context})=>{
 await page.goto('/');await page.locator('[data-start]').click();await expect.poll(async()=>(await draft(page))?.elapsedMs||0).toBeGreaterThan(0);const original=await draft(page);
 const second=await context.newPage();await second.goto('/');await second.locator('[data-start]').click();
 await expect(second.locator('#notice')).toContainText('另一标签页');expect((await draft(page)).id).toBe(original.id);expect((await draft(page)).running).toBe(true);await second.close();
});
