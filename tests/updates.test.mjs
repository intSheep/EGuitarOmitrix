import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createUpdateController } from '../desktop/updates.cjs';
function fixture({ responses = [1, 1], downloadError, saveError, version = '0.5.0' } = {}) {
  const events = [], dialogs = [];
  const updater = new EventEmitter();
  updater.checkForUpdates = async () => { events.push('check'); updater.emit(version ? 'update-available' : 'update-not-available', { version }); return {}; };
  updater.downloadUpdate = async () => { events.push('download'); if (downloadError) throw Error('synthetic checksum failure'); };
  updater.quitAndInstall = () => events.push('install');
  const controller = createUpdateController({ updater,
    ask: async options => { dialogs.push(options); return { response: responses.shift() ?? 0 }; },
    prepare: async () => { events.push('save'); if (saveError) throw Error('synthetic storage failure'); return true; },
    installing: () => events.push('quitting'),
  });
  return { updater, controller, events, dialogs };
}
test('update saves before install, disables implicit install and excludes prereleases', async () => {
  const f = fixture(); await f.controller.check();
  assert.deepEqual(f.events, ['check', 'download', 'save', 'quitting', 'install']);
  for (const key of ['autoDownload', 'autoInstallOnAppQuit', 'allowPrerelease', 'allowDowngrade']) assert.equal(f.updater[key], false);
});
test('declining download or install does not quit or mutate practice', async () => {
  for (const [responses, expected] of [[[0], ['check']], [[1, 0], ['check', 'download']]]) {
    const f = fixture({ responses }); await f.controller.check(); assert.deepEqual(f.events, expected);
  }
});
test('failed checksum or persistence never installs; checking can be retried', async () => {
  for (const opts of [{ downloadError: true }, { saveError: true }]) {
    const f = fixture(opts); await f.controller.check();
    assert.ok(!f.events.includes('install')); assert.equal(f.dialogs.at(-1).type, 'error');
    await f.controller.check(); assert.equal(f.events.filter(e => e === 'check').length, 2);
  }
});
test('concurrent check is ignored, and current version never downloads', async () => {
  const f = fixture({ version: null }); await Promise.all([f.controller.check(), f.controller.check()]);
  assert.deepEqual(f.events, ['check']); assert.equal(f.dialogs[0].type, 'info');
});
