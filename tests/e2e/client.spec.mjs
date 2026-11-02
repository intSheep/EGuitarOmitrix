// Synthetic installed-client bridges; never reads an owner's profile or downloads an update.
import { test, expect } from '@playwright/test';
for (const viewport of [{width:1280,height:720},{width:800,height:600},{width:390,height:700},{width:390,height:560}]) {
  test(`client keeps navigation and primary actions visible at ${viewport.width}x${viewport.height}`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => { window.eguitarDesktop = {checkUpdates: async () => { window.updateChecks = (window.updateChecks || 0) + 1; }}; });
    const errors=[]; page.on('pageerror', e=>errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('[data-start]')).toBeEnabled();
    const within = async locator => {
      await expect(locator).toBeVisible();
      const b=await locator.boundingBox(); expect(b.y).toBeGreaterThanOrEqual(0); expect(b.y+b.height).toBeLessThanOrEqual(viewport.height+1);
    };
    await within(page.locator('#client-update'));
    await within(page.locator('[data-nav=history]'));
    if(viewport.width<=760) {
      await expect(page.locator('.lesson-detail')).toBeHidden();
      await page.locator('.exercise-select').first().click();
      await within(page.locator('.client-back'));
    }
    await within(page.locator('[data-start]'));
    await page.locator('.client-lesson-content').evaluate(e => e.scrollTop=e.scrollHeight);
    await within(page.locator('[data-start]'));
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
    await page.locator('#client-update').click();
    expect(await page.evaluate(()=>window.updateChecks)).toBe(1);
    await page.locator('.client-lesson-content').evaluate(e=>e.scrollTop=0);
    await page.screenshot({path:`test-results/workspace-${viewport.width}-${viewport.height}.png`});
    await page.locator('[data-start]').click();
    await within(page.locator('[data-action=finish]'));
    await within(page.locator('[data-score]'));
    await page.locator('[data-score]').click();
    await within(page.locator('[data-action=pause]'));
    await within(page.locator('[data-action=finish]'));
    await expect(page.locator('[data-floating-time]')).not.toHaveText('00:00');
    await page.locator('[data-action=finish]').click();
    await expect(page.locator('#finish-form')).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({path:`test-results/client-${viewport.width}-${viewport.height}.png`});
  });
}
test('Android back returns from detail without navigating out of the client', async ({page})=>{
  await page.setViewportSize({width:390,height:700});
  await page.addInitScript(()=>{window.Capacitor={getPlatform:()=> 'android',Plugins:{AppUpdate:{check:async()=>{}}}};});
  await page.goto('/'); await page.locator('.exercise-select').first().click();
  await expect(page.locator('.client-back')).toBeVisible();
  expect(await page.evaluate(()=>eguitarClientBack())).toBe(true);
  await expect(page.locator('.exercise-list')).toBeVisible();
  expect(await page.evaluate(()=>eguitarClientBack())).toBe(false);
});
for(const width of [1280,390]) {
  test(`client catalog filters and history management remain reachable at ${width}px`, async ({page})=>{
    await page.setViewportSize({width,height:600});
    await page.addInitScript(()=>{window.eguitarDesktop={checkUpdates:async()=>{}};});
    await page.goto('/#catalog');
    const search=page.locator('.library-search'); await expect(search).toBeVisible();
    const before=await search.boundingBox();
    await page.locator('.course-directory').evaluate(el=>el.scrollTop=el.scrollHeight);
    expect((await search.boundingBox()).y).toBe(before.y);
    expect(await page.locator('#app').evaluate(el=>el.scrollTop)).toBe(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('[data-nav=history]').click();
    const manage=page.locator('[data-action=manage]');await expect(manage).toBeVisible();
    await page.locator('#app').evaluate(el=>el.scrollTop=el.scrollHeight);
    const rect=await manage.boundingBox();expect(rect.y).toBeGreaterThanOrEqual(0);expect(rect.y+rect.height).toBeLessThanOrEqual(600);
  });
}

test('compact catalog lesson links open detail directly and Back returns to the list', async ({page})=>{
  await page.setViewportSize({width:390,height:700});
  await page.addInitScript(()=>{window.eguitarDesktop={checkUpdates:async()=>{}};});
  await page.goto('/#catalog');
  await page.locator('a.directory-action').first().click();
  await expect(page.locator('.lesson-detail')).toBeVisible();
  await expect(page.locator('[data-start]')).toBeVisible();
  expect(await page.evaluate(()=>eguitarClientBack())).toBe(true);
  await expect(page.locator('.exercise-list')).toBeVisible();
});
