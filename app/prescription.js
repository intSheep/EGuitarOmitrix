import { dailySeconds, dayKey } from './session.js';

// Use reviewed fields, never recover a missing dose from an uncertain quote.
export function teacherPrescription(assignment) {
  const evidence = assignment?.evidence;
  const sourced = !!evidence && typeof evidence.sha256 === 'string' && /^[a-f0-9]{64}$/.test(evidence.sha256)
    && Number.isFinite(evidence.from) && Number.isFinite(evidence.to) && evidence.to > evidence.from;
  const dailyMinutes = sourced && Number.isFinite(assignment.dailyMinutes) && assignment.dailyMinutes > 0
    ? assignment.dailyMinutes : null;
  const raw = sourced && typeof assignment.tempo === 'string' ? assignment.tempo : '';
  const tempo = raw.replace('字幕目标为', '目标')
    .replace(/目标待听校|最终数值未明确/g, '目标 BPM 未明确');
  const noMetronome = /不用|不使用|不需要|不跟节拍器/.test(raw);
  const fixed = raw.match(/^固定\s+(\d+)\s*BPM/);
  // Only unambiguous whole-exercise starting speeds. Do not extract the 50 in 50%.
  const initial = raw.match(/^(\d+)\s*BPM\s*起步/) || raw.match(/^每天从\s*(\d+)\s*BPM/) || raw.match(/^(?:每天\s*)?(\d+)\s*→\s*\d+\s*BPM/);
  return {dailyMinutes, tempo: tempo || 'BPM 未明确', noMetronome,
    fixedBpm: noMetronome ? null : fixed ? Number(fixed[1]) : null,
    startBpm: noMetronome ? null : fixed ? Number(fixed[1]) : initial ? Number(initial[1]) : null};
}

export function todayPractice(logs, draft, assignment, now = Date.now()) {
  const eligible = logs.filter(l => !l.deletedAt && l.entryId === assignment?.entryId && l.assignmentVersion === assignment?.version);
  const records = [...eligible];
  if (draft && assignment && draft.entryId === assignment.entryId && draft?.assignmentVersion === assignment?.version
      && !logs.some(l => l.id === draft.id) && draft.intervals?.length) {
    records.push({source:'timer',intervals:draft.intervals,minutes:draft.elapsedMs/60000,practicedAt:draft.createdAt});
  }
  const seconds = Math.floor(dailySeconds(records)[dayKey(now)] || 0);
  const minutes = teacherPrescription(assignment).dailyMinutes;
  const targetSeconds = minutes === null ? null : minutes * 60;
  return {seconds, targetSeconds, remainingSeconds: targetSeconds === null ? null : Math.max(0, Math.ceil(targetSeconds-seconds)),
    completed: targetSeconds !== null && seconds >= targetSeconds};
}
