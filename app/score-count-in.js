// Playback preparation only: this does not change the score or practice evidence.
export const COUNT_IN_KEY = "eguitar.score-count-in.v1";

export function countInTiming(player, position) {
  const tick = player.tickPosition;
  const lookup = player.tickCache?.masterBars.find(
    (bar) => tick >= bar.start && tick < bar.end,
  ) || player.tickCache?.masterBars[0];
  const bar = lookup?.masterBar || player.score?.masterBars?.[0];
  const changes = lookup?.tempoChanges.filter((change) => change.tick <= tick);
  let tempo = changes?.at(-1)?.tempo || player.score?.tempo;
  // Modified tempo includes backing-track sync. Undo the captured speed before
  // applying the current one, which may have changed since the position event.
  if (position && position.currentTick === tick && position.speed > 0)
    tempo = position.modifiedTempo / position.speed;
  const beats = bar?.timeSignatureNumerator;
  const denominator = bar?.timeSignatureDenominator;
  const bpm = tempo * player.playbackSpeed;
  if (!Number.isInteger(beats) || beats <= 0 ||
      !Number.isInteger(denominator) || denominator <= 0 ||
      !Number.isFinite(bpm) || bpm <= 0)
    throw Error("无法确定当前拍号或速度，请关闭预备拍或重新载入乐谱");
  return { beats, beatSeconds: (60 / bpm) * (4 / denominator) };
}

export class ScoreCountIn {
  constructor(createAudio = () => {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) throw Error("当前浏览器不支持预备拍声音");
    return new Audio();
  }) {
    this.createAudio = createAudio;
    this.run = null;
  }
  get active() { return this.run !== null; }
  start({ beats, beatSeconds }, onBeat) {
    this.stop();
    return new Promise((resolve, reject) => {
      const run = { resolve, reject, nodes: [] };
      this.run = run;
      const prepare = async () => {
        try {
          const audio = this.createAudio();
          run.audio = audio;
          await audio.resume();
          if (this.run !== run) return;
          if (audio.state !== "running") throw Error("声音尚未启用，请再点一次播放");
          const start = audio.currentTime + 0.05;
          const end = start + beats * beatSeconds;
          for (let beat = 0; beat < beats; beat++) {
            const at = start + beat * beatSeconds;
            const osc = audio.createOscillator(), gain = audio.createGain();
            run.nodes.push(osc);
            osc.frequency.value = beat === 0 ? 1100 : 740;
            gain.gain.setValueAtTime(0, at);
            gain.gain.linearRampToValueAtTime(0.1, at + 0.003);
            gain.gain.exponentialRampToValueAtTime(0.001, at + 0.045);
            osc.connect(gain);
            gain.connect(audio.destination);
            osc.start(at);
            osc.stop(at + 0.05);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); };
          }
          let lastBeat = -1;
          run.timer = setInterval(() => {
            if (this.run !== run) return;
            if (audio.state !== "running") { this.stop(); return; }
            const now = audio.currentTime;
            if (now >= end) {
              // A stalled/backgrounded page must not launch delayed playback.
              this.finish(run, now - end < 0.25);
              return;
            }
            const beat = Math.floor((now - start) / beatSeconds);
            if (beat >= 0 && beat !== lastBeat) {
              lastBeat = beat;
              onBeat(beat + 1, beats);
            }
          }, 20);
        } catch (error) {
          if (this.run === run) this.finish(run, false, error);
        }
      };
      prepare();
    });
  }
  finish(run, completed, error) {
    if (this.run !== run) return;
    this.run = null;
    clearInterval(run.timer);
    for (const node of run.nodes) { try { node.stop(); } catch {} }
    run.audio?.close().catch(() => {});
    if (error) run.reject(error);
    else run.resolve(completed);
  }
  stop() {
    if (this.run) this.finish(this.run, false);
  }
}
