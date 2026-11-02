// One tool surface and one contextual return; session timing is owned by app.js.
let cleanup = () => {}, activeTool = null, activeTrigger = null, controller;
export function returnToClock({focus = true} = {}) {
  const clock=document.querySelector('#focus-clock'), host=document.querySelector('#focus-tool-content');
  if (!clock || !host || !activeTool) return;
  cleanup(); cleanup=()=>{};
  host.replaceChildren(); host.hidden=true; clock.hidden=false;
  document.querySelector('#focus-requirements').hidden=false;
  document.querySelector('.focus-page').classList.remove('has-focus-tool');
  document.querySelector('#focus-back').hidden=true;
  document.querySelectorAll('.focus-tool').forEach(b=>b.setAttribute('aria-pressed','false'));
  const trigger=activeTrigger; activeTool=activeTrigger=null;
  if(focus && trigger?.isConnected) trigger.focus({preventScroll:true});
}
export function openPracticeTool(kind, trigger, render, dispose=()=>{}) {
  const host=document.querySelector('#focus-tool-content'),clock=document.querySelector('#focus-clock');
  if(!host || !clock) return false;
  if(kind===activeTool) {returnToClock();return true;}
  cleanup(); host.replaceChildren();clock.hidden=true;host.hidden=false;
  host.setAttribute('aria-label',trigger.textContent.trim());
  document.querySelector('#focus-requirements').hidden=true;
  document.querySelector('.focus-page').classList.add('has-focus-tool');
  document.querySelector('#focus-back').hidden=false;
  activeTool=kind;activeTrigger=trigger;cleanup=dispose;
  document.querySelectorAll('.focus-tool').forEach(b=>b.setAttribute('aria-pressed',String(b===trigger)));
  render(host);host.focus({preventScroll:true});return true;
}
export function unmountFocusStage() {
  controller?.abort();controller=null;cleanup();cleanup=()=>{};activeTool=activeTrigger=null;
}
export function mountFocusStage() {
  controller=new AbortController();
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && activeTool && !document.querySelector('dialog:modal')) {e.preventDefault();returnToClock();}
  },{signal:controller.signal});
}
