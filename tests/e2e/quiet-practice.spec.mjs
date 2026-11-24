// Synthetic navigation, media and storage fixtures. Never touches the owner's profile.
import {test,expect} from '@playwright/test';
import {syntheticScore} from '../fixtures/synthetic-score.mjs';
const draft=page=>page.evaluate(async()=>{const m=await import('./practice-store.js'),db=await m.openPracticeDB();const d=await m.readDraft(db);db.close();return d;});
async function begin(page,client=true) {
  if(client) await page.addInitScript(()=>{window.eguitarDesktop={checkUpdates:async()=>{}};});
  await page.goto('/#practice?view=lesson');await page.locator('[data-start]:enabled').click();
  await expect.poll(async()=>(await draft(page))?.elapsedMs||0).toBeGreaterThan(0);
}
for(const width of [1280,800,390]) {
  test(`quiet focus separates primary views and utilities with one contextual return at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:700});await begin(page);
    await expect(page.locator('.app-header')).toBeHidden();
    await expect(page.locator('#focus-back')).toBeHidden();
    await expect(page.getByRole('group',{name:'主视图'})).toBeVisible();
    await expect(page.getByRole('group',{name:'小工具'})).toBeVisible();
    await expect(page.locator('[data-action=finish]')).toHaveCount(1);
    await expect(page.locator('[data-action=pause]')).toHaveCount(1);
    await expect(page.locator('[data-start]')).toHaveCount(0);
    await page.locator('[data-position-reference]').click();
    await expect(page.locator('#position-dialog')).toBeVisible();
    await page.locator('[data-score]').click();
    await expect(page.locator('#position-dialog')).toBeVisible();
    await expect(page.locator('#score-dialog')).toBeVisible();
    await page.locator('[data-position-reference]').click();
    await expect(page.locator('#position-dialog')).toBeHidden();
    await expect(page.locator('#focus-back')).toBeVisible();
    await expect(page.getByRole('button',{name:'← 返回计时',exact:true})).toHaveCount(1);
    await expect(page.locator('#score-dialog [data-tuner]')).toHaveCount(0);
    await expect(page.locator('#score-position')).toHaveCount(0);
    await expect(page.locator('#score-close')).toBeHidden();
    await expect(page.locator('#score-stop')).toBeHidden();
    await page.locator('.score-options summary').click();
    await expect(page.locator('#score-stop')).toBeVisible();
    await expect(page.locator('#score-file')).toBeEnabled();
    await page.locator('#score-file').setInputFiles({name:'synthetic.musicxml',mimeType:'application/xml',buffer:Buffer.from(syntheticScore)});
    await expect(page.locator('#score-play')).toBeEnabled();
    await page.locator('.score-options summary').click();
    await expect(page.locator('#score-gp')).toBeVisible();
    if(width===1280) {
      const downloaded=page.waitForEvent('download');await page.locator('#score-gp').click();
      expect((await downloaded).suggestedFilename()).toBe('practice.gp');
    }
    await page.screenshot({path:`test-results/quiet-score-${width}.png`});
    for(const selector of ['#focus-back','[data-action=finish]','[data-action=pause]','[data-score]']) {
      const rect=await page.locator(selector).boundingBox();expect(rect.y).toBeGreaterThanOrEqual(0);expect(rect.y+rect.height).toBeLessThanOrEqual(701);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('#focus-back').click();await expect(page.locator('#focus-clock')).toBeVisible();
    expect((await draft(page)).running).toBe(true);
  });
}
test('manual run/pause survives tools, menu routes, visibility and native background signals',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await begin(page);
  const id=(await draft(page)).id;
  for(const selector of ['[data-score]','[data-action=pitch-toggle]','[data-action=split-view]','[data-position-reference]','[data-tuner]']) {
    await page.locator(selector).click();
    expect((await draft(page)).running).toBe(true);
    await expect(page.locator('#focus-back')).toBeVisible();
    await page.locator('#focus-back').click();
    await expect(page.locator('#focus-clock')).toBeVisible();
  }
  await page.locator('[data-material]').click();
  await expect(page.locator('#record-dialog')).toBeVisible();
  expect((await draft(page)).running).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#record-dialog')).toHaveCount(0);
  await page.locator('[data-score]').click();
  expect(await page.evaluate(()=>eguitarClientBack())).toBe(true);
  await expect(page.locator('#focus-clock')).toBeVisible();
  const initial=(await draft(page)).elapsedMs;
  await page.evaluate(async()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));await eguitarPauseForBackground();});
  await expect.poll(async()=>(await draft(page)).elapsedMs).toBeGreaterThan(initial);
  expect((await draft(page)).running).toBe(true);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  for(const name of ['课程目录','练习回顾','练习台']) {
    await page.locator('[data-action=practice-menu]').click();
    await page.locator('.practice-menu').getByRole('link',{name,exact:true}).click();
    if(name!=='练习台') {
      await expect(page.locator('#session-access')).toBeVisible();
      await expect(page.locator('#session-access a')).toHaveText('返回计时');
    }
    expect((await draft(page)).running).toBe(true);expect((await draft(page)).id).toBe(id);
    await page.locator(name==='练习台'?'[data-start]':'#session-access a').click();
    await expect(page.locator('[data-action=pause]')).toHaveText('暂停练习');
  }
  await page.locator('[data-action=pause]').click();const paused=(await draft(page)).elapsedMs;
  await page.locator('[data-tuner]').click();await page.locator('#focus-back').click();
  await page.evaluate(async()=>{await eguitarPauseForBackground();window.dispatchEvent(new Event('focus'));});
  await page.waitForTimeout(1200);
  expect((await draft(page)).running).toBe(false);expect((await draft(page)).elapsedMs).toBe(paused);
  await page.locator('[data-action=pause]').click();await expect.poll(async()=>(await draft(page)).elapsedMs).toBeGreaterThan(paused);
  await page.evaluate(()=>{window.eguitarMinPracticeMs=1000;});
  await page.locator('[data-action=finish]').click();await expect(page.locator('#finish-form')).toBeVisible();
  await expect(page.locator('[data-action=discard-finish]')).toBeVisible();
  await page.locator('[data-action=resume-finish]').click();await expect(page.locator('[data-action=finish]')).toHaveCount(1);
  expect((await draft(page)).id).toBe(id);expect((await draft(page)).running).toBe(true);
  await page.locator('[data-action=finish]').click();await expect(page.locator('#finish-form')).toBeVisible();
  await page.locator('[data-action=discard-finish]').click();
  await expect(page.locator('#notice')).toContainText('已放弃本次练习');
  expect(await draft(page)).toBeNull();
  expect(errors).toEqual([]);
});
test('standalone metronome, cross-page persistence, non-destructive score tools, and timer return work together',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1280,height:720});
  await page.addInitScript(()=>{window.eguitarDesktop={checkUpdates:async()=>{}};});
  await page.goto('/#practice?stage=1&lesson=36374776025&view=lesson');
  await expect(page.locator('[data-start]:enabled')).toBeVisible();

  // 1. Standalone metronome works without a session, survives live BPM changes and route switches.
  await page.locator('[data-action=metronome]').click();
  await expect(page.locator('#metro-panel')).toBeVisible();
  await page.locator('[data-action=metro-toggle]').click();
  await expect(page.locator('[data-action=metro-toggle]')).toHaveText('停止节拍');
  await page.getByRole('button',{name:'加 5 BPM'}).click();
  await page.getByRole('button',{name:'加 1 BPM'}).click();
  await page.getByRole('button',{name:'减 1 BPM'}).click();
  await page.locator('#bpm').fill('88');
  await expect(page.locator('[data-action=metro-toggle]')).toHaveText('停止节拍');
  expect(await draft(page)).toBeNull();

  await page.locator('[data-nav=catalog]').click();
  await expect(page.locator('#global-metro-bar')).toContainText('88 BPM');
  await page.locator('[data-nav=history]').click();
  await expect(page.locator('#global-metro-bar')).toContainText('88 BPM');
  await page.locator('[data-nav=practice]').click();
  await expect(page.locator('[data-action=metro-toggle]')).toHaveText('停止节拍');
  await expect(page.locator('#bpm')).toHaveValue('88');
  await page.locator('[data-action=metro-toggle]').click();
  await expect(page.locator('[data-action=metro-toggle]')).toHaveText('播放节拍');
  expect(await page.evaluate(async()=>{const m=await import('./practice-store.js'),db=await m.openPracticeDB();const logs=await m.allLogs(db);db.close();return logs.length;})).toBe(0);

  // Standalone 把位图 modal works on Workspace without creating a session.
  await page.locator('[data-position-reference]').click();
  await expect(page.locator('#position-dialog')).toBeVisible();
  await expect(page.locator('#position-title')).toHaveText('C 调把位图');
  await page.locator('#position-dialog [data-close]').click();
  await expect(page.locator('#position-dialog')).toBeHidden();

  // 2. Focus mode: score stays loaded across metronome, 把位图, materials, route switch, and tuner.
  await page.goto('/#practice?stage=1&lesson=36374776025&view=lesson');
  await page.locator('[data-start]:enabled').click();
  await expect(page.locator('#focus-clock')).toBeVisible();
  await page.locator('[data-score]').click();
  await page.locator('.score-options summary').click();
  await expect(page.locator('#score-file')).toBeEnabled();
  await page.locator('#score-file').setInputFiles({name:'synthetic.musicxml',mimeType:'application/xml',buffer:Buffer.from(syntheticScore)});
  await expect(page.locator('#score-play')).toBeEnabled();
  await page.locator('.score-options summary').click();

  await page.locator('[data-action=metro-toggle]').click();
  await expect(page.locator('[data-action=metro-toggle]')).toHaveText('停止节拍');
  await page.getByRole('button',{name:'加 5 BPM'}).click();
  await expect(page.locator('[data-action=metronome][data-playing="true"]')).toBeVisible();
  await expect(page.locator('#score-play')).toBeEnabled();

  await page.locator('[data-position-reference]').click();
  await expect(page.locator('#position-dialog')).toBeVisible();
  await expect(page.locator('#score-play')).toBeEnabled();
  await page.locator('#position-dialog [data-close]').click();
  await expect(page.locator('#position-dialog')).toBeHidden();
  await expect(page.locator('#score-play')).toBeEnabled();

  await page.locator('[data-material]').click();
  await expect(page.locator('#record-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#score-play')).toBeEnabled();

  // Metronome survives route switches and hidden page visibility.
  await page.locator('[data-action=practice-menu]').click();
  await page.locator('.practice-menu').getByRole('link',{name:'课程目录',exact:true}).click();
  await expect(page.locator('#global-metro-bar')).toBeVisible();
  await expect(page.locator('#session-access a')).toHaveText('返回计时');
  await page.locator('#session-access a').click();
  await expect(page.locator('[data-action=metronome][data-playing="true"]')).toBeVisible();
  await page.evaluate(async()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));await eguitarPauseForBackground();});
  await expect(page.locator('[data-action=metronome][data-playing="true"]')).toBeVisible();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});

  // Return to timer works via clickable bottom timer pill and primary 计时 tab.
  await page.locator('[data-score]').click();
  await page.locator('.passive-clock-btn').click();
  await expect(page.locator('#focus-clock')).toBeVisible();
  await page.locator('[data-action=pitch-toggle]').click();
  await expect(page.locator('[data-pitch-stage="true"]')).toBeVisible();
  await page.locator('[data-view="timer"]').click();
  await expect(page.locator('#focus-clock')).toBeVisible();

  // Opening 调音器 from score stops metronome, and closing via #tuner-close keeps score loaded.
  await page.locator('[data-score]').click();
  await page.locator('.score-options summary').click();
  await expect(page.locator('#score-file')).toBeEnabled();
  await page.locator('#score-file').setInputFiles({name:'synthetic.musicxml',mimeType:'application/xml',buffer:Buffer.from(syntheticScore)});
  await expect(page.locator('#score-play')).toBeEnabled();
  await page.locator('[data-tuner]').click();
  await expect(page.locator('#tuner-dialog')).toBeVisible();
  await expect(page.locator('[data-action=metronome][data-playing="true"]')).toHaveCount(0);
  await page.locator('#tuner-close').click();
  await expect(page.locator('#tuner-dialog')).toBeHidden();
  await expect(page.locator('#score-play')).toBeEnabled();
  expect(errors).toEqual([]);
});
test('sessions under 1 minute exit without recording by default',async({page})=>{
  await begin(page);
  await page.locator('[data-action=finish]').click();
  await expect(page.locator('#notice')).toContainText('练习不足 1 分钟，本次未计入记录');
  expect(await draft(page)).toBeNull();
  expect(await page.evaluate(async()=>{const m=await import('./practice-store.js'),db=await m.openPracticeDB();const logs=await m.allLogs(db);db.close();return logs.length;})).toBe(0);
});
test('running practice does not create overlapping automatic viewing time',async({page,context})=>{
  await context.route('https://www.bilibili.com/**',r=>r.fulfill({contentType:'text/html',body:'Synthetic external lesson'}));
  await begin(page,false);await page.locator('[data-material]').click();
  const popup=context.waitForEvent('page');await page.locator('[data-watch]').first().click();
  const video=await popup;await video.waitForURL('https://www.bilibili.com/**');await page.bringToFront();
  expect((await draft(page)).running).toBe(true);
  expect(await page.evaluate(async()=>{const s=await import('./study-store.js'),m=await import('./practice-store.js'),db=await m.openPracticeDB();const study=await s.readStudy(db);db.close();return study.draft;})).toBeNull();
  await video.close();
});
