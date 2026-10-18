// Original, unbranded electric-guitar illustration for the tuning aid.
// Six strings run from the nut to the bridge; numbers match standard tuning.
export function tunerGuitar() {
  const pegs = Array.from({ length: 6 }, (_, i) => {
    const y = 36 + i * 12, x = 98 - i * 3;
    return `<g class="guitar-peg"><path d="M${x - 14} ${y - 1}h13"/><rect x="${x - 23}" y="${y - 6}" width="10" height="10" rx="4"/><circle cx="${x}" cy="${y}" r="3.5"/></g>`;
  }).join('');
  const frets = Array.from({ length: 21 }, (_, i) => {
    const y = 111 + 287 * (1 - 2 ** (-(i + 1) / 12));
    return `<path d="M81 ${y}h34" class="guitar-fret"/>`;
  }).join('');
  const dots = [3, 5, 7, 9, 12, 15, 17, 19, 21].map(fret => {
    const y = 111 + 287 * (1 - 2 ** (-(fret - 0.5) / 12));
    return fret === 12 ? `<circle cx="88" cy="${y}" r="2.3"/><circle cx="108" cy="${y}" r="2.3"/>` : `<circle cx="98" cy="${y}" r="2.3"/>`;
  }).join('');
  const strings = Array.from({ length: 6 }, (_, i) => {
    const x = 85 + i * 5;
    return `<path data-guitar-string="${6 - i}" d="M${83 + i * 3} ${96 - i * 12} L${x} 111 V357" stroke-width="${1.4 - i * 0.13}"/>`;
  }).join('');
  return `<svg class="tuner-guitar" viewBox="0 0 210 420" role="img" aria-labelledby="tuner-guitar-title"><title id="tuner-guitar-title">电吉他 · 标准六弦调音</title>
    <ellipse cx="100" cy="404" rx="59" ry="6" fill="#eef0f6"/>
    <path class="guitar-body" d="M83 253 C78 237 76 210 66 210 C49 211 54 254 39 276 C15 307 18 351 41 376 C65 402 133 400 157 377 C184 351 181 311 161 284 C145 263 145 231 133 226 C117 219 129 258 114 265 L113 250Z"/>
    <path class="guitar-guard" d="M81 248 L112 254 C118 278 129 291 144 304 L130 361 L115 374 L72 358 C58 342 55 315 67 289Z"/>
    <rect class="guitar-neck" x="81" y="105" width="34" height="215" rx="2"/>
    <path class="guitar-head" d="M82 110 L80 86 C79 63 89 43 100 23 C107 9 125 13 123 29 C121 47 111 75 114 110Z"/>
    ${pegs}${frets}<g class="guitar-dots">${dots}</g>
    <path d="M81 111h34" class="guitar-nut"/>
    <g class="guitar-pickups"><rect x="77" y="312" width="42" height="8" rx="3"/><rect x="77" y="329" width="42" height="8" rx="3"/><rect x="77" y="344" width="42" height="8" rx="3" transform="rotate(-9 98 348)"/></g>
    <rect x="77" y="355" width="42" height="14" rx="3" class="guitar-bridge"/>
    <g class="guitar-strings">${strings}</g>
    <path d="m117 363 24 16 8-2" class="guitar-arm"/>
    <g class="guitar-knobs"><circle cx="137" cy="333" r="5"/><circle cx="145" cy="349" r="5"/><circle cx="151" cy="365" r="5"/></g>
    <path d="m137 308 8 10" class="guitar-switch"/>
    <rect x="52" y="362" width="12" height="20" rx="6" class="guitar-jack" transform="rotate(-25 58 372)"/>
  </svg>`;
}
