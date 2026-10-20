// Standard-tuning C-major reference; not a prescribed lesson sequence.
export const POSITIONS = [
  [[3,5],[3,5],[2,4,5],[2,3,5],[2,3,5],[3,5]],
  [[5,7,8],[5,6,8],[4,5,7],[5,7],[5,7,8],[5,7,8]],
  [[7,8,10],[8,10],[7,9,10],[7,9,10],[7,8,10],[7,8,10]],
  [[10,12,13],[10,12,13],[9,10,12],[9,10,12],[10,12],[10,12,13]],
  [[12,13,15],[12,13,15],[12,14],[12,14,15],[12,14,15],[12,13,15]],
];
const tuning = [64,59,55,50,45,40];
const names = ['C','','D','','E','F','','G','','A','','B'];
const degrees = ['1','','2','','3','4','','5','','6','','7'];
export function positionNotes(index) {
  return POSITIONS[index].flatMap((frets,s) => frets.map(fret => {
    const pitch = (tuning[s] + fret) % 12;
    return { string:s+1, fret, name:names[pitch], degree:degrees[pitch], root:pitch===0 };
  }));
}
let panel, selected = 0, noteNames = false;
export function closePositionReference() { if (panel?.open) panel.close(); }
export function showPositionReference({ host = null, onClose = null } = {}) {
  if (!panel) {
    panel = document.createElement('dialog');
    panel.id = 'position-dialog';
    panel.setAttribute('aria-labelledby','position-title');
    document.body.append(panel);
  }
  (host || document.body).append(panel);
  panel.classList.toggle('in-practice', !!host);
  panel.setAttribute('role', host ? 'region' : 'dialog');
  function render() {
    const notes = positionNotes(selected);
    const min = Math.min(...notes.map(n=>n.fret)), max = Math.max(...notes.map(n=>n.fret));
    const width = 640, step = 500/(max-min+1);
    panel.innerHTML = `<header class="position-heading"><h2 id="position-title">C 调把位速查</h2><button class="button secondary" data-close>关闭</button></header>
      <div class="position-choices" role="group" aria-label="选择把位">${POSITIONS.map((_,i)=>`<button class="button secondary" data-position="${i}" aria-pressed="${i===selected}">${i+1} 把位</button>`).join('')}</div>
      <div class="position-meta"><strong>${min}–${max} 品</strong><button class="button secondary" data-label aria-pressed="${noteNames}">${noteNames?'显示唱名':'显示音名'}</button></div>
      <svg viewBox="0 0 ${width} 330" role="img" aria-labelledby="fretboard-title fretboard-desc"><title id="fretboard-title">C 调第 ${selected+1} 把位，${min} 到 ${max} 品</title><desc id="fretboard-desc">从上到下为第一到第六弦。${notes.map(n=>`${n.string}弦${n.fret}品${n.name}`).join('，')}。蓝色方块为主音 C。</desc>
      ${Array.from({length:max-min+2},(_,i)=>`<line x1="${100+i*step}" y1="55" x2="${100+i*step}" y2="280" stroke="#d6d9e2" stroke-width="2"/>`).join('')}
      ${tuning.map((_,s)=>`<text x="8" y="${76+s*40}" class="string-label">${s+1} 弦</text><line x1="100" y1="${70+s*40}" x2="600" y2="${70+s*40}" stroke="#969eae" stroke-width="${1+s*.35}"/>`).join('')}
      ${Array.from({length:max-min+1},(_,i)=>`<text x="${100+(i+.5)*step}" y="32" text-anchor="middle">${min+i} 品</text>`).join('')}
      ${notes.map(n=>{const x=100+(n.fret-min+.5)*step,y=70+(n.string-1)*40;return `<g>${n.root?`<rect x="${x-16}" y="${y-16}" width="32" height="32" rx="8" fill="#3f5cf0"/>`:`<circle cx="${x}" cy="${y}" r="16" fill="#17203a"/>`}<text x="${x}" y="${y+6}" fill="white" text-anchor="middle">${noteNames?n.name:n.degree}</text></g>`}).join('')}</svg>
      <div class="position-legend"><span><i></i>主音 C · 1</span><span>标准调弦 E A D G B E</span></div>`;
    panel.querySelector('[data-close]').onclick=onClose || (()=>panel.close());
    if (host) panel.querySelector('[data-close]').textContent = '返回计时';
    panel.querySelectorAll('[data-position]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.position);render();panel.querySelector(`[data-position="${selected}"]`).focus()});
    panel.querySelector('[data-label]').onclick=()=>{noteNames=!noteNames;render();panel.querySelector('[data-label]').focus()};
  }
  render();
  if (!panel.open) { if (host) panel.show(); else panel.showModal(); }
}
