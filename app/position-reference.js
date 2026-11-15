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
const inlayFrets = new Set([3, 5, 7, 9, 12, 15]);
export function positionNotes(index) {
  return POSITIONS[index].flatMap((frets,s) => frets.map(fret => {
    const pitch = (tuning[s] + fret) % 12;
    return { string:s+1, fret, name:names[pitch], degree:degrees[pitch], root:pitch===0 };
  }));
}
let panel, selected = 0, noteNames = false;
export function closePositionReference() { if (panel?.open) panel.close(); }
/** @param {{host?: HTMLElement | null, onClose?: (() => void) | null}} [options] */
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
    const width = 680, count = max - min + 1, step = 520 / count;
    panel.innerHTML = `<header class="position-heading"><h2 id="position-title">C 调把位速查</h2><button class="button secondary" data-close>关闭</button></header>
      <div class="position-choices" role="group" aria-label="选择把位">${POSITIONS.map((_,i)=>`<button class="button secondary" data-position="${i}" aria-pressed="${i===selected}">${i+1} 把位</button>`).join('')}</div>
      <div class="position-meta"><strong>第 ${selected+1} 把位 · ${min}–${max} 品</strong><button class="button secondary" data-label aria-pressed="${noteNames}">${noteNames?'显示唱名':'显示音名'}</button></div>
      <svg viewBox="0 0 ${width} 310" role="img" aria-labelledby="fretboard-title fretboard-desc"><title id="fretboard-title">C 调第 ${selected+1} 把位，${min} 到 ${max} 品</title><desc id="fretboard-desc">从上到下为第一到第六弦。${notes.map(n=>`${n.string}弦${n.fret}品${n.name}`).join('，')}。蓝色方块为主音 C。</desc>
      <rect x="108" y="48" width="544" height="236" rx="16" fill="#fcfdff" stroke="#1e293b" stroke-width="2.5"/>
      ${Array.from({length:count},(_,i)=>{const f=min+i,cx=120+(i+.5)*step,mark=inlayFrets.has(f);return `<g><rect x="${cx-26}" y="10" width="52" height="24" rx="8" fill="${mark?'#eef2ff':'#f4f6fa'}" stroke="${mark?'#c7d2fe':'#e2e6ef'}" stroke-width="1.5"/><text x="${cx}" y="27" text-anchor="middle" font-size="13" font-weight="800" fill="${mark?'#3f5cf0':'#475569'}">${f} 品</text>${mark?(f===12?`<circle cx="${cx}" cy="126" r="7.5" fill="#eef2ff" stroke="#cbd5e1" stroke-width="1.5"/><circle cx="${cx}" cy="206" r="7.5" fill="#eef2ff" stroke="#cbd5e1" stroke-width="1.5"/>`:`<circle cx="${cx}" cy="166" r="8.5" fill="#eef2ff" stroke="#cbd5e1" stroke-width="1.5"/>`):''}</g>`;}).join('')}
      ${Array.from({length:count+1},(_,i)=>`<line x1="${120+i*step}" y1="49" x2="${120+i*step}" y2="283" stroke="${i===0?'#94a3b8':'#cbd5e1'}" stroke-width="${i===0?3.5:2}"/>`).join('')}
      ${tuning.map((_,s)=>{const y=70+s*38;return `<g><rect x="18" y="${y-13}" width="72" height="26" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/><text x="54" y="${y+5}" text-anchor="middle" font-size="13" font-weight="800" fill="#171717" class="string-label">${s+1} 弦</text><line x1="109" y1="${y}" x2="651" y2="${y}" stroke="#64748b" stroke-width="${1.3+s*.4}"/></g>`;}).join('')}
      ${notes.map(n=>{const x=120+(n.fret-min+.5)*step,y=70+(n.string-1)*38;return `<g>${n.root?`<rect x="${x-16}" y="${y-13}" width="32" height="30" rx="9" fill="#2338a8"/><rect x="${x-16}" y="${y-16}" width="32" height="30" rx="9" fill="#3f5cf0" stroke="#ffffff" stroke-width="2"/>`:`<circle cx="${x}" cy="${y+3}" r="15" fill="#0f172a"/><circle cx="${x}" cy="${y}" r="15" fill="#181c26" stroke="#ffffff" stroke-width="2"/>`}<text x="${x}" y="${y+5}" fill="white" font-size="13.5" font-weight="800" text-anchor="middle">${noteNames?n.name:n.degree}</text></g>`}).join('')}</svg>
      <div class="position-legend"><span><i></i>主音 C · 1</span><span>标准调弦 E A D G B E</span></div>`;
    panel.querySelector('[data-close]').onclick=onClose || (()=>panel.close());
    panel.querySelector('[data-close]').hidden = !!host;
    panel.querySelectorAll('[data-position]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.position);render();panel.querySelector(`[data-position="${selected}"]`).focus()});
    panel.querySelector('[data-label]').onclick=()=>{noteNames=!noteNames;render();panel.querySelector('[data-label]').focus()};
  }
  render();
  if (!panel.open) { if (host) panel.show(); else panel.showModal(); }
}
