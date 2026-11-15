import {test,expect} from '@playwright/test';
for (const [width,height] of [[1440,900],[1280,720],[800,600],[390,560]]) {
 test(`complete fretboard and transport fit ${width}x${height}`,async({page})=>{
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>{window.eguitarDesktop={platform:'darwin',updatesSupported:false,checkUpdates:async()=>{}};});
  await page.goto('/#practice?view=lesson');
  await page.locator('[data-start]:enabled').click();
  await page.locator('[data-position-reference]').click();
  const board=page.locator('#position-dialog svg');
  await expect(board).toBeVisible();
  for(const selector of ['#position-dialog svg','.position-legend','[data-action=pause]','[data-action=finish]']) {
   const r=await page.locator(selector).boundingBox();expect(r.y).toBeGreaterThanOrEqual(0);expect(r.y+r.height).toBeLessThanOrEqual(height);expect(r.width).toBeGreaterThan(0);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('[data-position="4"]').click();await expect(board).toHaveAccessibleName(/第 5 把位/);
  await page.locator('[data-label]').click();await expect(page.locator('[data-label]')).toHaveText('显示唱名');
  await page.locator('[data-position="0"]').click();
  await page.screenshot({path:`test-results/mac-workbench-${width}.png`});
 });
}
