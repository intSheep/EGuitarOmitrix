// One practice surface; tools never change the session or route.
let cleanup = () => {}, activeTool = null, activeTrigger = null, controller;
let floatingPosition = null, animations = [];
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function clearMotion() {
  animations.forEach(a => a.cancel()); animations = [];
  document.querySelectorAll('.tool-melt').forEach(node => node.remove());
}
function melt(from, to, clock = false) {
  if (!from || !to || reducedMotion()) return;
  const ghost = document.createElement('div');
  ghost.className = `tool-melt${clock ? ' clock-melt' : ''}`;
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, { left:`${from.left}px`, top:`${from.top}px`, width:`${from.width}px`, height:`${from.height}px` });
  document.body.append(ghost);
  const dx = to.left - from.left, dy = to.top - from.top;
  const animation = ghost.animate([
    { transform:'translate(0, 0) scale(1)', borderRadius:clock?'50%':'18px', opacity:.55, filter:'blur(0px)' },
    { offset:.46, transform:`translate(${dx*.58}px, ${dy*.58}px) scale(${1+(to.width/from.width-1)*.6}, ${1+(to.height/from.height-1)*.6})`, borderRadius:'42% 58% 68% 32% / 58% 36% 64% 42%', opacity:.28, filter:'blur(6px)' },
    { transform:`translate(${dx}px, ${dy}px) scale(${to.width/from.width}, ${to.height/from.height})`, borderRadius:clock?'22px':'24px', opacity:0, filter:'blur(0px)' },
  ], { duration:650, easing:'cubic-bezier(.22,.8,.2,1)', fill:'forwards' });
  animations.push(animation);
  animation.finished.then(() => ghost.remove(), () => ghost.remove());
}
function clampFloating() {
  const button = document.querySelector('#floating-timer');
  if (!button || button.hidden) return;
  const width = button.offsetWidth, height = button.offsetHeight;
  const position = floatingPosition || { x:innerWidth-width-24, y:innerWidth<761?82:20 };
  floatingPosition = {x:Math.max(8,Math.min(innerWidth-width-8,position.x)), y:Math.max(8,Math.min(innerHeight-height-8,position.y))};
  button.style.left = `${floatingPosition.x}px`; button.style.top = `${floatingPosition.y}px`;
}
export function returnToClock({focus = true} = {}) {
  const clock = document.querySelector('#focus-clock'), host = document.querySelector('#focus-tool-content');
  if (!clock || !host || !activeTool) return;
  const floating = document.querySelector('#floating-timer'), from = floating.getBoundingClientRect();
  clearMotion(); cleanup(); cleanup = () => {};
  host.replaceChildren(); host.hidden = true; clock.hidden = false;
  document.querySelector('#focus-requirements').hidden = false;
  document.querySelector('.focus-page').classList.remove('has-focus-tool');
  const trigger = activeTrigger;
  document.querySelectorAll('.focus-tool').forEach(button => button.setAttribute('aria-pressed','false'));
  activeTool = null; activeTrigger = null;
  floating.hidden = true;
  melt(from, document.querySelector('.timer-orbit').getBoundingClientRect(), true);
  if (focus && trigger?.isConnected) trigger.focus({preventScroll:true});
}
export function openPracticeTool(kind, trigger, render, dispose = () => {}) {
  const host = document.querySelector('#focus-tool-content'), clock = document.querySelector('#focus-clock');
  if (!host || !clock) return false;
  if (kind === activeTool) { returnToClock(); return true; }
  const from = trigger.getBoundingClientRect(), wasClock = !activeTool;
  const clockRect = document.querySelector('.timer-orbit').getBoundingClientRect();
  clearMotion(); cleanup();
  host.replaceChildren(); clock.hidden = true; host.hidden = false;
  host.setAttribute('aria-label', trigger.textContent.trim());
  document.querySelector('#focus-requirements').hidden = true;
  document.querySelector('.focus-page').classList.add('has-focus-tool');
  activeTool = kind; activeTrigger = trigger; cleanup = dispose;
  document.querySelectorAll('.focus-tool').forEach(button => button.setAttribute('aria-pressed',String(button === trigger)));
  const floating = document.querySelector('#floating-timer'); floating.hidden = false; clampFloating();
  render(host);
  melt(from, host.getBoundingClientRect());
  if (wasClock) melt(clockRect, floating.getBoundingClientRect(), true);
  if (!reducedMotion()) {
    animations.push(host.animate([
      {opacity:0,transform:'translateY(12px)',filter:'blur(5px)'},
      {opacity:1,transform:'translateY(0)',filter:'blur(0px)'},
    ], {duration:480,easing:'cubic-bezier(.22,.8,.2,1)'}));
  }
  host.focus({preventScroll:true});
  return true;
}
export function unmountFocusStage() {
  controller?.abort(); controller = null;
  cleanup(); cleanup = () => {}; activeTool = activeTrigger = null; floatingPosition = null; clearMotion();
}
export function mountFocusStage() {
  const floating = document.querySelector('#floating-timer');
  if (!floating) return;
  controller = new AbortController();
  const options = {signal:controller.signal};
  let drag = null, moved = false;
  floating.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const rect = floating.getBoundingClientRect(); moved = false;
    drag = {id:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top};
    floating.setPointerCapture(e.pointerId);
  }, options);
  floating.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if (!moved && Math.hypot(dx,dy)<6) return;
    moved=true; floatingPosition={x:drag.left+dx,y:drag.top+dy}; clampFloating();
  }, options);
  const endDrag = () => { drag = null; };
  floating.addEventListener('pointerup', endDrag, options);
  floating.addEventListener('pointercancel', () => {drag=null;moved=false;}, options);
  floating.addEventListener('lostpointercapture', endDrag, options);
  floating.addEventListener('click', e => {
    if (moved && e.detail !== 0) { moved=false; e.preventDefault(); return; }
    returnToClock();
  }, options);
  floating.addEventListener('keydown', e => {
    const move={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];
    if (!move) return;
    e.preventDefault(); const rect=floating.getBoundingClientRect();
    floatingPosition={x:rect.left+move[0],y:rect.top+move[1]};clampFloating();
  }, options);
  window.addEventListener('resize', clampFloating, options);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && activeTool && !document.querySelector('dialog:modal')) { e.preventDefault(); returnToClock(); }
  }, options);
}
