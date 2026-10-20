// External video time is a learner-confirmed interval, never playback evidence.
export function beginWatch(entryId, now = Date.now(), id = crypto.randomUUID()) {
  return { id, entryId, startedAt: now, endedAt: null };
}
export function stopWatch(watch, now = Date.now()) {
  return watch.endedAt === null ? { ...watch, endedAt: Math.max(watch.startedAt, now) } : watch;
}
export function watchSeconds(watch, now = Date.now()) {
  return Math.max(0, Math.floor(((watch.endedAt ?? now) - watch.startedAt) / 1000));
}
export function parseWatchTime(value) {
  if (!/^\d{1,4}:[0-5]\d$/.test(value)) throw Error('请按 分:秒 填写看课时长');
  const [minutes, seconds] = value.split(':').map(Number);
  return minutes * 60 + seconds;
}
export function confirmWatch(watch, seconds, now = Date.now()) {
  const record = { ...watch, seconds, confirmedAt: new Date(now).toISOString(), deletedAt: null };
  return validateWatch(record);
}
export function validateWatch(record) {
  if (!record || typeof record.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(record.id) ||
      typeof record.entryId !== 'string' || !/^\d+$/.test(record.entryId) ||
      !Number.isSafeInteger(record.startedAt) || record.startedAt < 0 ||
      !Number.isFinite(record.endedAt) || record.endedAt < record.startedAt || record.endedAt > Date.now() + 60000 ||
      !Number.isInteger(record.seconds) || record.seconds < 1 || record.seconds > 86400 || record.seconds > watchSeconds(record) ||
      typeof record.confirmedAt !== 'string' || !Number.isFinite(Date.parse(record.confirmedAt)) || Date.parse(record.confirmedAt) < record.endedAt ||
      (record.deletedAt !== null && (typeof record.deletedAt !== 'string' || !Number.isFinite(Date.parse(record.deletedAt))))) {
    throw Error('看课记录无效，请确认实际看课时间。');
  }
  return record;
}
export function validateWatches(records, entryIds) {
  if (!Array.isArray(records) || records.length > 100000) throw Error('看课备份格式无效');
  const ids = new Set();
  for (const record of records) {
    validateWatch(record);
    if (ids.has(record.id) || !entryIds.has(record.entryId)) throw Error('看课备份包含重复记录或未知课程');
    ids.add(record.id);
  }
  return records;
}
export function totalWatchSeconds(records, entryId) {
  return records.filter(r => !r.deletedAt && (!entryId || r.entryId === entryId)).reduce((n, r) => n + r.seconds, 0);
}
