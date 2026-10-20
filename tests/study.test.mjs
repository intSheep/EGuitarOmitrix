import test from 'node:test';
import assert from 'node:assert/strict';
import { beginWatch, stopWatch, watchSeconds, confirmWatch, totalWatchSeconds, validateWatch, parseWatchTime } from '../app/study.js';
import { validateBackup, mergePreview } from '../app/practice-store.js';
import { emptyGoals } from '../app/guidance.js';
const start = Date.parse('2026-01-01T00:00:00Z');
const stopped = () => stopWatch(beginWatch('123', start, 'synthetic-watch'), start + 90000);
test('external viewing survives hidden time and freezes on return without becoming practice', () => {
  const watching = beginWatch('123', start, 'synthetic-watch');
  assert.equal(watchSeconds(watching, start + 60000), 60);
  const ended = stopWatch(watching, start + 90000);
  assert.equal(watchSeconds(ended, start + 900000), 90);
  assert.equal(stopWatch(ended, start + 180000).endedAt, ended.endedAt);
  const record = confirmWatch(ended, 60);
  assert.equal(record.seconds, 60);
  assert.equal(record.outcome, undefined);
  assert.equal(record.bpm, undefined);
});
test('confirmation requires positive bounded actual time and a completed interval', () => {
  assert.equal(parseWatchTime('03:20'), 200);
  for (const value of ['3', '3:80', '-1:00', '1.5:00', '00:00x']) assert.throws(() => parseWatchTime(value));
  for (const seconds of [0, -1, 90.5, 91, Infinity, NaN]) assert.throws(() => confirmWatch(stopped(), seconds));
  assert.throws(() => confirmWatch(beginWatch('123', start, 'synthetic-watch'), 30));
  assert.throws(() => validateWatch({...confirmWatch(stopped(), 30), endedAt: start - 1}));
  assert.throws(() => validateWatch({...confirmWatch(stopped(), 30), deletedAt: 12}));
  assert.equal(watchSeconds(beginWatch('123', start, 'synthetic-watch'), start - 1000), 0);
});
test('watch totals exclude deletions and preserve source identity', () => {
  const a = confirmWatch(stopped(), 60);
  const b = {...a, id:'synthetic-other', entryId:'456', seconds:30};
  assert.equal(totalWatchSeconds([a,b]), 90);
  assert.equal(totalWatchSeconds([a,b], '123'), 60);
  assert.equal(totalWatchSeconds([{...a, deletedAt:new Date().toISOString()}, b]), 30);
});
test('v3 backups validate watches independently and preserve older backup support', () => {
  const record = confirmWatch(stopped(), 60), entryIds = new Set(['123']);
  const backup = {app:'EGuitarOmitrix', schemaVersion:3, logs:[], goals:emptyGoals(), watches:[record]};
  assert.deepEqual(validateBackup(backup, entryIds), []);
  assert.throws(() => validateBackup({...backup,watches:[record,record]}, entryIds));
  assert.throws(() => validateBackup({...backup,watches:[{...record,entryId:'456'}]}, entryIds));
  assert.throws(() => validateBackup({...backup,schemaVersion:4}, entryIds));
  assert.deepEqual(validateBackup({app:backup.app,schemaVersion:1,logs:[]}, entryIds), []);
  assert.deepEqual(validateBackup({app:backup.app,schemaVersion:2,logs:[],goals:emptyGoals()}, entryIds), []);
  assert.equal(mergePreview([record], [record]).duplicates, 1);
  assert.throws(() => mergePreview([record], [{...record,seconds:30}]));
});
