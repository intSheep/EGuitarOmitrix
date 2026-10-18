import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
try {
  for (const width of [1440,768,390]) {
    const context = await browser.newContext({viewport:{width,height:960}});
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.EGUITAR_QA_URL || 'http://localhost:5173');
    await page.locator('[data-start]').click();
    await page.locator('#timer-value').waitFor();
    const before = await page.locator('#timer-value').innerText();
    await page.locator('[data-position-reference]').click();
    await page.locator('#position-dialog').waitFor();
    for(let i=0;i<5;i++) {
      await page.locator(`[data-position="${i}"]`).click();
      assert.equal(await page.locator(`[data-position="${i}"]`).getAttribute('aria-pressed'),'true');
      assert.match(await page.locator('#fretboard-title').textContent(),new RegExp(`第 ${i+1} 把位`));
    }
    await page.locator('[data-label]').click();
    assert.equal(await page.locator('[data-label]').innerText(),'显示唱名');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.locator('#position-dialog').evaluate(e=>e.scrollWidth>e.clientWidth),false);
    await page.screenshot({path:`/tmp/position-reference-panel-${width}.png`});
    await page.waitForTimeout(2200);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-position-reference]').evaluate(e=>e===document.activeElement),true);
    assert.notEqual(await page.locator('#timer-value').innerText(),before);
    await page.locator('[data-score]').click();
    await page.locator('#score-position').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#score-dialog').evaluate(e=>e.open),true);
    assert.equal(await page.locator('#score-position').evaluate(e=>e===document.activeElement),true);
    await page.screenshot({path:`/tmp/position-reference-${width}.png`});
    assert.deepEqual(errors,[]);
    await context.close();
  }
  console.log('Position reference: desktop/tablet/mobile, switching, labels, timer and nested-dialog focus passed.');
} finally { await browser.close(); }
