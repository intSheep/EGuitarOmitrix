// Pure clock accounting: only observed, foreground intervals count.
export function createSession(
  entryId,
  assignmentVersion,
  now = Date.now(),
  id = crypto.randomUUID(),
) {
  return {
    id,
    entryId,
    assignmentVersion,
    createdAt: new Date(now).toISOString(),
    running: false,
    elapsedMs: 0,
    intervals: [],
    lastWall: null,
    lastMono: null,
    reason: "",
  };
}
export function resumeSession(s, wall, mono) {
  return { ...s, running: true, lastWall: wall, lastMono: mono, reason: "" };
}
export function tickSession(s, wall, mono) {
  if (!s.running) return s;
  const dw = wall - s.lastWall,
    dm = mono - s.lastMono;
  if (dw < 0 || dm < 0 || dw > 5000 || dm > 5000 || Math.abs(dw - dm) > 1000)
    return {
      ...s,
      running: false,
      lastWall: null,
      lastMono: null,
      reason: "检测到中断，计时已暂停",
    };
  const counted = Math.min(dw, 86400000 - s.elapsedMs);
  wall = s.lastWall + counted;
  const intervals = s.intervals.map((i) => ({ ...i }));
  if (dw > 0) {
    const last = intervals.at(-1);
    if (last && last.end === s.lastWall) last.end = wall;
    else intervals.push({ start: s.lastWall, end: wall });
  }
  const elapsedMs = s.elapsedMs + counted;
  return {
    ...s,
    elapsedMs,
    intervals,
    lastWall: wall,
    lastMono: mono,
    running: elapsedMs < 86400000,
    reason: elapsedMs >= 86400000 ? "本次练习已达24小时，请结束保存" : "",
  };
}
export function pauseSession(s, wall, mono, reason = "已暂停") {
  return {
    ...tickSession(s, wall, mono),
    running: false,
    lastWall: null,
    lastMono: null,
    reason,
  };
}
export function recoverSession(s) {
  return {
    ...s,
    running: false,
    lastWall: null,
    lastMono: null,
    reason: "上次练习尚未结束",
  };
}
export function sessionLog(s, now = Date.now()) {
  if (s.elapsedMs < 1000) throw new Error("练习不足1秒，暂不计入总结");
  return {
    id: s.id,
    entryId: s.entryId,
    assignmentVersion: s.assignmentVersion,
    source: "timer",
    seconds: s.elapsedMs / 1000,
    minutes: s.elapsedMs / 60000,
    intervals: s.intervals,
    practicedAt: s.createdAt,
    createdAt: s.createdAt,
    updatedAt: new Date(now).toISOString(),
    outcome: null,
    bpm: null,
    note: "",
    nextFocus: "",
    deletedAt: null,
  };
}
export function dayKey(time) {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function dailySeconds(logs) {
  const days = {};
  for (const l of logs.filter((l) => !l.deletedAt)) {
    if (l.source === "timer" && l.intervals?.length) {
      for (const i of l.intervals) {
        let start = i.start;
        while (start < i.end) {
          const midnight = new Date(start);
          midnight.setHours(24, 0, 0, 0);
          const end = Math.min(i.end, midnight.getTime());
          const key = dayKey(start);
          days[key] = (days[key] || 0) + (end - start) / 1000;
          start = end;
        }
      }
    } else {
      const key = dayKey(l.practicedAt);
      days[key] = (days[key] || 0) + l.minutes * 60;
    }
  }
  return days;
}
