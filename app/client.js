// Installed-app interaction layer. Browser delivery keeps its existing layout.
const desktop = globalThis.eguitarDesktop;
const android = globalThis.Capacitor?.getPlatform() === 'android';
export const isClient = !!desktop || android;
let lastSelection = '', listScroll = 0;
export function syncClientView(route) {
  if (!isClient) return;
  document.documentElement.dataset.client = android ? 'android' : 'desktop';
  document.body.dataset.clientRoute = route || 'practice';
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  document.body.classList.toggle('client-detail', params.get('view') === 'lesson');
  const list = document.querySelector('.exercise-list ul');
  const selection = params.get('lesson') || '';
  if (selection !== lastSelection) { lastSelection = selection; listScroll = 0; }
  if (list) {
    list.scrollTop = listScroll;
    list.addEventListener('scroll', () => { listScroll = list.scrollTop; }, { passive: true });
    list.querySelectorAll('a').forEach(a => { a.hash += '&view=lesson'; });
  }
  // Stage selection opens the list on compact clients; selecting a lesson opens detail.
  document.querySelectorAll('.stage-pills a').forEach(a => { a.hash += '&view=list'; });
  const detail = document.querySelector('.lesson-detail');
  if (detail) {
    const back = document.createElement('button');
    back.className = 'button secondary client-back'; back.textContent = '返回课程列表';
    back.onclick = () => { const p = new URLSearchParams(params); p.set('view', 'list'); location.hash = 'practice?' + p; };
    const content = document.createElement('div'); content.className = 'client-lesson-content';
    const actions = document.createElement('div'); actions.className = 'client-lesson-actions';
    actions.append(detail.querySelector('.single-start'), detail.querySelector('[data-material]'));
    content.append(...detail.childNodes); detail.append(back, content, actions);
  }
  const focus = document.querySelector('.focus-page');
  if (focus) {
    const main = focus.querySelector('.focus-main');
    const scroll = document.createElement('div'); scroll.className = 'client-focus-content';
    const actions = main.querySelector('.focus-actions');
    scroll.append(...main.childNodes); main.append(scroll, actions);
  }
}
export function initClient() {
  if (!isClient) return;
  document.documentElement.dataset.client = android ? 'android' : 'desktop';
  const update = document.createElement('button');
  update.id = 'client-update'; update.className = 'button secondary'; update.textContent = '检查更新';
  update.onclick = async () => {
    if (update.disabled) return;
    update.disabled = true; update.textContent = '正在检查…';
    try {
      if (desktop) await desktop.checkUpdates();
      else await globalThis.Capacitor.Plugins.AppUpdate.check();
    } catch (e) {
      const notice = document.querySelector('#notice'); notice.textContent = e.message || '更新未完成，请重试'; notice.hidden = false;
    } finally { update.disabled = false; update.textContent = '检查更新'; }
  };
  document.querySelector('.app-header').append(update);
  // Called by Android's system back button before it backgrounds the task.
  globalThis.eguitarClientBack = () => {
    const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (dialog) { dialog.dispatchEvent(new Event('cancel', {cancelable:true})); if(dialog.open) dialog.close(); return true; }
    if (document.querySelector('.has-focus-tool')) { document.querySelector('#floating-timer')?.click(); return true; }
    const [route, query] = location.hash.slice(1).split('?');
    if (route === 'finish') return true; // Never discard unconfirmed results with Back.
    if (route === 'practice' && new URLSearchParams(query).get('view') === 'lesson') { document.querySelector('.client-back')?.click(); return true; }
    if (route && route !== 'practice') { location.hash = 'practice'; return true; }
    return false;
  };
}
