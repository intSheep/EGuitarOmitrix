import { emptyGoals, validateGoals, mergeGoals } from "./guidance.js";
export const OUTCOMES = {
  learning: "还不熟",
  slow: "能慢速完成",
  steady: "基本顺畅",
  mastered: "已掌握",
  review: "可以复习",
};
export const DB_NAME = "eguitar-practice-v1";
export function validateLog(log) {
  if (
    !log ||
    typeof log.id !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(log.id) ||
    !/^\d+$/.test(log.entryId) ||
    typeof log.assignmentVersion !== "string" ||
    !Number.isFinite(log.minutes) ||
    log.minutes <= 0 ||
    log.minutes > 1440 ||
    !(
      Object.hasOwn(OUTCOMES, log.outcome) ||
      (log.source === "timer" && log.outcome === null)
    ) ||
    (log.bpm !== null &&
      (!Number.isInteger(log.bpm) || log.bpm < 1 || log.bpm > 400)) ||
    !["practicedAt", "createdAt", "updatedAt"].every(
      (k) => typeof log[k] === "string" && Number.isFinite(Date.parse(log[k])),
    ) ||
    Date.parse(log.practicedAt) > Date.now() + 60000 ||
    !["note", "nextFocus"].every(
      (k) => typeof log[k] === "string" && log[k].length <= 2000,
    ) ||
    (log.deletedAt !== null &&
      (typeof log.deletedAt !== "string" ||
        !Number.isFinite(Date.parse(log.deletedAt))))
  ) {
    throw new Error("练习记录格式无效：检查时间、分钟数、程度和 BPM。");
  }
  if (log.source === "timer") {
    if (
      !Number.isFinite(log.seconds) ||
      log.seconds < 1 ||
      Math.abs(log.minutes * 60 - log.seconds) > 0.001 ||
      !Array.isArray(log.intervals) ||
      log.intervals.length === 0
    )
      throw new Error("计时记录无效");
    let sum = 0,
      previous = 0;
    for (const i of log.intervals) {
      if (
        !Number.isFinite(i.start) ||
        !Number.isFinite(i.end) ||
        i.start < previous ||
        i.end < i.start ||
        i.end > Date.now() + 60000
      )
        throw new Error("计时间隔无效");
      sum += i.end - i.start;
      previous = i.end;
    }
    if (Math.abs(sum / 1000 - log.seconds) > 0.001)
      throw new Error("计时总量不一致");
  }
  if (log.bpmBasis !== undefined && log.bpmBasis !== 'self-reported-stable') throw Error('BPM 来源无效');
  if (log.tempoUsage !== undefined) {
    if (!Array.isArray(log.tempoUsage) || log.tempoUsage.length > 281 || log.tempoUsage.some(x => !x || !Number.isInteger(x.bpm) || x.bpm < 20 || x.bpm > 300 || !Number.isFinite(x.seconds) || x.seconds <= 0) || new Set(log.tempoUsage.map(x=>x.bpm)).size !== log.tempoUsage.length || log.tempoUsage.reduce((n,x)=>n+x.seconds,0) > log.minutes * 60 + .001) throw Error('节拍器使用记录无效');
  }
  if (log.goal != null) validateGoals({weeklySessions:null,lessons:{[log.entryId]:log.goal}});
  return log;
}
export function activeLogs(logs) {
  return logs
    .filter((l) => !l.deletedAt)
    .sort(
      (a, b) =>
        Date.parse(b.practicedAt) - Date.parse(a.practicedAt) ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
}
export function latestLog(logs, entryId) {
  return activeLogs(logs).find((l) => !entryId || l.entryId === entryId);
}
export function validateBackup(value, entryIds) {
  if (
    ![1, 2].includes(value?.schemaVersion) ||
    value.app !== "EGuitarOmitrix" ||
    !Array.isArray(value.logs) ||
    value.logs.length > 100000
  )
    throw new Error("备份格式或版本不支持，现有记录未修改。");
  if (value.schemaVersion === 2) validateGoals(value.goals, entryIds);
  const ids = new Set();
  for (const log of value.logs) {
    validateLog(log);
    if (ids.has(log.id) || !entryIds.has(log.entryId))
      throw new Error("备份包含重复记录或未知课程，现有记录未修改。");
    ids.add(log.id);
  }
  return value.logs;
}
export function mergePreview(existing, incoming) {
  const byId = new Map(existing.map((l) => [l.id, l]));
  const additions = [];
  let duplicates = 0;
  for (const log of incoming) {
    const old = byId.get(log.id);
    if (!old) additions.push(log);
    else if (
      JSON.stringify(
        Object.keys(old)
          .sort()
          .map((k) => [k, old[k]]),
      ) ===
      JSON.stringify(
        Object.keys(log)
          .sort()
          .map((k) => [k, log[k]]),
      )
    )
      duplicates++;
    else
      throw new Error(
        "备份与当前记录存在同 ID 的不同版本。为保留双方内容，本次未导入；请先分别导出保存。",
      );
  }
  return { additions, duplicates };
}
export function openPracticeDB({ onBlocked = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("logs"))
        req.result.createObjectStore("logs", { keyPath: "id" });
      if (!req.result.objectStoreNames.contains("session"))
        req.result.createObjectStore("session");
    };
    req.onerror = () =>
      reject(new Error("无法打开本地练习数据库。请检查浏览器存储权限。"));
    // Keep the request pending: IndexedDB resumes it when old connections close.
    req.onblocked = () => onBlocked();
    req.onsuccess = () => {
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
  });
}
export function allLogs(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("logs", "readonly");
    const req = tx.objectStore("logs").getAll();
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export function saveLog(db, log, expectedUpdatedAt = null) {
  validateLog(log);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("logs", "readwrite"),
      store = tx.objectStore("logs");
    let conflict = false;
    const req = store.get(log.id);
    req.onsuccess = () => {
      if ((req.result?.updatedAt ?? null) !== expectedUpdatedAt) {
        conflict = true;
        tx.abort();
        return;
      }
      try {
        store.put(log);
      } catch {
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(log);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(
        new Error(
          conflict
            ? "此记录已在另一窗口更新，请重新打开后编辑。"
            : "保存失败，输入仍保留，请重试或检查存储空间。",
        ),
      );
  });
}
export function importLogs(db, logs, goals = null) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["logs", "session"], "readwrite"),
      store = tx.objectStore("logs");
    let failure;
    const req = store.getAll();
    req.onsuccess = () => {
      try {
        const { additions } = mergePreview(req.result, logs);
        additions.forEach((l) => store.add(l));
        if (goals) {
          const request = tx.objectStore('session').get('goals');
          request.onsuccess = () => {
            try { tx.objectStore('session').put(mergeGoals(request.result || emptyGoals(), goals), 'goals'); }
            catch(e) { failure = e; tx.abort(); }
          };
        }
      } catch (e) {
        failure = e;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(failure || new Error("导入失败，现有记录未修改。"));
  });
}

export function readDraft(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("session");
    const r = tx.objectStore("session").get("active");
    tx.oncomplete = () => resolve(r.result || null);
    tx.onabort = () => reject(tx.error);
  });
}
export function writeDraft(db, draft) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("session", "readwrite");
    const store = tx.objectStore("session");
    if (draft) store.put(draft, "active");
    else store.delete("active");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(new Error("练习进度未能保存，请重试"));
    tx.onabort = () => reject(new Error("练习进度未能保存，请重试"));
  });
}
export function finishDraft(db, log) {
  validateLog(log);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["logs", "session"], "readwrite"),
      store = tx.objectStore("logs");
    let conflict = false;
    const r = store.get(log.id);
    r.onsuccess = () => {
      if (r.result) {
        conflict = true;
        tx.abort();
        return;
      }
      try {
        store.add(log);
        tx.objectStore("session").delete("active");
      } catch { tx.abort(); }
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(new Error("保存失败，本次练习仍保留，请重试"));
    tx.onabort = () =>
      reject(
        new Error(
          conflict
            ? "本次练习已保存，请刷新查看"
            : "保存失败，本次练习仍保留，请重试",
        ),
      );
  });
}

export function readGoals(db) {
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('session'),r=tx.objectStore('session').get('goals');
    tx.oncomplete=()=>resolve(r.result || emptyGoals()); tx.onabort=()=>reject(tx.error);
  });
}
export function saveGoals(db, goals, expected) {
  validateGoals(goals);
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('session','readwrite'),store=tx.objectStore('session'),r=store.get('goals');
    let conflict=false;
    r.onsuccess=()=>{ if(JSON.stringify(r.result || emptyGoals())!==JSON.stringify(expected)){conflict=true;tx.abort();}else store.put(goals,'goals'); };
    tx.oncomplete=resolve;tx.onabort=()=>reject(Error(conflict?'目标已在另一窗口更改，请重新打开':'目标保存失败，请重试'));
  });
}
