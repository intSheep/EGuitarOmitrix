import { showPositionReference } from "./position-reference.js";
let sdk,
  api,
  generation = 0,
  urls = [];
let dialog;
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const localPath = (p) => {
  if (
    typeof p !== "string" ||
    !/^p\d{3}(?:-ex\d+)?\/(?:score\.(?:musicxml|gp)|(?:page-\d+|source(?:-\d+)?)\.(?:png|jpg))$/.test(p)
  )
    throw Error("乐谱路径无效");
  return "./local-scores/" + p;
};
function dispose() {
  generation++;
  api?.destroy();
  api = null;
  urls.forEach(URL.revokeObjectURL);
  urls = [];
}
export function pauseScore() {
  api?.pause();
}
export function closeScore() {
  if (dialog?.open) dialog.close();
  dispose();
}
function download(bytes, name, type) {
  const u = URL.createObjectURL(new Blob([bytes], { type }));
  urls.push(u);
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
}
export async function showScore(entryId, title, { host = null, onClose = null, onPosition = null } = {}) {
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "score-dialog";
    dialog.setAttribute("aria-labelledby", "score-title");
    document.body.append(dialog);
    dialog.addEventListener("close", () => { if (!dialog.open) dispose(); });
  }
  (host || document.body).append(dialog);
  dialog.classList.toggle('in-practice', !!host);
  dialog.setAttribute('role', host ? 'region' : 'dialog');
  dispose();
  const token = generation;
  dialog.innerHTML = `<header class="score-heading"><h2 id="score-title">${esc(title)}</h2><button class="button secondary" id="score-close">关闭乐谱</button></header><div class="score-controls"><label id="score-choice-label" hidden>本课乐谱 <select id="score-choice" aria-label="本课乐谱"></select></label><button class="button secondary" data-tuner>调音器</button><button class="button secondary" id="score-position">把位速查</button><label class="button secondary score-file">载入本地谱<input id="score-file" type="file" disabled accept=".gp,.gp3,.gp4,.gp5,.gpx,.musicxml,.xml,.mxl"></label><button class="button primary" id="score-play" disabled>播放</button><button class="button secondary" id="score-stop" disabled>回到开头</button><label>BPM <input id="score-bpm" type="number" min="20" max="300" disabled></label><label><input id="score-loop" type="checkbox">循环</label><button class="button secondary" id="score-gp" disabled>下载 GP 文件</button><button class="button secondary" id="score-xml" hidden>下载 MusicXML</button><button class="button secondary" id="score-source" hidden>原谱画面</button></div><p id="score-status" role="status">正在加载乐谱…</p><div id="score-render"></div><div id="score-images" hidden></div>`;
  if (host) { dialog.querySelector('#score-title').textContent = '乐谱'; dialog.querySelector('#score-close').textContent = '返回计时'; }
  dialog.querySelector("#score-position").onclick = onPosition || showPositionReference;
  dialog.querySelector("#score-close").onclick = onClose || (() => dialog.close());
  if (!dialog.open) { if (host) dialog.show(); else dialog.showModal(); }
  const status = dialog.querySelector("#score-status");
  try {
    sdk ??= await import("./vendor/alphatab/alphaTab.min.mjs");
    if (token !== generation) return;
    api = new sdk.AlphaTabApi(dialog.querySelector("#score-render"), {
      core: { fontDirectory: "./vendor/alphatab/font/", useWorkers: false },
      display: { scale: 1, layoutMode: "page" },
      notation: { elements: { scoreTitle: false } },
      player: {
        enablePlayer: true,
        soundFont: "./vendor/alphatab/soundfont/sonivox.sf2",
        scrollElement: dialog,
      },
    });
    const player = api;
    let xmlBytes = null,
      gpBytes = null,
      loaded = false,
      ready = false,
      defaultBpm = null,
      selection = 0,
      manualSelected = false;
    const update = () => {
      dialog.querySelector("#score-play").disabled = !(loaded && ready);
      dialog.querySelector("#score-stop").disabled = !loaded;
      dialog.querySelector("#score-gp").disabled = !loaded || player.score?.masterBars.some((b,i) => i > 0 && b.isAnacrusis);
    };
    player.error.on((e) => {
      if (token === generation) {
        loaded = false;
        update();
        status.textContent = "乐谱加载失败：" + e.message;
      }
    });
    player.playerReady.on(() => {
      if (token !== generation) return;
      ready = true;
      update();
    });
    player.scoreLoaded.on((score) => {
      if (token !== generation) return;
      loaded = true;
      dialog.querySelector("#score-render").hidden = false;
      dialog.querySelector("#score-loop").disabled = false;
      const tempo = score.tempo;
      const bpm = dialog.querySelector("#score-bpm");
      const tempos = new Set(
        score.masterBars.flatMap((b) =>
          (b.tempoAutomations || []).map((a) => a.value),
        ),
      );
      const variable = tempos.size > 1;
      const embedded = !!score.backingTrack?.rawAudioFile;
      bpm.dataset.mode = embedded ? "rate" : "bpm";
      bpm.parentElement.firstChild.textContent = embedded ? "速度 % " : "BPM ";
      bpm.min = embedded ? "25" : "20";
      bpm.max = embedded ? "200" : "300";
      bpm.disabled = variable && !embedded;
      bpm.value = embedded ? 100 : defaultBpm || tempo;
      player.playbackSpeed = embedded || variable ? 1 : (defaultBpm || tempo) / tempo;
      status.textContent = variable && !embedded
        ? "这份谱包含变速，按原谱速度播放。"
        : `${score.masterBars.length} 小节 · 谱面 ${tempo} BPM${score.backingTrack?.rawAudioFile ? " · 内嵌音频" : ""}`;
      update();
    });
    player.playerStateChanged.on((e) => {
      if (token === generation)
        dialog.querySelector("#score-play").textContent =
          e.state === 1 ? "暂停" : "播放";
    });
    dialog.querySelector("#score-play").onclick = () => player.playPause();
    dialog.querySelector("#score-stop").onclick = () => player.stop();
    dialog.querySelector("#score-loop").onchange = (e) =>
      (player.isLooping = e.target.checked);
    dialog.querySelector("#score-bpm").onchange = (e) => {
      const bpm = Number(e.target.value);
      const rate = e.target.dataset.mode === "rate";
      if (!Number.isFinite(bpm) || bpm < Number(e.target.min) || bpm > Number(e.target.max)) {
        status.textContent = rate ? "速度范围为 25%–200%" : "BPM 范围为 20–300";
        return;
      }
      player.playbackSpeed = rate ? bpm / 100 : bpm / player.score.tempo;
    };
    dialog.querySelector("#score-gp").onclick = () => {
      try {
        download(
          gpBytes || new sdk.exporter.Gp7Exporter().export(player.score),
          "practice.gp",
          "application/octet-stream",
        );
      } catch (e) {
        status.textContent = "导出失败：" + e.message;
      }
    };
    dialog.querySelector("#score-xml").onclick = () =>
      download(
        xmlBytes,
        "practice.musicxml",
        "application/vnd.recordare.musicxml+xml",
      );
    dialog.querySelector("#score-source").onclick = () => {
      const images = dialog.querySelector("#score-images");
      images.hidden = !images.hidden;
      dialog.querySelector("#score-render").hidden = !images.hidden;
      dialog.querySelector("#score-source").textContent = images.hidden
        ? "原谱画面"
        : "返回乐谱";
    };
    const load = async (bytes, isXml, originalGp = false) => {
      player.stop();
      loaded = false;
      update();
      xmlBytes = isXml ? bytes : null;
      gpBytes = originalGp ? bytes : null;
      dialog.querySelector("#score-xml").hidden = !xmlBytes;
      status.textContent = "正在排版…";
      try {
        if (!(await player.load(bytes))) throw Error("不支持的乐谱文件");
      } catch (e) {
        status.textContent = "无法读取乐谱：" + e.message;
      }
    };
    dialog.querySelector("#score-file").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) {
        status.textContent = "请选择小于 20 MB 的乐谱";
        return;
      }
      const current = ++selection;
      manualSelected = true;
      player.stop();
      loaded = false;
      update();
      defaultBpm = null;
      dialog.querySelector("#score-source").hidden = true;
      dialog.querySelector("#score-images").hidden = true;
      dialog.querySelector("#score-render").hidden = false;
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (token !== generation || current !== selection) return;
      await load(bytes, /\.(musicxml|xml)$/i.test(file.name), /\.gp$/i.test(file.name));
    };
    dialog.querySelector("#score-file").disabled = false;
    const response = await fetch("./local-scores/index.json");
    if (token !== generation || manualSelected) return;
    if (!response.ok) {
      status.textContent =
        "这项练习还没有谱，可载入本地 MusicXML 或 Guitar Pro 文件。";
      return;
    }
    const index = await response.json();
    if (token !== generation || manualSelected) return;
    const items = index.items.filter((i) => i.entryId === entryId || i.entryIds?.includes(entryId));
    if (!items.length) {
      status.textContent = "这项练习还没有谱，可载入本地 MusicXML 或 Guitar Pro 文件。";
      return;
    }
    const choice = dialog.querySelector("#score-choice");
    choice.innerHTML = items.map((item,i) => `<option value="${i}">${esc(item.title)}</option>`).join("");
    dialog.querySelector("#score-choice-label").hidden = items.length < 2;
    async function selectItem(item) {
      const current = ++selection;
      player.stop();
      loaded = false;
      xmlBytes = null;
      gpBytes = null;
      dialog.querySelector("#score-xml").hidden = true;
      dialog.querySelector("#score-bpm").disabled = true;
      dialog.querySelector("#score-loop").disabled = true;
      update();
      defaultBpm = item.practiceBpm;
      const images = item.images || [];
      dialog.querySelector("#score-images").innerHTML = images.map((p,i) =>
        `<figure><img src="${localPath(p)}" alt="原谱画面 ${i+1}"></figure>`).join("");
      dialog.querySelector("#score-source").hidden = !images.length;
      dialog.querySelector("#score-images").hidden = true;
      dialog.querySelector("#score-render").hidden = true;
      dialog.querySelector("#score-source").textContent = "原谱画面";
      const path = item.acceptedAudioGp || item.gp || item.xml;
      if (!path) {
        dialog.querySelector("#score-images").hidden = false;
        dialog.querySelector("#score-render").hidden = true;
        dialog.querySelector("#score-source").hidden = true;
        status.textContent = item.referenceOnly ? "课程图示" : "这份原谱暂未转成可播放乐谱";
        return;
      }
      status.textContent = "正在加载乐谱…";
      try {
      const result = await fetch(localPath(path));
      if (!result.ok) throw Error("本地谱文件不存在");
      const bytes = new Uint8Array(await result.arrayBuffer());
      if (token !== generation || current !== selection) return;
      await load(bytes, /\.musicxml$/.test(path), /\.gp$/.test(path));
      } catch (e) {
        if (token === generation && current === selection) status.textContent = "暂时无法打开乐谱：" + e.message;
      }
    }
    choice.onchange = () => selectItem(items[Number(choice.value)]).catch(e => {
      if (token === generation) status.textContent = "暂时无法打开乐谱：" + e.message;
    });
    await selectItem(items[0]);
  } catch (e) {
    if (token === generation)
      status.textContent = "暂时无法打开乐谱：" + e.message;
  }
}
