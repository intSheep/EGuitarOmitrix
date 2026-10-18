import { teacherPrescription } from "./prescription.js";
// Learner plans and self-reports never rewrite instructor prescriptions.
export const FINISH_OUTCOMES = { learning: '还不熟', steady: '基本顺畅', mastered: '已掌握' };
export const emptyGoals = () => ({ weeklySessions: null, lessons: {} });
export function optionalNumber(value, min, max) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw Error(`请输入 ${min}–${max} 之间的整数，或留空`);
  return n;
}
export function validateGoals(value, ids) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !value.lessons || typeof value.lessons !== 'object' || Array.isArray(value.lessons)) throw Error('练习目标格式无效');
  const valid = (n, max) => n === null || (Number.isInteger(n) && n >= 1 && n <= max);
  if (!valid(value.weeklySessions, 21)) throw Error('每周练习次数无效');
  for (const [id,g] of Object.entries(value.lessons)) {
    if (!/^\d+$/.test(id) || (ids && !ids.has(id)) || !g || !valid(g.minutes, 240) || !valid(g.bpm, 400)) throw Error('课程练习目标无效');
  }
  return value;
}
export function mergeGoals(existing, incoming) {
  if (!incoming) return existing;
  validateGoals(existing); validateGoals(incoming);
  if (existing.weeklySessions !== null && incoming.weeklySessions !== null && existing.weeklySessions !== incoming.weeklySessions) throw Error('备份与当前每周目标不同，未导入；请先分别备份');
  const lessons = {...existing.lessons};
  for (const [id,g] of Object.entries(incoming.lessons)) {
    if (lessons[id] && (lessons[id].minutes !== g.minutes || lessons[id].bpm !== g.bpm)) throw Error('备份与当前课程目标不同，未导入；请先分别备份');
    lessons[id] = g;
  }
  return {weeklySessions: existing.weeklySessions ?? incoming.weeklySessions, lessons};
}
export function resumeGuidance(logs, id, version, assignment) {
  const last = logs.filter(l=>!l.deletedAt && l.entryId===id && l.assignmentVersion===version)
    .sort((a,b)=>Date.parse(b.practicedAt)-Date.parse(a.practicedAt))[0];
  const prescription = teacherPrescription(assignment);
  const forbidden = prescription.noMetronome;
  const fixed = prescription.fixedBpm;
  const stable = last?.bpmBasis === 'self-reported-stable' ? last.bpm : null;
  const usable = fixed || (stable >= 20 && stable <= 300 ? stable : null);
  return {last, bpm: forbidden ? null : usable, fixed, forbidden,
    action: last?.outcome === 'learning' ? '继续巩固这一段' : last?.outcome === 'mastered' ? '复习已掌握的内容' : '接着上次练习'};
}
