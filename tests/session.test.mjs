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
test("sleep and clock jumps pause without adding gaps", () => {
  for (const [wall, mono] of [
    [20000, 20000],
    [2000, 4000],
    [-1, 1000],
  ]) {
    const s = tickSession(fresh(), epoch + wall, mono);
    assert.equal(s.running, false);
    assert.equal(s.elapsedMs, 0);
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
