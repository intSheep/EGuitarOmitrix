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
    !/^p\d{3}\/(?:score\.(?:musicxml|gp)|page-\d+\.png)$/.test(p)
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
  else dispose();
}
function download(bytes, name, type) {
  const u = URL.createObjectURL(new Blob([bytes], { type }));
  urls.push(u);
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
}
export async function showScore(entryId, title) {
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "score-dialog";
    dialog.setAttribute("aria-labelledby", "score-title");
    document.body.append(dialog);
    dialog.addEventListener("close", dispose);
  }
  dispose();
  const token = generation;
  dialog.innerHTML = `<header class="score-heading"><h2 id="score-title">${esc(title)}</h2><button class="button secondary" id="score-close">关闭乐谱</button></header><div class="score-controls"><label class="button secondary score-file">载入本地谱<input id="score-file" type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx,.musicxml,.xml,.mxl"></label><button class="button primary" id="score-play" disabled>播放</button><button class="button secondary" id="score-stop" disabled>回到开头</button><label>BPM <input id="score-bpm" type="number" min="20" max="300" disabled></label><label><input id="score-loop" type="checkbox">循环</label><button class="button secondary" id="score-gp" disabled>下载 GP 文件</button><button class="button secondary" id="score-xml" hidden>下载 MusicXML</button><button class="button secondary" id="score-source" hidden>原谱画面</button></div><p id="score-status" role="status">正在加载乐谱…</p><div id="score-render"></div><div id="score-images" hidden></div>`;
  dialog.querySelector("#score-close").onclick = () => dialog.close();
  if (!dialog.open) dialog.showModal();
  const status = dialog.querySelector("#score-status");
  try {
    sdk ??= await import("./vendor/alphatab/alphaTab.min.mjs");
    if (token !== generation) return;
    api = new sdk.AlphaTabApi(dialog.querySelector("#score-render"), {
      core: { fontDirectory: "./vendor/alphatab/font/", useWorkers: false },
      display: { scale: 1, layoutMode: "page" },
      player: {
        enablePlayer: true,
        soundFont: "./vendor/alphatab/soundfont/sonivox.sf2",
        scrollElement: dialog,
      },
    });
    const player = api;
    let xmlBytes = null,
      loaded = false,
      ready = false,
      defaultBpm = null;
    const update = () => {
      dialog.querySelector("#score-play").disabled = !(loaded && ready);
      dialog.querySelector("#score-stop").disabled = !loaded;
      dialog.querySelector("#score-gp").disabled = !loaded;
    };
    player.error.on((e) => {
      if (token === generation)
        status.textContent = "乐谱加载失败：" + e.message;
    });
    player.playerReady.on(() => {
      if (token !== generation) return;
      ready = true;
      update();
    });
    player.scoreLoaded.on((score) => {
      if (token !== generation) return;
      loaded = true;
      const tempo = score.tempo;
      const bpm = dialog.querySelector("#score-bpm");
      const tempos = new Set(
        score.masterBars.flatMap((b) =>
          (b.tempoAutomations || []).map((a) => a.value),
        ),
      );
      const variable = tempos.size > 1;
      bpm.disabled = variable;
      bpm.value = defaultBpm || tempo;
      player.playbackSpeed = variable ? 1 : (defaultBpm || tempo) / tempo;
      status.textContent = variable
        ? "这份谱包含变速，按原谱速度播放。"
        : `${score.masterBars.length} 小节 · 原谱 ${tempo} BPM`;
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
      if (!Number.isFinite(bpm) || bpm < 20 || bpm > 300) {
        status.textContent = "BPM 范围为 20–300";
        return;
      }
      player.playbackSpeed = bpm / player.score.tempo;
    };
    dialog.querySelector("#score-gp").onclick = () => {
      try {
        download(
          new sdk.exporter.Gp7Exporter().export(player.score),
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
    const load = async (bytes, isXml) => {
      player.stop();
      loaded = false;
      update();
      xmlBytes = isXml ? bytes : null;
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
      defaultBpm = null;
      dialog.querySelector("#score-source").hidden = true;
      dialog.querySelector("#score-images").hidden = true;
      dialog.querySelector("#score-render").hidden = false;
      await load(
        new Uint8Array(await file.arrayBuffer()),
        /\.(musicxml|xml)$/i.test(file.name),
      );
    };
    const response = await fetch("./local-scores/index.json");
    if (token !== generation) return;
    if (!response.ok) {
      status.textContent =
        "这项练习还没有谱，可载入本地 MusicXML 或 Guitar Pro 文件。";
      return;
    }
    const index = await response.json(),
      item = index.items.find((i) => i.entryId === entryId);
    if (!item) {
      status.textContent =
        "这项练习还没有谱，可载入本地 MusicXML 或 Guitar Pro 文件。";
      return;
    }
    defaultBpm = item.practiceBpm;
    dialog.querySelector("#score-images").innerHTML = item.images
      .map(
        (p, i) =>
          `<figure><img src="${localPath(p)}" alt="原谱画面 ${i + 1}"><figcaption>画面 ${i + 1}</figcaption></figure>`,
      )
      .join("");
    dialog.querySelector("#score-source").hidden = !item.images.length;
    const scoreResponse = await fetch(localPath(item.xml));
    if (!scoreResponse.ok) throw Error("本地谱文件不存在");
    const bytes = new Uint8Array(await scoreResponse.arrayBuffer());
    if (token !== generation) return;
    await load(bytes, true);
  } catch (e) {
    if (token === generation)
      status.textContent = "暂时无法打开乐谱：" + e.message;
  }
}
