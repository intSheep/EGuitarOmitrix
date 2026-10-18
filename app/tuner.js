import { STRINGS, detectPitch, tuningReading } from './tuner-model.js';

let panel, stream, audio, source, analyser, loop, generation = 0;
let samples, history = [], lastAnnouncement = '';
const $ = id => panel.querySelector(`#tuner-${id}`);

function reading(frequency = null) {
  const value = tuningReading(frequency);
  $('note').replaceChildren(document.createTextNode(value ? value.note.slice(0, -1) : '—'));
  if (value) { const octave = document.createElement('sub'); octave.textContent = value.note.slice(-1); $('note').append(octave); }
  panel.querySelectorAll('[data-string-status]').forEach(label => {
    label.dataset.detected = String(Number(label.dataset.stringStatus) === value?.target.string);
  });
  $('target').textContent = value ? `接近 ${value.target.string} 弦 · ${value.target.note}` : '拨动一根空弦';
  panel.querySelectorAll('[data-guitar-string]').forEach(string => {
    string.dataset.active = String(Number(string.dataset.guitarString) === value?.target.string);
  });
  $('frequency').textContent = value ? `${value.frequency.toFixed(2)} Hz` : '— Hz';
  const cents = value ? Math.round(value.cents) : null;
  $('cents').textContent = value ? `${cents > 0 ? '+' : ''}${cents} 音分` : '— 音分';
  const direction = !value ? '等待声音' : value.direction === 'in-tune' ? '准确' : value.direction === 'flat' ? '偏低' : '偏高';
  $('adjustment').textContent = !value ? '开启后，逐根拨空弦即可' : value.direction === 'in-tune' ? '这根弦已调准' : value.direction === 'flat' ? '稍微拧紧一点' : '稍微放松一点';
  $('direction').textContent = direction;
  $('readout').dataset.direction = value?.direction || '';
  $('needle').style.visibility = value ? 'visible' : 'hidden';
  $('needle').style.left = `${50 + Math.max(-50, Math.min(50, value?.cents || 0))}%`;
  // Announce semantic changes, not every frequency sample.
  const announcement = value ? `${value.target.string} 弦 ${value.note}，${direction}，${$('adjustment').textContent}` : '';
  if (announcement !== lastAnnouncement) $('announcement').textContent = announcement;
  lastAnnouncement = announcement;
}

function release() {
  generation++;
  clearTimeout(loop);
  loop = null;
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  source?.disconnect();
  source = analyser = null;
  audio?.close().catch(() => {});
  audio = null;
  history = [];
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
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return '未获得麦克风权限。请在浏览器地址栏允许访问后重试。';
  if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return '找不到所选输入设备。请连接麦克风或声卡，再重新开启。';
  if (error.name === 'NotReadableError' || error.name === 'AbortError') return '无法读取输入设备。请检查设备连接及其他应用的占用，再重试。';
  return '麦克风未能启动。请检查浏览器和设备后重试。';
}

async function devices(token) {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const list = await navigator.mediaDevices.enumerateDevices();
  if (generation !== token || !panel.open) return;
  const current = stream?.getAudioTracks()[0]?.getSettings().deviceId || $('device').value;
  $('device').replaceChildren(new Option('系统默认输入', ''));
  list.filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default').forEach((d, i) => {
    // Device labels are untrusted strings. Never interpolate as HTML.
    $('device').add(new Option(d.label || `输入设备 ${i + 1}`, d.deviceId));
  });
  if ([...$('device').options].some(o => o.value === current)) $('device').value = current;
}

async function start() {
  const deviceId = $('device').value;
  stop('正在请求麦克风权限…');
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
    // Create/resume within the click gesture; do not lose autoplay activation
    // while the user is answering the asynchronous permission prompt.
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
    track.addEventListener('mute', () => { if (token === generation) { history = []; reading(); $('status').textContent = '输入暂时中断，请检查麦克风或声卡。'; } });
    pendingAudio.addEventListener('statechange', () => {
      if (token === generation && pendingAudio.state !== 'running') stop('音频分析已中断，请重新开启麦克风。');
    });
    source = audio.createMediaStreamSource(stream);
    analyser = audio.createAnalyser();
    analyser.fftSize = 4096;
    source.connect(analyser); // Deliberately never connected to destination.
    samples = new Float32Array(analyser.fftSize);
    $('device').disabled = false;
    devices(token).catch(() => {});
    function sample() {
      if (token !== generation) return;
      if (track.muted) {
        history = []; reading(); $('level').value = 0;
      } else {
        analyser.getFloatTimeDomainData(samples);
        const result = detectPitch(samples, audio.sampleRate);
        $('level').value = Math.min(1, result.rms * 5);
        if (!result.frequency) {
          history = []; reading();
          $('status').textContent = result.rms < 0.004 ? '声音较小，请靠近麦克风，或使用音箱干净音色 / 声卡。' : '音高不稳定，请只拨一根空弦，并闷住其他弦。';
        } else {
          if (history.length && Math.abs(1200 * Math.log2(result.frequency / history.at(-1))) > 35) history = [];
          history.push(result.frequency);
          if (history.length > 5) history.shift();
          if (history.length >= 3) {
            reading([...history].sort((a, b) => a - b)[Math.floor(history.length / 2)]);
            $('status').textContent = '正在聆听 · 每次只拨一根空弦';
          } else { reading(); $('status').textContent = '正在确认音高…'; }
        }
      }
      loop = setTimeout(sample, 90);
    }
    sample();
  } catch (error) {
    if (token === generation) stop(failure(error));
  } finally {
    // An obsolete request must never close a newer request's context.
    if (token !== generation && pendingAudio?.state !== 'closed') pendingAudio?.close().catch(() => {});
  }
}

export function closeTuner() {
  stop();
  if (panel?.open) panel.close();
}

export function showTuner() {
  if (panel?.open) return;
  if (!panel) {
    panel = document.createElement('dialog');
    panel.id = 'tuner-dialog';
    panel.setAttribute('aria-labelledby', 'tuner-title');
    document.body.append(panel);
    const pegPositions = [[247, 280], [174, 279], [100, 275], [100, 370], [174, 369], [247, 365]];
    panel.innerHTML = `<header class="tuner-heading"><div><h2 id="tuner-title">调音器</h2><p class="tuner-subtitle">标准调弦 <span>·</span> 自动识别 <span>·</span> A4 440 Hz</p></div><button id="tuner-close" aria-label="关闭调音器" autofocus><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
      <div class="tuner-instrument"><img src="./assets/tuner-electric-guitar.png" width="2172" height="724" alt="横向电吉他，琴头在左，两侧各三个调弦旋钮"><svg class="tuner-string-overlay" viewBox="0 0 2172 724" aria-hidden="true">${STRINGS.map((s, i) => `<g data-guitar-string="${s.string}"><path d="M${pegPositions[i][0]} ${pegPositions[i][1]} L350 ${272 + i * 19} L1762 ${282 + i * 23}"/><circle cx="${pegPositions[i][0]}" cy="${pegPositions[i][1]}" r="12"/></g>`).join('')}</svg></div>
      <ol class="tuner-string-status" aria-label="自动识别的目标弦">${STRINGS.map(s => `<li data-string-status="${s.string}"><span>${s.string} 弦</span><strong>${s.note}</strong></li>`).join('')}</ol>
      <div id="tuner-readout"><div class="tuner-note-group"><span id="tuner-target">拨动一根空弦</span><strong id="tuner-note">—</strong></div><div class="tuner-feedback"><div class="tuner-direction-row"><strong id="tuner-direction">等待声音</strong><span id="tuner-adjustment">开启后，逐根拨空弦即可</span></div><div class="tuner-deviation" aria-hidden="true"><span class="tuner-deviation-center"></span><i id="tuner-needle" style="visibility:hidden"></i></div><div class="tuner-deviation-labels" aria-hidden="true"><span>偏低 −50</span><span>0</span><span>+50 偏高</span></div><div class="tuner-values"><span id="tuner-frequency">— Hz</span><span id="tuner-cents">— 音分</span></div></div></div>
      <div class="tuner-footer"><div class="tuner-input-group"><div class="tuner-input"><svg class="tuner-mic" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3m-3 0h6"/></svg><label for="tuner-device" class="sr-only">输入设备</label><select id="tuner-device"><option value="">系统默认输入</option></select><meter id="tuner-level" aria-label="输入音量" min="0" max="1" value="0"></meter></div><p id="tuner-status" role="status">开启麦克风，开始调音。</p></div><span id="tuner-announcement" class="sr-only" aria-live="polite"></span><div class="tuner-actions"><button class="button primary" id="tuner-start">开始调音</button><button class="button primary" id="tuner-stop" disabled hidden>停止调音</button></div></div><p class="tuner-privacy">本机处理 · 不保存录音</p>`;
    $('close').onclick = closeTuner;
    $('start').onclick = start;
    $('stop').onclick = () => stop();
    $('device').onchange = () => { if (stream) start(); };
    panel.addEventListener('cancel', () => stop());
    panel.addEventListener('close', () => { if (!panel.open) stop(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && panel.open) stop('页面已离开，麦克风已停止。返回后可重新开启。'); });
    window.addEventListener('pagehide', closeTuner);
    navigator.mediaDevices?.addEventListener('devicechange', () => { if (panel.open) devices(generation).catch(() => {}); });
  }
  stop('开启麦克风，开始调音。');
  panel.showModal();
  devices(generation).catch(() => {});
}
