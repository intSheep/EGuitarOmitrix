export class Metronome {
  constructor(onBeat) {
    this.onBeat = onBeat;
    this.bpm = 60;
    this.beats = 4;
    this.volume = 0.4;
    this.nodes = new Set();
  }
  async start() {
    this.stop();
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error("当前浏览器不支持节拍器声音");
    const audio = new Audio();
    this.audio = audio;
    await audio.resume();
    if (this.audio !== audio) return;
    if (this.audio.state !== "running")
      throw new Error("声音尚未启用，请再点一次播放");
    this.next = this.audio.currentTime + 0.05;
    this.beat = 0;
    this.running = true;
    this.scheduler = setInterval(() => this.schedule(), 25);
    this.schedule();
  }
  schedule() {
    if (!this.running) return;
    // Do not replay a backlog of clicks after a stalled main thread.
    if (this.next < this.audio.currentTime - 0.1)
      this.next = this.audio.currentTime + 0.05;
    while (this.next < this.audio.currentTime + 0.1) {
      const beat = this.beat,
        at = this.next,
        osc = this.audio.createOscillator(),
        gain = this.audio.createGain();
      osc.frequency.value = beat === 0 ? 1100 : 740;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(this.volume * 0.25, at + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.045);
      osc.connect(gain);
      gain.connect(this.audio.destination);
      osc.start(at);
      osc.stop(at + 0.05);
      this.nodes.add(osc);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
        this.nodes.delete(osc);
      };
      const timeout = setTimeout(
        () => {
          if (this.running) this.onBeat(beat);
        },
        Math.max(0, (at - this.audio.currentTime) * 1000),
      );
      this.timeouts ??= [];
      this.timeouts.push(timeout);
      if (this.timeouts.length > 32) this.timeouts.shift();
      this.next += 60 / this.bpm;
      this.beat = (beat + 1) % this.beats;
    }
  }
  stop() {
    this.running = false;
    clearInterval(this.scheduler);
    (this.timeouts || []).forEach(clearTimeout);
    this.timeouts = [];
    for (const node of this.nodes) {
      try {
        node.stop();
      } catch {}
    }
    this.nodes.clear();
    if (this.audio) {
      this.audio.close().catch(() => {});
      this.audio = null;
    }
  }
}
