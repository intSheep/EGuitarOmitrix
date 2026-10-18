import {
  STAGES,
  KINDS,
  validateCourse,
  filterEntries,
  primaryLessons,
  relatedEntries,
  shortTitle,
  videoUrl,
} from "./course.js";
import {
  openPracticeDB,
  allLogs,
  activeLogs,
  readDraft,
  writeDraft,
  finishDraft,
  saveLog,
  OUTCOMES,
  validateBackup,
  mergePreview,
  importLogs,
} from "./practice-store.js";
import {
  createSession,
  resumeSession,
  tickSession,
  pauseSession,
  recoverSession,
  sessionLog,
  dailySeconds,
  dayKey,
} from "./session.js";
import { Metronome } from "./metronome.js";
const root = document.querySelector("#app"),
  modal = document.querySelector("#record-dialog");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const button = (id, label, primary = false) =>
  `<button class="button ${primary ? "primary" : "secondary"}" data-action="${id}">${label}</button>`;
const time = (s) => {
  s = Math.floor(s);
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
};
let connectionAttempt = null;
let course,
  assignments,
  db,
  logs = [],
  draft = null,
  release = null,
  busy = false,
  storageError = "",
  lastTrigger,
  saveQueue = Promise.resolve();
const metro = new Metronome((beat) =>
  document
    .querySelectorAll(".beat-dot")
    .forEach((el, i) => el.classList.toggle("lit", i === beat)),
);
const route = () => {
  const [name = "practice", q = ""] = location.hash.slice(1).split("?");
  return { name, params: new URLSearchParams(q) };
};
const entry = (id) => course.entries.find((e) => e.id === id);
const task = (id) => assignments.items.find((a) => a.entryId === id);
const tempoText = (a) =>
  (a?.tempo || "")
    .replace("字幕目标为", "目标")
    .replace(/；(?:目标待听校|最终数值未明确|绝对 BPM 未明确)/g, "");
const recent = () => activeLogs(logs)[0];
const selected = () =>
  entry(route().params.get("lesson")) ||
  entry(draft?.entryId) ||
  entry(recent()?.entryId) ||
  primaryLessons(course, 1)[0];
const seconds = (id) =>
  activeLogs(logs)
    .filter((l) => !id || l.entryId === id)
    .reduce((n, l) => n + l.minutes * 60, 0);
function notice(message) {
  const n = document.querySelector("#notice");
  n.textContent = message;
  n.hidden = false;
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => (n.hidden = true), 6000);
}
function requirements(e) {
  const a = task(e.id);
  if (!a) return "";
  return `<section class="requirements"><h3>练习要求</h3><ul>${a.summary
    .split(/[；。]/)
    .filter(Boolean)
    .map((t) => `<li>${esc(t)}</li>`)
    .join(
      "",
    )}</ul><div class="task-pills">${a.dailyMinutes ? `<span>每天 ${a.dailyMinutes} 分钟</span>` : ""}${a.tempo ? `<span>${esc(tempoText(a))}</span>` : ""}</div></section>`;
}
function bars() {
  const days = dailySeconds(logs),
    dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - 6 + i);
      return dayKey(d);
    }),
    max = Math.max(60, ...dates.map((d) => days[d] || 0));
  return `<div class="week-bars" aria-label="最近七天练习时长">${dates.map((d) => `<div class="bar-column"><strong>${time(days[d] || 0)}</strong><div class="bar-track"><svg class="bar-svg" viewBox="0 0 32 100" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="${100 - (100 * (days[d] || 0)) / max}" width="32" height="${(100 * (days[d] || 0)) / max}" rx="5"/></svg></div><span>${d.slice(5)}</span></div>`).join("")}</div>`;
}
function workspace() {
  let e = selected();
  const requestedStage = Number(route().params.get("stage"));
  const stage = STAGES.some((s) => s.id === requestedStage)
    ? requestedStage
    : e.stage || 1;
  const lessons = primaryLessons(course, stage);
  if (e.legacy && e.stage === stage) lessons.push(e);
  if (e.stage !== stage || e.kind !== "lesson") e = lessons[0];
  return `<div class="page-heading"><h1>练习台</h1><a class="text-link" href="#history">练习回顾</a></div><div class="stage-pills">${STAGES.map((s) => `<a class="button secondary" aria-current="${s.id === stage ? "step" : "false"}" href="#practice?stage=${s.id}&lesson=${primaryLessons(course, s.id)[0].id}">W${s.id}</a>`).join("")}</div><div class="practice-layout"><section class="exercise-list"><div class="list-heading"><h2>${esc(STAGES.find((s) => s.id === stage).title)}</h2></div><ul>${lessons.map((l) => `<li class="exercise-row ${l.id === e.id ? "is-selected" : ""}"><a class="exercise-select" href="#practice?stage=${stage}&lesson=${l.id}"><span class="exercise-number">${String(l.exercises[0]).padStart(2, "0")}</span><span class="exercise-label"><strong>${esc(shortTitle(l))}</strong><span>${seconds(l.id) > 0 ? `累计 ${time(seconds(l.id))}` : "尚未练习"}</span></span></a></li>`).join("")}</ul></section><aside class="lesson-detail"><img class="detail-art" src="./assets/fretboard.svg" alt=""><h2>${esc(shortTitle(e))}</h2>${requirements(e)}<div class="single-start"><button class="button primary wide" data-start="${draft?.entryId || e.id}" ${!db ? "disabled" : ""}>${draft ? "继续未结束的练习" : "开始练习"}</button>${draft && draft.entryId !== e.id ? `<p>${esc(shortTitle(entry(draft.entryId)))}</p>` : ""}</div><button class="button secondary wide" data-material="${e.id}">课程资料</button><section class="effort-mini"><h3>最近七天</h3>${bars()}</section></aside></div>`;
}
function focus() {
  if (!draft)
    return `<h1>选择一个练习开始</h1><a class="button primary" href="#practice">返回练习台</a>`;
  const e = entry(draft.entryId),
    a = task(e.id);
  return `<section class="focus-page"><div class="focus-top"><a class="button secondary" href="#practice?lesson=${e.id}">返回练习台</a><span>W${e.stage} · EX${e.exercises[0]}</span></div><h1>${esc(shortTitle(e))}</h1><div class="timer-orbit"><div class="ambient-orbit"></div><div class="timer-content"><p id="timer-state" role="status"></p><strong id="timer-value" role="timer" aria-label="专注练习时间">${time(draft.elapsedMs / 1000)}</strong><span>专注时间</span></div></div><div class="focus-actions">${button("pause", draft.running ? "暂停" : "继续练习")}${button("finish", "结束练习", true)}</div>${requirements(e)}<div class="tool-dock">${!/不用|不使用|不需要|不跟节拍器/.test(a?.tempo || "") ? button("metronome", "节拍器") : ""}<button class="button secondary" data-material="${e.id}">课程资料</button></div><div id="metro-panel" hidden><label>BPM <input id="bpm" type="number" min="20" max="300" value="${Number(a?.tempo?.match(/\d+/)?.[0]) || 60}" ${/固定/.test(a?.tempo || "") ? "disabled" : ""}></label><div class="beats" aria-hidden="true">${[0, 1, 2, 3].map(() => '<i class="beat-dot"></i>').join("")}</div>${button("metro-toggle", "播放节拍")}</div></section>`;
}
function history() {
  const all = activeLogs(logs),
    record = all.find((l) => l.id === route().params.get("session")),
    days = dailySeconds(logs);
  const dates = Array.from({ length: 84 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 83 + i);
    return dayKey(d);
  });
  const filter = route().params.get("day");
  return `<div class="page-heading"><h1>练习回顾</h1>${button("manage", "备份与管理")}</div>${
    record
      ? `<section class="completion"><div class="complete-mark">✓</div><h2>本次练习已记录</h2><strong class="session-duration">${time(record.minutes * 60)}</strong><p>${esc(shortTitle(entry(record.entryId)))}</p>${record.note ? `<p>${esc(record.note)}</p>` : ""}${record.nextFocus ? `<p>下次重点：${esc(record.nextFocus)}</p>` : ""}${record.bpm ? `<p>${record.bpm} BPM</p>` : ""}<div class="outcomes">${Object.entries(
          OUTCOMES,
        )
          .map(
            ([k, v]) =>
              `<button class="button secondary" data-outcome="${k}" data-log="${record.id}" aria-pressed="${record.outcome === k}">${v}</button>`,
          )
          .join(
            "",
          )}</div><a class="button primary" href="#practice?lesson=${record.entryId}">返回练习台</a></section>`
      : ""
  }<div class="stat-grid"><article><strong>${time(seconds())}</strong><span>累计练习</span></article><article><strong>${all.length}</strong><span>次练习</span></article><article><strong>${Object.keys(days).length}</strong><span>个练习日</span></article></div><div class="review-grid"><section class="review-panel"><h2>最近十二周</h2><div class="heatmap">${dates.map((d) => `<button class="heat-cell level-${!days[d] ? 0 : days[d] < 300 ? 1 : days[d] < 900 ? 2 : 3}" data-day="${d}" aria-label="${d}，练习 ${time(days[d] || 0)}" title="${d} · ${time(days[d] || 0)}"></button>`).join("")}</div><div class="heat-labels"><span>${dates[0]}</span><span>今天</span></div></section><section class="review-panel"><h2>最近七天</h2>${bars()}</section></div><section class="review-panel"><h2>练过的内容</h2>${[...new Set(all.map((l) => l.entryId))].map((id) => `<a class="effort-row" href="#practice?lesson=${id}"><strong>${esc(shortTitle(entry(id)))}</strong><meter min="0" max="${Math.max(1, seconds())}" value="${seconds(id)}"></meter><span>${time(seconds(id))}</span></a>`).join("") || "<p>结束第一次练习后，这里会留下记录。</p>"}</section><section class="review-panel"><h2>${filter ? esc(filter) : "最近练习"}</h2>${filter ? '<a href="#history">全部记录</a>' : ""}${all
    .filter((l) => !filter || dailySeconds([l])[filter])
    .map(
      (l) =>
        `<a class="session-row" href="#history?session=${l.id}"><span>${new Date(l.practicedAt).toLocaleString("zh-CN")}<strong>${esc(shortTitle(entry(l.entryId)))}</strong></span><span>${time(l.minutes * 60)}${l.outcome ? ` · ${OUTCOMES[l.outcome]}` : ""}</span></a>`,
    )
    .join("")}</section>`;
}
function catalog() {
  const params = route().params,
    q = params.get("q") || "";
  const stage = Number(params.get("stage")) || "all",
    kind = params.get("kind") || "all",
    includeLegacy = params.get("legacy") === "1";
  const entries = filterEntries(course, {
    query: q,
    stage,
    kind,
    includeLegacy,
  });
  return `<h1>课程目录</h1><form id="search"><input name="q" aria-label="搜索课程" placeholder="搜索课程、伴奏" value="${esc(q)}"><select name="stage" aria-label="课程阶段"><option value="">全部阶段</option>${STAGES.map((s) => `<option value="${s.id}" ${stage === s.id ? "selected" : ""}>W${s.id}</option>`).join("")}</select><select name="kind" aria-label="视频类型"><option value="all">全部类型</option>${Object.entries(
    KINDS,
  )
    .map(
      ([k, v]) =>
        `<option value="${k}" ${kind === k ? "selected" : ""}>${v}</option>`,
    )
    .join(
      "",
    )}</select><label><input type="checkbox" name="legacy" value="1" ${includeLegacy ? "checked" : ""}>包含旧版</label><button class="button secondary">搜索</button></form><div class="course-directory">${entries
    .map(
      (e) =>
        `<article class="directory-row"><span class="directory-page">P${String(e.page).padStart(3, "0")}</span><div class="directory-title"><h2>${esc(shortTitle(e))}</h2><span>${e.stage ? `W${e.stage} · ` : ""}${KINDS[e.kind]}${e.legacy ? " · 旧版" : ""}</span></div>${e.kind === "lesson" ? `<a class="directory-action" href="#practice?stage=${e.stage}&lesson=${e.id}">选择练习</a>` : `<button class="directory-action" data-material="${e.id}">查看资料</button>`}</article>`,
    )
    .join("")}</div>`;
}
function render() {
  if (!course) return;
  const { name } = route();
  document.body.classList.toggle("is-focusing", name === "focus");
  root.innerHTML =
    name === "focus"
      ? focus()
      : name === "history"
        ? history()
        : name === "catalog"
          ? catalog()
          : workspace();
  if (storageError)
    root.insertAdjacentHTML(
      "afterbegin",
      `<section class="storage-banner" role="status"><div><strong>练习记录暂时不可用</strong><p>${esc(storageError)}</p></div>${button("retry-storage", "重试")}</section>`,
    );
  root.setAttribute("aria-busy", "false");
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === name) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  updateClock();
}
function updateClock() {
  if (!draft) return;
  const timer = document.querySelector("#timer-value");
  if (timer) timer.textContent = time(draft.elapsedMs / 1000);
  const status = document.querySelector("#timer-state");
  if (status)
    status.textContent = draft.running ? "正在专注" : draft.reason || "已暂停";
  const pause = document.querySelector('[data-action="pause"]');
  if (pause) pause.textContent = draft.running ? "暂停" : "继续练习";
  document.body.classList.toggle("clock-running", !!draft.running);
}
function persist() {
  const snapshot = structuredClone(draft);
  saveQueue = saveQueue.catch(() => {}).then(() => writeDraft(db, snapshot));
  return saveQueue;
}
async function pause(reason = "已暂停") {
  metro.stop();
  const mb = document.querySelector('[data-action="metro-toggle"]');
  if (mb) mb.textContent = "播放节拍";
  if (!draft || !release) return;
  draft = pauseSession(draft, Date.now(), performance.now(), reason);
  updateClock();
  await persist();
}
async function claimSession(id, expectedId = null) {
  if (!db) throw new Error(storageError || "无法打开练习存储");
  if (!release) {
    if (!navigator.locks) throw new Error("请使用支持安全计时的新版浏览器");
    await new Promise((resolve, reject) =>
      navigator.locks
        .request("eguitar-focus", { ifAvailable: true }, async (lock) => {
          if (!lock) {
            reject(new Error("另一标签页正在使用练习，请先在那里结束或关闭"));
            return;
          }
          await new Promise((done) => {
            release = done;
            resolve();
          });
        })
        .catch(reject),
    );
    try {
      const saved = await readDraft(db);
      if (expectedId && saved?.id !== expectedId)
        throw new Error("这次练习已在另一窗口结束，请刷新查看");
      draft = saved
        ? recoverSession(saved)
        : createSession(id, task(id)?.version || assignments.version);
    } catch (e) {
      release();
      release = null;
      throw e;
    }
  }
}
async function start(id) {
  await claimSession(id);
  draft = resumeSession(draft, Date.now(), performance.now());
  try {
    await persist();
  } catch (e) {
    draft = recoverSession(draft);
    updateClock();
    throw e;
  }
  location.hash = "focus";
  render();
}
function openModal(html) {
  lastTrigger = document.activeElement;
  modal.innerHTML = `<button class="dialog-close button secondary" data-action="close">关闭</button>${html}`;
  modal.showModal();
}
function materials(id) {
  const e = entry(id),
    a = task(id);
  const items = [e, ...relatedEntries(course, e)];
  openModal(
    `<h2 id="record-title">课程资料</h2><label>选择视频<select id="material-select">${items.map((v) => `<option value="${v.id}">${KINDS[v.kind]} · P${v.page} · ${esc(shortTitle(v))}</option>`).join("")}${a ? `<option value="source">本课练习要求 · ${time(a.evidence.from)}</option>` : ""}</select></label><a id="video-launch" class="button primary wide" href="${esc(videoUrl(course, e))}" target="_blank" rel="noopener noreferrer">打开视频</a>`,
  );
  modal.dataset.entry = id;
}
async function manage() {
  logs = await allLogs(db);
  openModal(
    `<h2 id="record-title">备份与管理</h2><p>记录保存在当前浏览器。</p>${button("export", "导出备份")}<label class="import-control">导入备份<input id="import" type="file" accept="application/json"></label><div id="import-preview"></div><h3>记录管理</h3>${logs.map((l) => `<div class="manage-row"><span>${esc(shortTitle(entry(l.entryId)))} · ${time(l.minutes * 60)}</span><button class="button secondary" data-delete="${l.id}">${l.deletedAt ? "恢复" : "删除"}</button></div>`).join("")}`,
  );
}
let pendingImport = null;
document.addEventListener("click", async (ev) => {
  const el = ev.target.closest("button,a");
  if (!el) return;
  try {
    if (el.id === "video-launch") await pause("查看资料，计时已暂停");
    if (el.dataset.start) {
      if (busy) return;
      busy = true;
      try {
        await start(el.dataset.start);
      } finally {
        busy = false;
      }
      return;
    }
    if (el.dataset.material) materials(el.dataset.material);
    if (el.dataset.day) location.hash = `history?day=${el.dataset.day}`;
    if (el.dataset.outcome) {
      const l = logs.find((l) => l.id === el.dataset.log);
      await saveLog(
        db,
        {
          ...l,
          outcome:
            l.outcome === el.dataset.outcome && l.source === "timer"
              ? null
              : el.dataset.outcome,
          updatedAt: new Date().toISOString(),
        },
        l.updatedAt,
      );
      logs = await allLogs(db);
      render();
    }
    if (el.dataset.delete) {
      const l = logs.find((l) => l.id === el.dataset.delete);
      await saveLog(
        db,
        {
          ...l,
          deletedAt: l.deletedAt ? null : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        l.updatedAt,
      );
      modal.close();
      await manage();
      render();
    }
    switch (el.dataset.action) {
      case "retry-storage":
        if (connectionAttempt)
          notice("仍在等待其他旧版标签页关闭，关闭后会自动恢复。");
        else await connectStorage();
        break;
      case "close":
        modal.close();
        break;
      case "pause":
        if (draft.running) await pause();
        else await start(draft.entryId);
        break;
      case "finish":
        if (busy) break;
        busy = true;
        try {
          await claimSession(draft.entryId, draft.id);
          await pause();
          await saveQueue;
          const log = sessionLog(draft);
          await finishDraft(db, log);
          draft = null;
          release?.();
          release = null;
          logs = await allLogs(db);
          location.hash = `history?session=${log.id}`;
        } finally {
          busy = false;
        }
        break;
      case "metronome":
        document.querySelector("#metro-panel").hidden =
          !document.querySelector("#metro-panel").hidden;
        break;
      case "metro-toggle":
        if (metro.running) {
          metro.stop();
          el.textContent = "播放节拍";
        } else {
          if (!draft?.running) throw new Error("请先继续练习");
          metro.bpm = Number(document.querySelector("#bpm").value);
          if (metro.bpm < 20 || metro.bpm > 300 || !Number.isFinite(metro.bpm))
            throw new Error("BPM 范围为 20–300");
          await metro.start();
          el.textContent = "停止节拍";
        }
        break;
      case "manage":
        await manage();
        break;
      case "export": {
        const blob = new Blob(
          [
            JSON.stringify(
              {
                schemaVersion: 1,
                app: "EGuitarOmitrix",
                exportedAt: new Date().toISOString(),
                logs,
              },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        );
        const url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download = "eguitar-practice.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        break;
      }
      case "import-confirm":
        await importLogs(db, pendingImport);
        pendingImport = null;
        logs = await allLogs(db);
        modal.close();
        render();
        notice("备份已导入");
        break;
    }
  } catch (e) {
    notice(e.message);
  }
});
document.addEventListener("change", async (ev) => {
  try {
    if (ev.target.id === "bpm") {
      metro.stop();
      document.querySelector('[data-action="metro-toggle"]').textContent =
        "播放节拍";
    }
    if (ev.target.id === "material-select") {
      const e = entry(modal.dataset.entry),
        a = task(e.id);
      const href =
        ev.target.value === "source"
          ? `${videoUrl(course, e)}&t=${Math.floor(a.evidence.from)}`
          : videoUrl(course, entry(ev.target.value));
      document.querySelector("#video-launch").href = href;
    }
    if (ev.target.id === "import") {
      pendingImport = null;
      const file = ev.target.files[0];
      if (!file) return;
      if (file.size > 20000000) throw new Error("备份过大");
      const incoming = validateBackup(
        JSON.parse(await file.text()),
        new Set(course.entries.map((e) => e.id)),
      );
      const preview = mergePreview(await allLogs(db), incoming);
      pendingImport = incoming;
      document.querySelector("#import-preview").innerHTML =
        `<p>新增 ${preview.additions.length} 条，跳过 ${preview.duplicates} 条重复记录。</p>${button("import-confirm", "确认导入")}`;
    }
  } catch (e) {
    notice(e.message);
  }
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "search") {
    e.preventDefault();
    location.hash = `catalog?${new URLSearchParams(new FormData(e.target))}`;
  }
});
modal.addEventListener(
  "close",
  () => lastTrigger?.isConnected && lastTrigger.focus(),
);
window.addEventListener("hashchange", async () => {
  if (route().name !== "focus") {
    try {
      await pause();
    } catch (e) {
      notice(e.message);
    }
  }
  modal.close();
  render();
  window.scrollTo(0, 0);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden)
    pause("离开页面，计时已暂停").catch((e) => notice(e.message));
  else if (db && !release)
    Promise.all([allLogs(db), readDraft(db)])
      .then(([l, d]) => {
        logs = l;
        draft = d ? recoverSession(d) : null;
        render();
      })
      .catch((e) => notice(e.message));
});
window.addEventListener("pagehide", () => {
  pause().catch(() => {});
});
setInterval(async () => {
  if (!draft?.running || !release || document.hidden) return;
  draft = tickSession(draft, Date.now(), performance.now());
  if (!draft.running) metro.stop();
  updateClock();
  try {
    await persist();
  } catch (e) {
    draft = recoverSession(draft);
    metro.stop();
    updateClock();
    notice(e.message);
  }
}, 1000);
function connectStorage() {
  if (connectionAttempt) return connectionAttempt;
  storageError = "正在连接本地练习记录…";
  render();
  connectionAttempt = (async () => {
    let connection;
    try {
      connection = await openPracticeDB({
        onBlocked: () => {
          storageError =
            "请关闭其他打开此应用的旧版标签页。关闭后会自动恢复，无需刷新；你的练习记录不会被清除。";
          render();
        },
      });
      const savedLogs = await allLogs(connection);
      const savedDraft = await readDraft(connection);
      db = connection;
      logs = savedLogs;
      draft = savedDraft ? recoverSession(savedDraft) : null;
      storageError = "";
      clearTimeout(notice.timer);
      document.querySelector("#notice").hidden = true;
    } catch (e) {
      connection?.close();
      db = null;
      storageError = e.message;
    } finally {
      connectionAttempt = null;
      render();
    }
  })();
  return connectionAttempt;
}
async function init() {
  try {
    course = validateCourse(await (await fetch("./data/course.json")).json());
    assignments = await (await fetch("./data/assignments.json")).json();
    storageError = "正在连接本地练习记录…";
    render();
    await connectStorage();
    render();
  } catch (e) {
    root.innerHTML = "<h1>课程加载失败，请刷新重试</h1>";
  }
}
init();
