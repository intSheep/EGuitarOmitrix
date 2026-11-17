import { STRINGS, detectPitch, tuningReading, TunerTracker, microphoneErrorMessage } from '../frontend/domain/tuner-model.ts';

let panel, stream, audio, toneAudio, source, analyser, loop, generation = 0;
let samples, lastAnnouncement = '', ignoreInputUntil = 0;
let soundEnabled = true;
try { soundEnabled = localStorage.getItem('eguitar-tuner-sound') !== 'false'; } catch {}
const tracker = new TunerTracker({ holdMs: 3000 });
const $ = id => panel.querySelector(`#tuner-${id}`);

function getToneContext() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return null;
  if (!toneAudio || toneAudio.state === 'closed') toneAudio = new Audio();
  if (toneAudio.state === 'suspended') toneAudio.resume().catch(() => {});
  return toneAudio;
}

function speakPrompt(text) {
  if (!soundEnabled || typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 1.15;
    u.volume = 0.85;
    ignoreInputUntil = Math.max(ignoreInputUntil, Date.now() + 900);
    window.speechSynthesis.speak(u);
  } catch {}
}

function playCue(kind) {
  if (!soundEnabled) return;
  const ctx = audio?.state === 'running' ? audio : getToneContext();
  if (ctx) {
    try {
      const now = ctx.currentTime;
      const notes = kind === 'in-tune'
        ? [[523.25, 0, 0.14], [783.99, 0.11, 0.28]]
        : kind === 'flat'
          ? [[246.94, 0, 0.14], [293.66, 0.12, 0.24]]
          : [[392.00, 0, 0.14], [329.63, 0.12, 0.24]];
      for (const [freq, offset, duration] of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = kind === 'in-tune' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now + offset);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.12, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + duration + 0.02);
      }
      ignoreInputUntil = Math.max(ignoreInputUntil, Date.now() + 650);
    } catch {}
  }
  speakPrompt(kind === 'in-tune' ? '已调准' : kind === 'flat' ? '偏低，请拧紧' : '偏高，请放松');
}

function playReferenceNote(frequency) {
  const ctx = audio?.state === 'running' ? audio : getToneContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(frequency * 5, now);
    filter.frequency.exponentialRampToValueAtTime(frequency * 1.6, now + 1.1);
    filter.connect(ctx.destination);
    for (const [mult, amp] of [[1, 0.14], [2, 0.07], [3, 0.03]]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = mult === 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(frequency * mult, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
      osc.connect(gain);
      gain.connect(filter);
      osc.start(now);
      osc.stop(now + 1.2);
    }
    ignoreInputUntil = Math.max(ignoreInputUntil, Date.now() + 1250);
  } catch {}
}

function updateStringLockUI() {
  if (!panel) return;
  const locked = tracker.getLockedString();
  panel.querySelectorAll('[data-string-status]').forEach(item => {
    const s = Number(item.dataset.stringStatus);
    item.dataset.locked = String(s === locked);
    item.setAttribute('aria-pressed', String(s === locked));
  });
  const modeBtn = $('mode');
  if (modeBtn) {
    const sObj = STRINGS.find(x => x.string === locked);
    modeBtn.textContent = sObj ? `锁定 ${sObj.string} 弦 (${sObj.note}) · 点此恢复自动` : '自动识别六弦 · 点击弦号可听标准音';
    modeBtn.dataset.locked = String(locked !== null);
  }
}

function reading(value = null, { held = false, lockedInTune = false } = {}) {
  const resolved = typeof value === 'number' ? tuningReading(value, tracker.getLockedString()) : value;
  $('note').replaceChildren(document.createTextNode(resolved ? resolved.note.slice(0, -1) : '—'));
  if (resolved) { const octave = document.createElement('sub'); octave.textContent = resolved.note.slice(-1); $('note').append(octave); }
  panel.querySelectorAll('[data-string-status]').forEach(label => {
    label.dataset.detected = String(Number(label.dataset.stringStatus) === resolved?.target.string);
  });
  const locked = tracker.getLockedString();
  const lockedInfo = STRINGS.find(s => s.string === locked);
  $('target').textContent = resolved
    ? `${locked ? '锁定' : '接近'} ${resolved.target.string} 弦 · ${resolved.target.note}${held ? '（读数保持）' : ''}`
    : lockedInfo
      ? `已锁定 ${lockedInfo.string} 弦 · ${lockedInfo.note}，请拨弦`
      : '拨动一根空弦';
  panel.querySelectorAll('[data-guitar-string]').forEach(string => {
    string.dataset.active = String(Number(string.dataset.guitarString) === (resolved?.target.string ?? locked));
  });
  $('frequency').textContent = resolved ? `${resolved.frequency.toFixed(2)} Hz` : '— Hz';
  const cents = resolved ? Math.round(resolved.cents) : null;
  $('cents').textContent = resolved ? `${cents > 0 ? '+' : ''}${cents} 音分` : '— 音分';
  const direction = !resolved ? '等待声音' : resolved.direction === 'in-tune' ? '准确' : resolved.direction === 'flat' ? '偏低' : '偏高';
  $('adjustment').textContent = !resolved
    ? '开启后，逐根拨空弦即可（点击上方弦号可听参考音）'
    : resolved.direction === 'in-tune'
      ? (lockedInTune ? '这根弦已稳固调准 ✓' : '这根弦已调准')
      : resolved.direction === 'flat'
        ? `偏低 ${Math.abs(cents)} 音分 · 请稍微拧紧一点`
        : `偏高 ${Math.abs(cents)} 音分 · 请稍微放松一点`;
  $('direction').textContent = direction;
  $('readout').dataset.direction = resolved?.direction || '';
  $('readout').dataset.held = String(!!held);
  $('needle').style.visibility = resolved ? 'visible' : 'hidden';
  $('needle').style.left = `${50 + Math.max(-50, Math.min(50, resolved?.cents || 0))}%`;
  const announcement = resolved ? `${resolved.target.string} 弦 ${resolved.note}，${direction}，${$('adjustment').textContent}` : '';
  if (announcement !== lastAnnouncement) $('announcement').textContent = announcement;
  lastAnnouncement = announcement;
}

function release() {
  generation++;
  clearTimeout(loop);
  loop = null;
  try { window.speechSynthesis?.cancel(); } catch {}
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  source?.disconnect();
  source = analyser = null;
  audio?.close().catch(() => {});
  audio = null;
  toneAudio?.close().catch(() => {});
  toneAudio = null;
  tracker.reset();
}

function stop(message = '麦克风已停止') {
  release();
  if (!panel) return;
  $('start').disabled = false;
  $('start').hidden = false;
  $('stop').disabled = true;
  $('stop').hidden = true;
  panel.dataset.listening = 'false';
  $('device').disabled = false;
  $('level').value = 0;
  $('status').textContent = message;
  reading();
}

function failure(error) {
  return microphoneErrorMessage(error);
}

async function devices(token) {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const list = await navigator.mediaDevices.enumerateDevices();
  if (generation !== token || !panel.open) return;
  const current = stream?.getAudioTracks()[0]?.getSettings().deviceId || $('device').value;
  $('device').replaceChildren(new Option('系统默认输入', ''));
  list.filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default').forEach((d, i) => {
    $('device').add(new Option(d.label || `输入设备 ${i + 1}`, d.deviceId));
  });
  if ([...$('device').options].some(o => o.value === current)) $('device').value = current;
}

async function start() {
  const deviceId = $('device').value;
  stop('正在开启麦克风…');
  const token = generation;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    $('status').textContent = '此地址无法使用麦克风。请在电脑上使用 localhost 或 HTTPS，并使用支持麦克风的浏览器。';
    return;
  }
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) { $('status').textContent = '当前浏览器不支持音频分析，请使用新版 Chrome 或 Edge。'; return; }
  $('start').disabled = true;
  $('start').hidden = true;
  $('stop').disabled = false;
  $('stop').hidden = false;
  $('stop').textContent = '取消';
  $('device').disabled = true;
  let pendingAudio;
  try {
    pendingAudio = new Audio();
    audio = pendingAudio;
    await pendingAudio.resume();
    if (token !== generation || !panel.open) return;
    if (pendingAudio.state !== 'running') throw Error('Audio suspended');
    const acquired = await navigator.mediaDevices.getUserMedia({ audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: false, noiseSuppression: false, autoGainControl: false,
    }, video: false });
    if (token !== generation || !panel.open || document.hidden) {
      acquired.getTracks().forEach(track => track.stop());
      return;
    }
    stream = acquired;
    panel.dataset.listening = 'true';
    $('stop').textContent = '停止调音';
    const track = stream.getAudioTracks()[0];
    if (!track || track.readyState === 'ended') throw Error('No active input');
    track.addEventListener('ended', () => { if (token === generation) stop('输入设备已断开，请重新选择并开启。'); });
    track.addEventListener('mute', () => { if (token === generation) { tracker.reset(); reading(); $('status').textContent = '输入暂时中断，请检查麦克风或声卡。'; } });
    pendingAudio.addEventListener('statechange', () => {
      if (token === generation && pendingAudio.state !== 'running') stop('音频分析已中断，请重新开启麦克风。');
    });
    source = audio.createMediaStreamSource(stream);
    // Bandpass filter (50 Hz – 900 Hz) removes room rumble and high-frequency fret/pick noise.
    const highpass = audio.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 50;
    const lowpass = audio.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 900;
    analyser = audio.createAnalyser();
    analyser.fftSize = 4096;
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(analyser);
    samples = new Float32Array(analyser.fftSize);
    $('device').disabled = false;
    $('status').textContent = '正在聆听 · 拨动空弦后读数会自动保持 3 秒';
    devices(token).catch(() => {});
    function sample() {
      if (token !== generation) return;
      if (track.muted) {
        tracker.reset(); reading(); $('level').value = 0;
      } else {
        analyser.getFloatTimeDomainData(samples);
        const now = Date.now();
        const speaking = typeof window !== 'undefined' && window.speechSynthesis?.speaking;
        const raw = (now < ignoreInputUntil || speaking)
          ? { frequency: null, rms: 0 }
          : detectPitch(samples, audio.sampleRate);
        $('level').value = Math.min(1, raw.rms * 6);
        const state = tracker.step(raw.frequency, now);
        reading(state.reading, { held: state.held, lockedInTune: state.lockedInTune });
        if (state.cue) playCue(state.cue);
        if (state.reading) {
          $('status').textContent = state.held
            ? '已保持上次拨弦读数 · 可继续拧弦轴或再拨一次'
            : '正在聆听 · 每次只拨一根空弦';
        } else {
          $('status').textContent = raw.rms < 0.004
            ? '正在聆听 · 请拨动空弦（靠近麦克风或使用声卡）'
            : '正在分析音高 · 请只拨一根空弦并闷住其他弦';
        }
      }
      loop = setTimeout(sample, 55);
    }
    sample();
  } catch (error) {
    if (token === generation) stop(failure(error));
  } finally {
    if (token !== generation && pendingAudio?.state !== 'closed') pendingAudio?.close().catch(() => {});
  }
}

export function stopTunerCapture() { stop('麦克风已停止。点击开始调音重新开启。'); }

export function closeTuner() {
  stop();
  if (panel?.open) panel.close();
  if (panel) {
    panel.classList.remove('in-practice');
    document.body.append(panel);
  }
}

/** @param {{host?: HTMLElement | null, onClose?: (() => void) | null}} [options] */
export function showTuner({ host = null, onClose = null } = {}) {
  if (panel?.open) return;
  if (!panel) {
    panel = document.createElement('dialog');
    panel.id = 'tuner-dialog';
    panel.setAttribute('aria-labelledby', 'tuner-title');
    document.body.append(panel);
    const pegPositions = [[247, 280], [174, 279], [100, 275], [100, 370], [174, 369], [247, 365]];
    panel.innerHTML = `<header class="tuner-heading"><div><h2 id="tuner-title">调音器</h2><p class="tuner-subtitle">标准调弦 <span>·</span> <button type="button" id="tuner-mode" class="tuner-inline-btn">自动识别六弦 · 点击弦号可听标准音</button> <span>·</span> A4 440 Hz</p></div><div class="tuner-header-actions"><button type="button" class="button secondary compact" id="tuner-sound" aria-pressed="${soundEnabled}">${soundEnabled ? '🔊 声音提示：开' : '🔇 声音提示：关'}</button><button id="tuner-close" aria-label="关闭调音器" autofocus><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div></header>
      <div class="tuner-instrument"><img src="./assets/tuner-electric-guitar.png" width="2172" height="724" alt="横向电吉他，琴头在左，两侧各三个调弦旋钮"><svg class="tuner-string-overlay" viewBox="0 0 2172 724" aria-hidden="true">${STRINGS.map((s, i) => `<g data-guitar-string="${s.string}"><path d="M${pegPositions[i][0]} ${pegPositions[i][1]} L350 ${272 + i * 19} L1762 ${282 + i * 23}"/><circle cx="${pegPositions[i][0]}" cy="${pegPositions[i][1]}" r="12"/></g>`).join('')}</svg></div>
      <ol class="tuner-string-status" aria-label="自动识别的目标弦（点击可锁定并播放标准音）">${STRINGS.map(s => `<li data-string-status="${s.string}" role="button" tabindex="0" aria-pressed="false" title="点击播放 ${s.string} 弦 (${s.note}) 标准参考音并锁定该弦"><span>${s.string} 弦</span><strong>${s.note}</strong></li>`).join('')}</ol>
      <div id="tuner-readout"><div class="tuner-note-group"><span id="tuner-target">拨动一根空弦</span><strong id="tuner-note">—</strong></div><div class="tuner-feedback"><div class="tuner-direction-row"><strong id="tuner-direction">等待声音</strong><span id="tuner-adjustment">开启后，逐根拨空弦即可（点击上方弦号可听参考音）</span></div><div class="tuner-deviation" aria-hidden="true"><span class="tuner-deviation-center"></span><i id="tuner-needle" style="visibility:hidden"></i></div><div class="tuner-deviation-labels" aria-hidden="true"><span>偏低 −50</span><span>0</span><span>+50 偏高</span></div><div class="tuner-values"><span id="tuner-frequency">— Hz</span><span id="tuner-cents">— 音分</span></div></div></div>
      <div class="tuner-footer"><div class="tuner-input-group"><div class="tuner-input"><svg class="tuner-mic" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3m-3 0h6"/></svg><label for="tuner-device" class="sr-only">输入设备</label><select id="tuner-device"><option value="">系统默认输入</option></select><meter id="tuner-level" aria-label="输入音量" min="0" max="1" value="0"></meter></div><p id="tuner-status" role="status">开启麦克风，开始调音。</p></div><span id="tuner-announcement" class="sr-only" aria-live="polite"></span><div class="tuner-actions"><button class="button primary" id="tuner-start">开始调音</button><button class="button primary" id="tuner-stop" disabled hidden>停止调音</button></div></div><p class="tuner-privacy">本机处理 · 不保存录音</p>`;
    $('close').onclick = closeTuner;
    $('start').onclick = start;
    $('stop').onclick = () => stop();
    $('device').onchange = () => { if (stream) start(); };
    $('sound').onclick = () => {
      soundEnabled = !soundEnabled;
      try { localStorage.setItem('eguitar-tuner-sound', String(soundEnabled)); } catch {}
      $('sound').setAttribute('aria-pressed', String(soundEnabled));
      $('sound').textContent = soundEnabled ? '🔊 声音提示：开' : '🔇 声音提示：关';
      if (!soundEnabled) try { window.speechSynthesis?.cancel(); } catch {}
    };
    $('mode').onclick = () => {
      tracker.setLockedString(null);
      updateStringLockUI();
      reading();
    };
    panel.querySelectorAll('[data-string-status]').forEach(item => {
      const toggleString = () => {
        const num = Number(item.dataset.stringStatus);
        const sObj = STRINGS.find(x => x.string === num);
        if (sObj) playReferenceNote(sObj.frequency);
        tracker.setLockedString(tracker.getLockedString() === num ? null : num);
        updateStringLockUI();
        reading();
      };
      item.onclick = toggleString;
      item.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleString(); } };
    });
    panel.addEventListener('cancel', () => stop());
    panel.addEventListener('close', () => { if (!panel.open) stop(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && panel.open) stop('页面已离开，麦克风已停止。返回后可重新开启。'); });
    window.addEventListener('pagehide', closeTuner);
    navigator.mediaDevices?.addEventListener('devicechange', () => { if (panel.open) devices(generation).catch(() => {}); });
  }
  (host || document.body).append(panel);
  panel.classList.toggle('in-practice', !!host);
  panel.setAttribute('role', host ? 'region' : 'dialog');
  $('close').onclick = onClose || closeTuner;
  $('close').hidden = !!host;
  updateStringLockUI();
  stop('开启麦克风，开始调音。');
  if (host) panel.show(); else panel.showModal();
  devices(generation).catch(() => {});
}
