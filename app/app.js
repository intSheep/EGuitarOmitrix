import { lessonReview } from "./review-view.js";
import { teacherPrescription, todayPractice } from "./prescription.js";
import { FINISH_OUTCOMES, emptyGoals, optionalNumber, resumeGuidance, mergeGoals } from "./guidance.js";
import { showPositionReference } from "./position-reference.js";
import { showScore, pauseScore, closeScore } from "./score-viewer.js";
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
  readGoals,
  saveGoals,
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
  goals = emptyGoals(),
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
function dailyProgress(e) {
  const a=task(e.id), prescription=teacherPrescription(a), progress=todayPractice(logs,draft,a);
  return `<section class="daily-progress" aria-label="本课今日进度"><div class="daily-heading"><h3>本课今天</h3><span>未练时长不结转</span></div><p class="teacher-dose">老师要求 · ${prescription.dailyMinutes === null ? '每日时长未明确' : `每天 ${prescription.dailyMinutes} 分钟`}</p><p class="teacher-tempo">${esc(prescription.tempo)}</p><div class="daily-values"><span>已练 <strong>${time(progress.seconds)}</strong></span>${progress.remainingSeconds === null ? '' : `<span>${progress.completed ? '今日时长已完成' : `还差 <strong>${time(progress.remainingSeconds)}</strong>`}</span>`}</div>${progress.targetSeconds === null ? '' : `<progress aria-label="本课今天已练时长" max="${progress.targetSeconds}" value="${Math.min(progress.seconds,progress.targetSeconds)}"></progress>`}</section>`;
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
    )}</ul></section><div data-daily-progress="${e.id}">${dailyProgress(e)}</div>`;
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
function guidance(e) { return resumeGuidance(logs, e.id, task(e.id)?.version || assignments.version, task(e.id)); }
function resumePanel(e) {
  const g = guidance(e), last = g.last, goal = goals.lessons[e.id];
  const monday = new Date(); monday.setHours(0,0,0,0); monday.setDate(monday.getDate() - (monday.getDay()+6)%7);
  const weekly = activeLogs(logs).filter(l=>Date.parse(l.practicedAt)>=monday.getTime()).length;
  return `<section class="resume-panel"><h3>${last ? esc(g.action) : '我的练习目标'}</h3>${last ? `<div class="resume-facts"><span>上次 ${time(last.minutes*60)}</span>${last.bpm ? `<span>${last.bpmBasis === 'self-reported-stable' ? '稳定' : '记录速度'} ${last.bpm} BPM</span>` : ''}${last.outcome ? `<span>${esc(OUTCOMES[last.outcome])}</span>` : ''}</div>${g.bpm ? `<p>从 ${g.bpm} BPM ${g.fixed ? '固定速度' : '接着'}练</p>` : ''}` : ''}${goal?.minutes ? `<label>本次目标 ${goal.minutes} 分钟</label>` : ''}${goal?.bpm ? `<span class="goal-speed">个人目标 ${goal.bpm} BPM</span>` : ''}${goals.weeklySessions ? `<label>本周共 ${weekly} / ${goals.weeklySessions} 次<progress max="${goals.weeklySessions}" value="${Math.min(weekly,goals.weeklySessions)}"></progress></label>` : ''}<button class="text-link" data-goals="${e.id}" ${!db ? "disabled" : ""}>设置目标</button></section>`;
}
function finishPage() {
  if (!draft) return '<h1>本次练习已结束</h1><a class="button primary" href="#practice">返回练习台</a>';
  const review=draft.review || {}, e=entry(draft.entryId);
  return `<section class="finish-page"><h1>收好这次练习</h1><p>${esc(shortTitle(e))}</p><div class="finish-time"><strong>${time(draft.elapsedMs/1000)}</strong><span>专注时间</span></div>${draft.goal?.minutes ? `<label>本次目标 ${draft.goal.minutes} 分钟<progress max="${draft.goal.minutes*60}" value="${Math.min(draft.elapsedMs/1000,draft.goal.minutes*60)}"></progress></label>` : ''}<div data-daily-progress="${e.id}">${dailyProgress(e)}</div>${tempoEvidence(draft)}<form id="finish-form"><label for="stable-bpm">实际稳定 BPM · 选填</label><input id="stable-bpm" name="bpm" type="number" min="1" max="400" step="1" inputmode="numeric" value="${esc(review.bpm ?? '')}" placeholder="未确认可留空"><fieldset class="finish-outcomes"><legend>这次练得怎么样 · 选填</legend>${Object.entries(FINISH_OUTCOMES).map(([k,v])=>`<label><input type="radio" name="outcome" value="${k}" ${review.outcome===k?'checked':''}><span>${v}</span></label>`).join('')}</fieldset><p id="finish-error" role="alert"></p><div class="finish-actions"><button class="button primary" type="submit">保存练习</button><button class="button secondary" type="button" data-action="resume-finish">继续练习</button></div></form></section>`;
}
function tempoEvidence(record) {
  return record.tempoUsage?.length ? `<div class="tempo-evidence"><h3>节拍器使用</h3>${record.tempoUsage.map(x=>`<span>${x.bpm} BPM · ${time(x.seconds)}</span>`).join('')}</div>` : '';
}
async function goalForm(id) {
  goals = await readGoals(db);
  const g=goals.lessons[id] || {}, e=entry(id), fixed=guidance(e).fixed;
  openModal(`<h2 id="record-title">我的练习目标</h2><p>${esc(shortTitle(e))}</p><form id="goal-form" data-entry="${id}"><label>每次练习分钟<input name="minutes" type="number" min="1" max="240" value="${g.minutes ?? ''}" placeholder="不设目标"></label><label>每周总练习次数<input name="weekly" type="number" min="1" max="21" value="${goals.weeklySessions ?? ''}" placeholder="按自己的时间安排"></label><label>个人目标 BPM<input name="bpm" type="number" min="1" max="400" value="${g.bpm ?? ''}" placeholder="不设目标"></label>${fixed ? `<p>老师要求固定 ${fixed} BPM；个人目标不会改变节拍器限制。</p>` : ''}<p id="goal-error" role="alert"></p><button class="button primary" type="submit">保存目标</button></form>`);
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
  return `<div class="page-heading"><h1>练习台</h1><a class="text-link" href="#history">练习回顾</a></div><div class="stage-pills">${STAGES.map((s) => `<a class="button secondary" aria-current="${s.id === stage ? "step" : "false"}" href="#practice?stage=${s.id}&lesson=${primaryLessons(course, s.id)[0].id}">W${s.id}</a>`).join("")}</div><div class="practice-layout"><section class="exercise-list"><div class="list-heading"><h2>${esc(STAGES.find((s) => s.id === stage).title)}</h2></div><ul>${lessons.map((l) => `<li class="exercise-row ${l.id === e.id ? "is-selected" : ""}"><a class="exercise-select" href="#practice?stage=${stage}&lesson=${l.id}"><span class="exercise-number">${String(l.exercises[0]).padStart(2, "0")}</span><span class="exercise-label"><strong>${esc(shortTitle(l))}</strong><span>${seconds(l.id) > 0 ? `累计 ${time(seconds(l.id))}${guidance(l).last?.outcome === "mastered" ? " · 已掌握" : ""}` : "尚未练习"}</span></span></a></li>`).join("")}</ul></section><aside class="lesson-detail"><img class="detail-art" src="./assets/fretboard.svg" alt=""><h2>${esc(shortTitle(e))}</h2>${requirements(e)}${resumePanel(e)}<div class="single-start"><button class="button primary wide" data-start="${draft?.entryId || e.id}" ${!db ? "disabled" : ""}>${draft ? (draft.finishing ? "确认上次练习" : "继续未结束的练习") : guidance(e).last ? "接着练" : "开始练习"}</button>${draft && draft.entryId !== e.id ? `<p>${esc(shortTitle(entry(draft.entryId)))}</p>` : ""}</div><button class="button secondary wide" data-material="${e.id}">课程资料</button><section class="effort-mini"><h3>最近七天</h3>${bars()}</section></aside></div>`;
}
function focus() {
  if (!draft)
    return `<h1>选择一个练习开始</h1><a class="button primary" href="#practice">返回练习台</a>`;
  const e = entry(draft.entryId),
    a = task(e.id);
  return `<section class="focus-page"><div class="focus-top"><a class="button secondary" href="#practice?lesson=${e.id}">返回练习台</a><span>W${e.stage} · EX${e.exercises[0]}</span></div><h1>${esc(shortTitle(e))}</h1><div class="timer-orbit"><div class="ambient-orbit"></div><div class="timer-content"><p id="timer-state" role="status"></p><strong id="timer-value" role="timer" aria-label="专注练习时间">${time(draft.elapsedMs / 1000)}</strong><span>专注时间</span></div></div><div class="focus-actions">${button("pause", draft.running ? "暂停" : "继续练习")}${button("finish", "结束练习", true)}</div>${requirements(e)}<div class="tool-dock"><button class="button secondary" data-position-reference>把位速查</button><button class="button secondary" data-score="${e.id}">乐谱</button>${!teacherPrescription(a).noMetronome ? button("metronome", "节拍器") : ""}<button class="button secondary" data-material="${e.id}">课程资料</button></div><div id="metro-panel" hidden><label>BPM <input id="bpm" type="number" min="20" max="300" value="${guidance(e).bpm || teacherPrescription(a).startBpm || 60}" ${teacherPrescription(a).fixedBpm ? "disabled" : ""}></label><div class="beats" aria-hidden="true">${[0, 1, 2, 3].map(() => '<i class="beat-dot"></i>').join("")}</div>${button("metro-toggle", "播放节拍")}</div></section>`;
}
function history() {
  const all = activeLogs(logs), record = all.find(l=>l.id===route().params.get('session')), days = dailySeconds(logs);
  const filter=route().params.get('day');
  const heading = `<div class="page-heading"><h1>练习回顾</h1>${button("manage", "备份与管理")}</div>${
    record
      ? `<section class="completion"><div class="complete-mark">✓</div><h2>本次练习已记录</h2><strong class="session-duration">${time(record.minutes * 60)}</strong><p>${esc(shortTitle(entry(record.entryId)))}</p>${record.note ? `<p>${esc(record.note)}</p>` : ""}${record.nextFocus ? `<p>下次重点：${esc(record.nextFocus)}</p>` : ""}${record.bpm ? `<p>${record.bpm} BPM${record.bpmBasis === "self-reported-stable" ? " · 自评稳定速度" : ""}</p>` : ""}${tempoEvidence(record)}<div class="outcomes">${Object.entries(
          FINISH_OUTCOMES,
        )
          .map(
            ([k, v]) =>
              `<button class="button secondary" data-outcome="${k}" data-log="${record.id}" aria-pressed="${record.outcome === k}">${v}</button>`,
          )
          .join(
            "",
          )}</div>${record.outcome === 'learning' ? `<div class="next-actions"><button class="button secondary" data-material="${record.entryId}">查看老师讲解</button></div>` : ''}<button class="button secondary" data-edit-result="${record.id}">修改本次结果</button><a class="button primary" href="#practice?lesson=${record.entryId}">返回练习台</a></section>`
      : ""
  }`;

  const review=lessonReview(logs,course,assignments.items,route().params);
  if(route().params.has('lesson')) return heading + review;
  const dates=Array.from({length:84},(_,i)=>{const d=new Date();d.setDate(d.getDate()-83+i);return dayKey(d);});
  return heading + `<div class="stat-grid"><article><strong>${time(seconds())}</strong><span>全部课程累计</span></article><article><strong>${all.length}</strong><span>次练习</span></article><article><strong>${Object.keys(days).length}</strong><span>个练习日</span></article></div>${review}<div class="review-grid"><section class="review-panel"><h2>最近十二周</h2><div class="heatmap">${dates.map(d=>`<button class="heat-cell level-${!days[d]?0:days[d]<300?1:days[d]<900?2:3}" data-day="${d}" aria-label="${d}，练习 ${time(days[d]||0)}" title="${d} · ${time(days[d]||0)}"></button>`).join('')}</div><div class="heat-labels"><span>${dates[0]}</span><span>今天</span></div></section><section class="review-panel"><h2>最近七天</h2>${bars()}</section></div><section class="review-panel"><h2>${filter?esc(filter):'最近练习'}</h2>${filter?'<a href="#history">全部记录</a>':''}${all.filter(l=>!filter||dailySeconds([l])[filter]).map(l=>`<a class="session-row" href="#history?session=${l.id}"><span>${new Date(l.practicedAt).toLocaleString('zh-CN')}<strong>${esc(shortTitle(entry(l.entryId)))}</strong></span><span>${time(l.minutes*60)}${l.bpm?' · '+l.bpm+' BPM':''}${l.outcome?' · '+OUTCOMES[l.outcome]:''}</span></a>`).join('')}</section>`;
}
function catalogLink(changes) {
  const params = new URLSearchParams(route().params);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === "" || value === "all") params.delete(key);
    else params.set(key, String(value));
  }
  return `#catalog${params.size ? `?${params}` : ""}`;
}
function catalog() {
  const params = route().params,
    q = params.get("q") || "";
  const stage = /^[0-7]$/.test(params.get("stage"))
    ? Number(params.get("stage"))
    : "all";
  const kind = params.get("kind") || "all",
    includeLegacy = params.get("legacy") === "1";
  const types = [
    ["all", "全部"],
    ["lesson", "讲解"],
    ["backing", "伴奏"],
    ["demo", "示范"],
    ["followAlong", "跟练"],
    ["other", "其他"],
  ];
  const matches = filterEntries(course, { query: q, includeLegacy }).filter(
    (e) =>
      kind === "all" ||
      (kind === "other"
        ? !["lesson", "backing", "demo", "followAlong"].includes(e.kind)
        : e.kind === kind),
  );
  const entries = matches.filter((e) => stage === "all" || e.stage === stage);
  const stages = [{ id: 0, title: "课程导览" }, ...STAGES];
  const glyph = (e) =>
    `<svg class="icon" aria-hidden="true"><use href="#i-${e.kind === "lesson" ? "strings" : e.kind === "backing" ? "clock" : "book"}"/></svg>`;
  const row = (e) => {
    const inside = `<span class="library-icon kind-${e.kind}">${glyph(e)}</span><span class="library-row-text"><strong>${esc(shortTitle(e))}</strong><span class="library-meta">P${String(e.page).padStart(3, "0")}<span>·</span>${KINDS[e.kind]}<span>·</span>${Math.floor(e.durationSeconds / 60)}:${String(e.durationSeconds % 60).padStart(2, "0")}${e.legacy ? '<span class="library-old">旧版</span>' : ""}</span></span><span class="library-row-action">${e.kind === "lesson" ? "查看练习" : "查看资料"}</span>`;
    return e.kind === "lesson"
      ? `<a class="directory-row directory-action" href="#practice?stage=${e.stage}&lesson=${e.id}">${inside}</a>`
      : `<button class="directory-row directory-action" data-material="${e.id}">${inside}</button>`;
  };
  return `<div class="library-header"><div><p class="library-eyebrow">电吉他入门</p><h1>课程目录</h1></div><span class="library-total">${course.entries.filter((e) => includeLegacy || !e.legacy).length} 节课程与资料</span></div><div class="library-layout"><nav class="library-stages" aria-label="课程阶段"><a href="${catalogLink({ stage: null })}" ${stage === "all" ? 'aria-current="page"' : ""}><span>全部课程</span><span class="library-count">${matches.length}</span></a>${stages.map((s) => `<a href="${catalogLink({ stage: s.id })}" ${stage === s.id ? 'aria-current="page"' : ""}><span class="library-stage-label">${s.id ? `<b>W${s.id}</b>` : "<b>入门</b>"}<span>${s.title}</span></span><span class="library-count">${matches.filter((e) => e.stage === s.id).length}</span></a>`).join("")}</nav><section class="library-content" aria-label="课程内容"><form id="library-search" class="library-search"><svg class="icon" aria-hidden="true"><use href="#i-search"/></svg><input name="q" type="search" value="${esc(q)}" placeholder="搜索课程、练习或歌曲" aria-label="搜索课程"><button type="submit">搜索</button></form><div class="library-toolbar"><nav class="library-types" aria-label="内容类型">${types.map(([key, label]) => `<a href="${catalogLink({ kind: key })}" ${kind === key ? 'aria-current="page"' : ""}>${label}</a>`).join("")}</nav><label class="library-legacy"><input id="library-legacy" type="checkbox" ${includeLegacy ? "checked" : ""}>包含旧版</label></div><div class="course-directory">${
    entries.length
      ? stages
          .map((s) => {
            const list = entries.filter((e) => e.stage === s.id);
            return list.length
              ? `<section class="library-group"><header><h2>${s.id ? `<span>W${s.id}</span>` : ""}${s.title}</h2><span>${list.length} 节</span></header>${list.map(row).join("")}</section>`
              : "";
          })
          .join("")
      : `<div class="library-empty"><svg class="icon" aria-hidden="true"><use href="#i-search"/></svg><h2>没有找到匹配的课程</h2><a class="button secondary" href="#catalog">清除筛选</a></div>`
  }</div></section></div>`;
}
function render() {
  if (!course) return;
  const { name } = route();
  document.body.classList.toggle("is-focusing", name === "focus");
  root.innerHTML =
    name === "finish"
      ? finishPage()
      : name === "focus"
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
  document.querySelectorAll('[data-daily-progress]').forEach(node=>{
    const e=entry(node.dataset.dailyProgress);if(e)node.innerHTML=dailyProgress(e);
  });
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
  pauseScore();
  if (draft && release) draft = pauseSession(draft, Date.now(), performance.now(), reason, metro.running ? metro.bpm : null);
  metro.stop();
  const mb = document.querySelector('[data-action="metro-toggle"]');
  if (mb) mb.textContent = "播放节拍";
  if (!draft || !release) return;
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
        : {...createSession(id, task(id)?.version || assignments.version), goal: goals.lessons[id] || null};
    } catch (e) {
      release();
      release = null;
      throw e;
    }
  }
}
async function start(id, resume = false) {
  await claimSession(id);
  if (draft.finishing && !resume) { location.hash = "finish"; render(); return; }
  draft.finishing = false;
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
    if (el.hasAttribute("data-position-reference")) showPositionReference();
    if (el.dataset.editResult) {
      const l=logs.find(l=>l.id===el.dataset.editResult);
      openModal(`<h2 id="record-title">修改本次结果</h2><form id="result-form" data-log="${l.id}" data-updated="${l.updatedAt}"><label>实际稳定 BPM · 选填<input name="bpm" type="number" min="1" max="400" value="${l.bpm ?? ''}"></label><label>熟练程度<select name="outcome"><option value="">未确认</option>${Object.entries(OUTCOMES).map(([k,v])=>`<option value="${k}" ${l.outcome===k?'selected':''}>${v}</option>`).join('')}</select></label><p id="result-error" role="alert"></p><button class="button primary" type="submit">保存修改</button></form>`);
    }
    if (el.dataset.goals) await goalForm(el.dataset.goals);
    if (el.dataset.material) materials(el.dataset.material);
    if (el.dataset.score) {
      sampleClock();
      metro.stop();
      await showScore(el.dataset.score, shortTitle(entry(el.dataset.score)));
    }
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
          sessionLog(draft); // Validate positive observed time before confirmation.
          draft.finishing = true;
          await persist();
          location.hash = 'finish';
        } finally {
          busy = false;
        }
        break;
      case "resume-finish":
        await start(draft.entryId, true);
        break;
      case "metronome":
        document.querySelector("#metro-panel").hidden =
          !document.querySelector("#metro-panel").hidden;
        break;
      case "metro-toggle":
        if (metro.running) {
          sampleClock();
          metro.stop();
          el.textContent = "播放节拍";
        } else {
          if (!draft?.running) throw new Error("请先继续练习");
          metro.bpm = Number(document.querySelector("#bpm").value);
          if (metro.bpm < 20 || metro.bpm > 300 || !Number.isInteger(metro.bpm))
            throw new Error("BPM 请输入 20–300 之间的整数");
          await metro.start();
          sampleClock(false);
          el.textContent = "停止节拍";
        }
        break;
      case "manage":
        await manage();
        break;
      case "export": {
        logs = await allLogs(db);
        goals = await readGoals(db);
        const blob = new Blob(
          [
            JSON.stringify(
              {
                schemaVersion: 2,
                goals,
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
        await importLogs(db, pendingImport.logs, pendingImport.goals);
        goals = await readGoals(db);
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
document.addEventListener("input", (ev) => {
  if(ev.target.closest('#finish-form') && draft && release && !busy) {
    const f=new FormData(document.querySelector('#finish-form'));
    draft.review={bpm:f.get('bpm'),outcome:f.get('outcome') || null};
    persist().catch(e=>{document.querySelector('#finish-error').textContent=e.message;});
  }
});
document.addEventListener("change", async (ev) => {
  if(ev.target.id === "review-version") location.hash=ev.target.value;
  if (ev.target.id === "library-legacy")
    location.hash = catalogLink({ legacy: ev.target.checked ? "1" : null });
  try {
    if (ev.target.id === "bpm") {
      sampleClock();
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
      const backup = JSON.parse(await file.text());
      const incoming = validateBackup(
        backup,
        new Set(course.entries.map((e) => e.id)),
      );
      const preview = mergePreview(await allLogs(db), incoming);
      mergeGoals(await readGoals(db), backup.schemaVersion === 2 ? backup.goals : null);
      pendingImport = {logs:incoming, goals:backup.schemaVersion === 2 ? backup.goals : null};
      document.querySelector("#import-preview").innerHTML =
        `<p>新增 ${preview.additions.length} 条，跳过 ${preview.duplicates} 条重复记录。</p>${button("import-confirm", "确认导入")}`;
    }
  } catch (e) {
    notice(e.message);
  }
});
document.addEventListener("submit", async (e) => {
  if(e.target.id==='result-form') {
    e.preventDefault();if(busy)return;busy=true;
    try {
      const f=new FormData(e.target),l=logs.find(l=>l.id===e.target.dataset.log);
      await saveLog(db,{...l,bpm:optionalNumber(f.get('bpm'),1,400),bpmBasis:'self-reported-stable',outcome:f.get('outcome') || null,updatedAt:new Date().toISOString()},e.target.dataset.updated);
      logs=await allLogs(db);modal.close();render();
    }catch(error){document.querySelector('#result-error').textContent=error.message;}
    finally{busy=false;}
  }
  if (e.target.id === 'finish-form') {
    e.preventDefault(); if(busy) return; busy=true;
    try {
      const form=new FormData(e.target), bpm=optionalNumber(form.get('bpm'),1,400), outcome=form.get('outcome') || null;
      e.target.querySelectorAll('input,button').forEach(el=>el.disabled=true);
      await claimSession(draft.entryId,draft.id);
      draft.review={bpm,outcome}; await persist(); await saveQueue;
      const log={...sessionLog(draft),bpm,outcome};
      await finishDraft(db,log);
      draft=null;release?.();release=null;logs=await allLogs(db);
      location.hash=`history?session=${log.id}`;
    } catch(error) { const errorNode=document.querySelector('#finish-error'); if(errorNode)errorNode.textContent=error.message;else notice(error.message); }
    finally{busy=false;e.target.querySelectorAll('input,button').forEach(el=>el.disabled=false);}
  }
  if (e.target.id === 'goal-form') {
    e.preventDefault(); if(busy)return;busy=true;
    try {
      const f=new FormData(e.target), id=e.target.dataset.entry;
      const next={weeklySessions:optionalNumber(f.get('weekly'),1,21),lessons:{...goals.lessons,[id]:{minutes:optionalNumber(f.get('minutes'),1,240),bpm:optionalNumber(f.get('bpm'),1,400)}}};
      await saveGoals(db,next,goals); goals=next;modal.close();render();
    }catch(error){document.querySelector('#goal-error').textContent=error.message;}
    finally{busy=false;}
  }
  if (e.target.id === "library-search") {
    e.preventDefault();
    location.hash = catalogLink({ q: new FormData(e.target).get("q").trim() });
  }
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
  closeScore();
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
    Promise.all([allLogs(db), readDraft(db), readGoals(db)])
      .then(([l, d, g]) => {
        goals = g;
        logs = l;
        draft = d ? recoverSession(d) : null;
        render();
      })
      .catch((e) => notice(e.message));
});
window.addEventListener("pagehide", () => {
  pause().catch(() => {});
});
function sampleClock(withMetronome = true) {
  if (draft && release) draft = tickSession(draft, Date.now(), performance.now(), withMetronome && metro.running ? metro.bpm : null);
}
setInterval(async () => {
  if (!draft?.running || !release || document.hidden) { updateClock(); return; }
  sampleClock();
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
      goals = await readGoals(connection);
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
