import {
  activeLogs,
  allLogs,
  openPracticeDB,
  readDraft,
  writeDraft,
  finishDraft,
  readGoals,
  saveGoals,
  saveLog,
  importLogs,
  validateBackup,
  mergePreview,
} from "../storage/practice-store";
import {
  readStudy,
  writeWatch,
  saveWatch,
  setWatchDeleted,
} from "../storage/study-store";
import {
  createSession,
  resumeSession,
  pauseSession,
  recoverSession,
  sessionLog,
  tickSession,
} from "../domain/session";
import { beginWatch, stopWatch, confirmWatch } from "../domain/study";
import { emptyGoals, mergeGoals } from "../domain/guidance";
import { validateCourse, primaryLessons, videoUrl } from "../domain/course";
import {
  assignmentsSchema,
  message,
  type Course,
  type Assignments,
  type SessionDraft,
  type PracticeLog,
  type Goals,
  type Outcome,
  type WatchDraft,
  type WatchRecord,
  type Backup,
} from "../domain/types";
import { Metronome } from "../audio/metronome";
import { stopPitchCapture } from "../audio/pitch-capture";
import { pauseScore, closeScore } from "../../app/score-viewer.js";
import { closeTuner, stopTunerCapture } from "../../app/tuner.js";
import { saveFile } from "../platform/file-export";

export type Tool =
  "score" | "tuner" | "position" | "materials" | "metronome" | null;
export type Dialog =
  | { kind: "goals" | "materials"; id: string }
  | { kind: "manage" | "menu" }
  | { kind: "result"; record: PracticeLog }
  | null;
export interface Snapshot {
  course: Course | null;
  assignments: Assignments | null;
  logs: PracticeLog[];
  goals: Goals;
  draft: SessionDraft | null;
  watches: WatchRecord[];
  watchDraft: WatchDraft | null;
  storageError: string;
  fatal: string;
  ready: boolean;
  busy: boolean;
  tool: Tool;
  dialog: Dialog;
  notice: string;
  saved: PracticeLog | null;
  metroPlaying: boolean;
}
let state: Snapshot = {
  course: null,
  assignments: null,
  logs: [],
  goals: emptyGoals(),
  draft: null,
  watches: [],
  watchDraft: null,
  storageError: "正在连接本地练习记录…",
  fatal: "",
  ready: false,
  busy: false,
  tool: null,
  dialog: null,
  notice: "",
  saved: null,
  metroPlaying: false,
};
const listeners = new Set<() => void>();
let db: IDBDatabase | null = null,
  release: (() => void) | null = null,
  queue: Promise<void> = Promise.resolve(),
  connection: Promise<void> | null = null,
  initialized = false,
  watchBusy = false,
  watchAway = false;
let reviewQueue: Promise<void> = Promise.resolve();
let timer: ReturnType<typeof setInterval> | undefined;
const metro = new Metronome((beat: number) =>
  document
    .querySelectorAll(".beat-dot")
    .forEach((el, i) => el.classList.toggle("lit", i === beat)),
);
export const getSnapshot = () => state;
export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const patch = (changes: Partial<Snapshot>) => {
  state = { ...state, ...changes };
  listeners.forEach((l) => l());
};
export const notify = (text: string) => patch({ notice: text });
export const run = (action: () => Promise<unknown> | void) => {
  Promise.resolve()
    .then(action)
    .catch((e) => notify(message(e)));
};
export const lesson = (id: string) => {
  const e = state.course?.entries.find((e) => e.id === id);
  if (!e) throw Error("未找到课程");
  return e;
};
export const assignment = (id: string) =>
  state.assignments?.items.find((a) => a.entryId === id);
export const route = () => {
  const [name = "practice", query = ""] = location.hash
    .replace(/^#\/?/, "")
    .split("?");
  return { name, params: new URLSearchParams(query) };
};
export const navigate = (hash: string) => {
  location.hash = hash;
};
export function selected() {
  const id =
    route().params.get("lesson") ||
    state.draft?.entryId ||
    activeLogs(state.logs)[0]?.entryId;
  return (
    state.course?.entries.find((e) => e.id === id) ||
    primaryLessons(state.course!, 1)[0]
  );
}
function database() {
  if (!db) throw Error(state.storageError || "本地记录暂不可用");
  return db;
}
function draft() {
  if (!state.draft) throw Error("没有进行中的练习");
  return state.draft;
}
function persist() {
  const snapshot = structuredClone(state.draft);
  queue = queue.catch(() => {}).then(() => writeDraft(database(), snapshot));
  return queue;
}
function sample() {
  if (state.draft?.running)
    patch({
      draft: tickSession(
        state.draft,
        Date.now(),
        performance.now(),
        metro.running ? metro.bpm : null,
      ),
    });
}
function stopSound() {
  pauseScore();
  metro.stop();
  patch({ metroPlaying: false });
}
export async function pause(reason = "已暂停") {
  if (state.draft && release)
    patch({
      draft: pauseSession(
        state.draft,
        Date.now(),
        performance.now(),
        reason,
        metro.running ? metro.bpm : null,
      ),
    });
  stopSound();
  if (state.draft && release) await persist();
}
async function acquire() {
  database();
  if (release) return;
  if (!navigator.locks) throw Error("请使用支持安全计时的新版浏览器");
  await new Promise<void>((resolve, reject) => {
    void navigator.locks
      .request("eguitar-focus", { ifAvailable: true }, async (lock) => {
        if (!lock) {
          reject(Error("另一标签页正在使用练习，请先在那里结束或关闭"));
          return;
        }
        await new Promise<void>((done) => {
          release = done;
          resolve();
        });
      })
      .catch(reject);
  });
}
function releaseOwnership() {
  release?.();
  release = null;
}
function releaseIfIdle() {
  if (!state.draft) {
    release?.();
    release = null;
  }
}
async function claim(id: string, expected?: string) {
  if (release) return;
  await acquire();
  try {
    const study = await readStudy(database());
    if (study.draft) {
      patch({ watchDraft: study.draft });
      throw Error("请先确认或不计入这次看课时间");
    }
    const saved = await readDraft(database());
    if (expected && saved?.id !== expected)
      throw Error("这次练习已在另一窗口结束，请刷新查看");
    patch({
      draft: saved
        ? recoverSession(saved)
        : {
            ...createSession(
              id,
              assignment(id)?.version || state.assignments!.version,
            ),
            goal: state.goals.lessons[id] || null,
          },
    });
  } catch (e) {
    releaseOwnership();
    throw e;
  }
}
async function exclusive(action: () => Promise<void>) {
  if (state.busy) return;
  patch({ busy: true });
  try {
    await action();
  } finally {
    patch({ busy: false });
  }
}
export async function start(id: string, resume = false) {
  await exclusive(async () => {
    if (state.watchDraft)
      throw Error("请先确认或不计入这次看课时间，再继续练习");
    await claim(id);
    if (draft().finishing && !resume) {
      navigate("finish");
      return;
    }
    patch({
      draft: resumeSession(
        { ...draft(), finishing: false },
        Date.now(),
        performance.now(),
      ),
      saved: null,
    });
    try {
      await persist();
    } catch (e) {
      patch({ draft: recoverSession(draft()) });
      throw e;
    }
    navigate("focus");
  });
}
export const MIN_PRACTICE_MS = 60_000;
export async function finish() {
  await exclusive(async () => {
    const current = draft();
    await claim(current.entryId, current.id);
    await pause();
    await queue;
    const minMs = window.eguitarMinPracticeMs ?? MIN_PRACTICE_MS;
    if (draft().elapsedMs < minMs) {
      const entryId = draft().entryId;
      await writeDraft(database(), null);
      patch({ draft: null, saved: null });
      release?.();
      release = null;
      setTool(null);
      navigate(`practice?lesson=${entryId}`);
      notify("练习不足 1 分钟，本次未计入记录");
      return;
    }
    sessionLog(draft());
    patch({ draft: { ...draft(), finishing: true } });
    await persist();
    setTool(null);
    navigate("finish");
  });
}
export async function discard() {
  await exclusive(async () => {
    await reviewQueue;
    const current = draft();
    await claim(current.entryId, current.id);
    await pause();
    await queue;
    const entryId = draft().entryId;
    await writeDraft(database(), null);
    patch({ draft: null, saved: null });
    release?.();
    release = null;
    setTool(null);
    navigate(`practice?lesson=${entryId}`);
    notify("已放弃本次练习");
  });
}
export function updateReview(bpm: string, outcome: Outcome | null) {
  const current = draft();
  reviewQueue = reviewQueue
    .catch(() => {})
    .then(async () => {
      await claim(current.entryId, current.id);
      patch({ draft: { ...draft(), review: { bpm, outcome } } });
      await persist();
    });
  return reviewQueue;
}
export async function saveResult(bpm: number | null, outcome: Outcome | null) {
  await exclusive(async () => {
    await reviewQueue;
    const current = draft();
    await claim(current.entryId, current.id);
    patch({ draft: { ...draft(), review: { bpm, outcome } } });
    await persist();
    await queue;
    const log = { ...sessionLog(draft()), bpm, outcome };
    await finishDraft(database(), log);
    patch({
      draft: null,
      saved: log,
      logs: [log, ...state.logs.filter((x) => x.id !== log.id)],
    });
    release?.();
    release = null;
    navigate(`practice?lesson=${log.entryId}`);
    notify("已保存");
  });
}
export function setTool(tool: Tool) {
  if (state.tool === tool) return;
  closeScore();
  closeTuner();
  stopPitchCapture();
  metro.stop();
  patch({ tool, metroPlaying: false });
}
export async function openTool(tool: Tool) {
  sample();
  setTool(tool);
}
export function setDialog(dialog: Dialog) {
  patch({ dialog });
}
export async function toggleMetronome(bpm: number) {
  sample();
  if (metro.running) {
    metro.stop();
    patch({ metroPlaying: false });
    return;
  }
  if (!draft().running) throw Error("请先继续练习");
  const prescription = (
    await import("../domain/prescription")
  ).teacherPrescription(assignment(draft().entryId));
  if (prescription.noMetronome) throw Error("本课不使用节拍器");
  if (!Number.isInteger(bpm) || bpm < 20 || bpm > 300)
    throw Error("BPM 请输入 20–300 之间的整数");
  if (prescription.fixedBpm && bpm !== prescription.fixedBpm)
    throw Error("请保持老师要求的固定速度");
  metro.bpm = bpm;
  await metro.start();
  patch({ metroPlaying: true });
}
export function stopMetronome() {
  sample();
  metro.stop();
  patch({ metroPlaying: false });
}
export async function connectStorage() {
  if (connection) return connection;
  connection = (async () => {
    patch({ storageError: "正在连接本地练习记录…", ready: false });
    let next: IDBDatabase | undefined;
    try {
      next = await openPracticeDB({
        onBlocked: () =>
          patch({
            storageError:
              "请关闭其他打开此应用的旧版标签页。关闭后会自动恢复，无需刷新。",
          }),
      });
      const [logs, saved, goals, study] = await Promise.all([
        allLogs(next),
        readDraft(next),
        readGoals(next),
        readStudy(next),
      ]);
      db = next;
      patch({
        logs,
        draft: saved ? recoverSession(saved) : null,
        goals,
        watches: study.records,
        watchDraft: study.draft,
        storageError: "",
        ready: true,
      });
    } catch (e) {
      next?.close();
      db = null;
      patch({ storageError: message(e), ready: false });
    } finally {
      connection = null;
    }
    if (state.watchDraft?.endedAt === null) await endWatch(true);
  })();
  return connection;
}
export async function refresh() {
  if (!db || release) return;
  const [logs, saved, goals, study] = await Promise.all([
    allLogs(db),
    readDraft(db),
    readGoals(db),
    readStudy(db),
  ]);
  patch({
    logs,
    draft: saved ? recoverSession(saved) : null,
    goals,
    watches: study.records,
    watchDraft: study.draft,
  });
}
export async function endWatch(interrupted = false) {
  if (!state.watchDraft || state.watchDraft.endedAt !== null || watchBusy)
    return;
  watchBusy = true;
  try {
    await acquire();
    const stored = await readStudy(database());
    if (JSON.stringify(stored.draft) !== JSON.stringify(state.watchDraft)) {
      patch({ watchDraft: stored.draft, watches: stored.records });
      releaseIfIdle();
      return;
    }
    const next = { ...stopWatch(state.watchDraft), interrupted };
    await writeWatch(database(), next, state.watchDraft);
    patch({ watchDraft: next });
    watchAway = false;
  } finally {
    watchBusy = false;
  }
}
export async function launchMaterial(id: string, from?: number) {
  if (watchBusy) return;
  if (state.watchDraft) throw Error("请先确认或不计入上次看课时间");
  const url = videoUrl(state.course!, lesson(id), from);
  // Open synchronously in the user gesture; desktop permits this placeholder only.
  const nativeOpen = window.eguitarDesktop?.openCourse;
  const video = nativeOpen ? null : window.open("about:blank", "_blank");
  if (!video && !nativeOpen) throw Error("视频未能打开，请允许弹出新标签页");
  if (video) video.opener = null;
  watchBusy = true;
  try {
    sample();
    stopSound();
    stopTunerCapture();
    stopPitchCapture();
    if (state.draft?.running) {
      await persist();
    } else if (db && navigator.locks) {
      await acquire();
      const next = beginWatch(id);
      await writeWatch(db, next, null);
      patch({ watchDraft: next });
      watchAway = document.hidden || !document.hasFocus();
    } else notify("当前无法保存看课计时，本次仅打开视频");
    if (nativeOpen) await nativeOpen(url);
    else video!.location.replace(url);
    setDialog(null);
  } catch (e) {
    video?.close();
    releaseIfIdle();
    throw e;
  } finally {
    watchBusy = false;
  }
}
export async function confirmViewing(seconds: number | null) {
  if (watchBusy) return;
  watchBusy = true;
  try {
    await acquire();
    if (!state.watchDraft) throw Error("没有待确认的看课时间");
    if (seconds === null) await writeWatch(database(), null, state.watchDraft);
    else {
      const record = confirmWatch(state.watchDraft, seconds);
      await saveWatch(database(), record, state.watchDraft);
      patch({ watches: [...state.watches, record] });
    }
    patch({ watchDraft: null });
    releaseIfIdle();
  } finally {
    watchBusy = false;
  }
}
export async function updateGoals(next: Goals, expected: Goals) {
  await saveGoals(database(), next, expected);
  patch({ goals: next, dialog: null });
}
export async function updateLog(log: PracticeLog, expected: string) {
  await saveLog(database(), log, expected);
  patch({ logs: await allLogs(database()) });
}
export async function deleteWatch(record: WatchRecord) {
  await setWatchDeleted(
    database(),
    {
      ...record,
      deletedAt: record.deletedAt ? null : new Date().toISOString(),
    },
    record.deletedAt,
  );
  patch({ watches: (await readStudy(database())).records });
}
export async function exportBackup() {
  const [logs, goals, study] = await Promise.all([
    allLogs(database()),
    readGoals(database()),
    readStudy(database()),
  ]);
  await saveFile(
    new Blob(
      [
        JSON.stringify(
          {
            schemaVersion: 3,
            app: "EGuitarOmitrix",
            exportedAt: new Date().toISOString(),
            logs,
            goals,
            watches: study.records,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    "eguitar-practice.json",
  );
}
export async function previewBackup(file: File) {
  if (file.size > 20000000) throw Error("备份过大");
  const value: Backup = JSON.parse(await file.text());
  const logs = validateBackup(
    value,
    new Set(state.course!.entries.map((e) => e.id)),
  );
  const current = await allLogs(database());
  const goals = value.schemaVersion >= 2 ? value.goals! : null;
  mergeGoals(await readGoals(database()), goals);
  const watches = value.schemaVersion === 3 ? value.watches! : [];
  const a = mergePreview(current, logs),
    b = mergePreview((await readStudy(database())).records, watches);
  return {
    logs,
    goals,
    watches,
    additions: a.additions.length + b.additions.length,
    duplicates: a.duplicates + b.duplicates,
  };
}
export async function restoreBackup(
  value: Awaited<ReturnType<typeof previewBackup>>,
) {
  await importLogs(database(), value.logs, value.goals, value.watches);
  patch({
    logs: await allLogs(database()),
    goals: await readGoals(database()),
    watches: (await readStudy(database())).records,
    dialog: null,
  });
  notify("备份已导入");
}
export async function prepareForBackground() {
  sample();
  stopTunerCapture();
  stopPitchCapture("页面已离开，麦克风已停止。返回后可重新开启。");
  stopSound();
  // A finish transaction owns the draft until commit; a late background write
  // must not recreate the active draft after finishDraft deletes it.
  if (state.draft && release && !state.busy) await persist();
  await queue;
}
export async function prepareForClose() {
  if (state.busy) throw Error("正在保存练习，请稍后再退出应用。");
  if (state.dialog?.kind === "goals" || state.dialog?.kind === "result")
    throw Error("请先保存或关闭当前编辑，再退出应用。");
  await reviewQueue;
  stopTunerCapture();
  stopPitchCapture();
  await pause("应用已关闭，练习已暂停");
  await queue;
}
export async function prepareForUpdate() {
  if (
    state.busy ||
    state.draft?.finishing ||
    state.watchDraft ||
    watchBusy ||
    state.dialog
  )
    throw Error("请先保存或关闭当前编辑、练习结果和观看记录，再安装更新。");
  await prepareForClose();
  return true;
}
export async function initialize() {
  if (initialized) return;
  initialized = true;
  try {
    const [course, assignments] = await Promise.all([
      fetch("./data/course.json").then((r) => r.json()),
      fetch("./data/assignments.json").then((r) => r.json()),
    ]);
    patch({
      course: validateCourse(course),
      assignments: assignmentsSchema.parse(assignments),
    });
    await connectStorage();
  } catch (e) {
    patch({ fatal: `课程加载失败：${message(e)}` });
  }
  timer = setInterval(() => {
    if (!state.draft?.running || !release) {
      if (state.watchDraft) patch({});
      return;
    }
    sample();
    if (!state.draft.running) stopSound();
    void persist().catch((e) => {
      patch({ draft: recoverSession(draft()) });
      stopSound();
      notify(message(e));
    });
  }, 1000);
  window.addEventListener("hashchange", () =>
    run(async () => {
      setTool(null);
      setDialog(null);
      await prepareForBackground();
      await endWatch();
    }),
  );
  document.addEventListener("visibilitychange", () =>
    run(async () => {
      if (document.hidden) {
        if (state.watchDraft?.endedAt === null) watchAway = true;
        await prepareForBackground();
      } else {
        if (watchAway) await endWatch();
        await refresh();
      }
    }),
  );
  window.addEventListener("blur", () => {
    if (state.watchDraft?.endedAt === null) watchAway = true;
  });
  window.addEventListener("focus", () =>
    run(async () => {
      if (!document.hidden && watchAway) await endWatch();
    }),
  );
  window.addEventListener("pagehide", () => {
    run(prepareForBackground);
  });
  window.eguitarPauseForBackground = prepareForBackground;
  window.eguitarPrepareForUpdate = prepareForUpdate;
  window.eguitarPrepareForClose = prepareForClose;
}
export function disposeController() {
  clearInterval(timer);
  closeTuner();
  stopPitchCapture();
  closeScore();
  metro.stop();
  release?.();
  db?.close();
}
