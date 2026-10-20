// Isolated storage and clearly synthetic notation; no personal records/media.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
const base=process.env.EGUITAR_QA_URL || 'http://localhost:5173';
const synthetic=Buffer.from(`<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>Synthetic acceptance fixture</work-title></work><part-list><score-part id="P1"><part-name>Synthetic guitar</part-name><score-instrument id="I1"><instrument-name>Guitar</instrument-name></score-instrument><midi-instrument id="I1"><midi-channel>1</midi-channel><midi-program>25</midi-program></midi-instrument></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><direction><sound tempo="60"/></direction>${['E','F','G','A'].map(step=>`<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>`).join('')}</measure></part></score-partwise>`);
const state=page=>page.evaluate(async()=>{const m=await import('/practice-store.js');return m.readDraft(await m.openPracticeDB());});
try {
 for(const width of [1440,768,390]) {
  const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<761});
  await context.route('**/local-scores/index.json',r=>r.fulfill({contentType:'application/json',body:'{"items":[]}'}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('[data-start]:enabled').click();await page.waitForTimeout(1200);
  const hash=await page.evaluate(()=>location.hash), start=(await state(page)).elapsedMs;
  await page.locator('[data-position-reference]').click();
  await page.locator('#position-dialog').waitFor();
  assert.equal(await page.locator('dialog:modal').count(),0);
  assert.equal(await page.locator('#focus-clock').isVisible(),false);
  assert.ok(await page.locator('#floating-timer').isVisible());
  assert.equal((await state(page)).running,true);
  await page.locator('[data-position="4"]').click();await page.waitForTimeout(1300);
  await page.waitForFunction(async start => {
    const m=await import('/practice-store.js'), s=await m.readDraft(await m.openPracticeDB());
    return s.elapsedMs>=start+1000;
  }, start, {timeout:5000}).catch(async error => {console.log('Timing failure',start,await state(page),await page.evaluate(()=>({hidden:document.hidden,focus:document.hasFocus()})),errors);throw error;});
  assert.equal(await page.evaluate(()=>location.hash),hash);
  // Dragging moves the clock without activating its return action.
  let box=await page.locator('#floating-timer').boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(30+box.width/2,Math.min(600,box.y+150),{steps:10});await page.mouse.up();
  assert.ok(await page.locator('#position-dialog').isVisible());
  const moved=await page.locator('#floating-timer').boundingBox();assert.ok(Math.abs(moved.x-box.x)>20 || Math.abs(moved.y-box.y)>20);
  if (width<761) {
    const cdp=await context.newCDPSession(page), b=await page.locator('#floating-timer').boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width/2+30,y:b.y+b.height/2+30}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok(await page.locator('#position-dialog').isVisible());await cdp.detach();
  }
  await page.locator('#floating-timer').click();await page.locator('#focus-clock').waitFor();
  assert.equal(await page.locator('#floating-timer').isVisible(),false);
  assert.equal((await state(page)).running,true);
  await page.locator('[data-score]').click();await page.locator('#score-file:enabled').waitFor();
  assert.equal(await page.locator('dialog:modal').count(),0);
  await page.locator('#score-file').setInputFiles({name:'synthetic.musicxml',mimeType:'application/vnd.recordare.musicxml+xml',buffer:synthetic});
  await page.waitForFunction(()=>!document.querySelector('#score-play').disabled).catch(async error=>{console.log('Score failure',await page.locator('#score-status').innerText(),errors);await page.screenshot({path:'/tmp/eguitar-focus-stage-failure.png'});throw error;});
  assert.ok(await page.locator('#score-render svg').count()>0);
  const scoreStart=(await state(page)).elapsedMs;await page.waitForTimeout(1300);
  assert.ok((await state(page)).elapsedMs>scoreStart);
  await page.locator('#score-play').click();
  await page.waitForFunction(()=>document.querySelector('#score-play').textContent==='暂停');
  await page.screenshot({path:`/tmp/eguitar-focus-score-${width}.png`});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  // The score's reference control switches the same central stage.
  await page.locator('#score-position').click();await page.locator('#position-dialog').waitFor();
  assert.equal(await page.locator('#score-dialog').count(),0);
  assert.equal((await state(page)).running,true);
  await page.screenshot({path:`/tmp/eguitar-focus-position-${width}.png`});
  await page.keyboard.press('Escape');await page.locator('#focus-clock').waitFor();
  await page.locator('[data-action=metronome]').click();
  assert.ok(await page.locator('#focus-tool-content #metro-panel').isVisible());
  await page.locator('[data-action=metro-toggle]').click();await page.waitForTimeout(1100);
  assert.equal((await state(page)).running,true);
  await page.locator('[data-material]').click();assert.equal(await page.locator('#material-select').count(),0);
  assert.ok(await page.locator('#focus-tool-content a[data-watch]').count()>=2);
  assert.equal(await page.locator('dialog:modal').count(),0);
  // Pause remains explicit; opening tools must not resume a deliberate pause.
  await page.locator('[data-action=pause]').click();const paused=(await state(page)).elapsedMs;
  await page.locator('[data-position-reference]').click();await page.waitForTimeout(1100);
  assert.equal((await state(page)).elapsedMs,paused);assert.equal((await state(page)).running,false);
  assert.equal(await page.locator('[data-floating-state]').innerText(),'已暂停');
  await page.locator('[data-action=pause]').click();await page.locator('[data-tuner]').first().click();
  await page.locator('#focus-tool-content #tuner-dialog').waitFor();
  assert.equal((await state(page)).running,false);assert.equal(await page.locator('dialog:modal').count(),0);
  await page.locator('#tuner-close').click();await page.locator('#focus-clock').waitFor();
  assert.equal((await state(page)).running,false);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('[data-position-reference]').click();
  assert.equal(await page.locator('.tool-melt').count(),0);
  await page.locator('#floating-timer').focus();box=await page.locator('#floating-timer').boundingBox();
  await page.keyboard.press('ArrowDown');const keyboard=await page.locator('#floating-timer').boundingBox();assert.ok(keyboard.y>box.y);
  await page.setViewportSize({width:320,height:600});
  box=await page.locator('#floating-timer').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=320&&box.y+box.height<=600);
  await page.keyboard.press('Enter');await page.locator('#focus-clock').waitFor();
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Focus stage acceptance passed at 1440/768/390px: inline score rendering/playback, reference/metronome/materials, continuous timing, explicit pause, tuner exclusion, floating drag/click/keyboard/bounds, same route, Escape and reduced motion.');
} finally {await browser.close();}
