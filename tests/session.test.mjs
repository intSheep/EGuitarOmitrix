import test from "node:test";
import assert from "node:assert/strict";
import {
  createSession,
  resumeSession,
  tickSession,
  pauseSession,
  recoverSession,
  sessionLog,
  dailySeconds,
  dayKey,
} from "../app/session.js";
import { validateLog } from "../app/practice-store.js";
const epoch = new Date(2026, 0, 1, 23, 59, 59).getTime();
const fresh = () =>
  resumeSession(createSession("123", "test", epoch, "synthetic"), epoch, 0);
test("pause and restored draft exclude absent time", () => {
  let s = tickSession(fresh(), epoch + 2000, 2000);
  s = pauseSession(s, epoch + 3000, 3000);
  s = resumeSession(recoverSession(s), epoch + 30000, 30000);
  s = tickSession(s, epoch + 31000, 31000);
  assert.equal(s.elapsedMs, 4000);
  assert.equal(s.intervals.length, 2);
  assert.equal(validateLog(sessionLog(s)).outcome, null);
});
test("clock discontinuities exclude gaps without changing manual run intent", () => {
  for (const [wall, mono] of [
    [2000, 4000],
    [-1, 1000],
  ]) {
    const s = tickSession(fresh(), epoch + wall, mono);
    assert.equal(s.running, true);
    assert.equal(s.elapsedMs, 0);
    assert.equal(s.lastWall, epoch + wall);
  }
});
test("midnight splits actual intervals into local dates", () => {
  const s = tickSession(fresh(), epoch + 3000, 3000),
    days = dailySeconds([sessionLog(s)]);
  assert.equal(days[dayKey(epoch)], 1);
  assert.equal(days[dayKey(epoch + 3000)], 2);
});
test("empty sessions cannot be saved and malformed timer totals rejected", () => {
  assert.throws(() => sessionLog(fresh()));
  const l = sessionLog(tickSession(fresh(), epoch + 2000, 2000));
  assert.throws(() => validateLog({ ...l, seconds: 3 }));
});

test('ordinary delayed callbacks and background throttling do not pause or lose time',()=>{
  const s=tickSession(fresh(),epoch+60000,60000);
  assert.equal(s.running,true);assert.equal(s.elapsedMs,60000);
  assert.equal(s.intervals.length,1);
  assert.equal(validateLog(sessionLog(s)).seconds,60);
});

test('a backward wall clock cannot overlap already counted intervals',()=>{
  let s=tickSession(fresh(),epoch+1000,1000);
  s=tickSession(s,epoch,2000);
  s=tickSession(s,epoch+500,2500);
  assert.equal(s.running,true);assert.equal(s.elapsedMs,1000);
  s=tickSession(s,epoch+2000,4000);
  assert.equal(s.elapsedMs,2000);validateLog(sessionLog(s));
});
