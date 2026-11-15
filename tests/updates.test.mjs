import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { createUpdateController, createMacUpdater, isNewerVersion, allowedReleaseURL } from '../desktop/updates.cjs';
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

test('taskbar progress is bounded and always cleared after a failed download', async () => {
  const updater = new EventEmitter(), progress = [];
  updater.checkForUpdates = async () => { updater.emit('update-available', {version:'0.5.0'}); return {}; };
  updater.downloadUpdate = async () => { updater.emit('download-progress', {percent:45}); updater.emit('download-progress', {percent:250}); throw Error('synthetic network error'); };
  const controller = createUpdateController({updater, ask:async()=>({response:1}), prepare:async()=>true, installing:()=>assert.fail('must not install'), progress:value=>progress.push(value)});
  await controller.check();
  assert.deepEqual(progress, [2,0,.45,1,-1]);
});

test('mac updater verifies release manifest, SHA-256 and delegates bundle replacement after save barrier', async () => {
  assert.equal(isNewerVersion('0.5.1', '0.5.0'), true);
  assert.equal(isNewerVersion('0.5.0', '0.5.0'), false);
  assert.equal(allowedReleaseURL('https://api.github.com/repos/intSheep/EGuitarOmitrix/releases/latest'), true);
  assert.equal(allowedReleaseURL('https://evil.example.com/release.zip'), false);

  const zipBytes = Buffer.from('SYNTHETIC_MAC_ZIP_PAYLOAD');
  const sha256 = createHash('sha256').update(zipBytes).digest('hex');
  const installed = [];
  const fetchImpl = async url => {
    if (url.endsWith('/releases/latest')) {
      return {
        status: 200, ok: true, headers: new Map(),
        text: async () => JSON.stringify({
          draft: false, prerelease: false, tag_name: 'v0.5.1',
          assets: [
            { name: 'mac-manifest.json', browser_download_url: 'https://github.com/intSheep/EGuitarOmitrix/releases/download/v0.5.1/mac-manifest.json' },
            { name: 'EGuitarOmitrix-0.5.1-mac-arm64.zip', browser_download_url: 'https://objects.githubusercontent.com/synthetic/EGuitarOmitrix-0.5.1-mac-arm64.zip' },
          ],
        }),
      };
    }
    if (url.endsWith('/mac-manifest.json')) {
      return {
        status: 200, ok: true, headers: new Map(),
        text: async () => JSON.stringify({
          version: '0.5.1', platform: 'mac',
          artifacts: [{ name: 'EGuitarOmitrix-0.5.1-mac-arm64.zip', bytes: zipBytes.length, sha256 }],
        }),
      };
    }
    return {
      status: 200, ok: true, headers: new Map(),
      body: (async function* () { yield zipBytes; })(),
    };
  };
  const updater = createMacUpdater({
    currentVersion: '0.5.0', arch: 'arm64',
    exePath: '/Applications/帅帅练琴屋.app/Contents/MacOS/帅帅练琴屋',
    fetchImpl,
    installBundle: info => installed.push(info),
  });
  const controller = createUpdateController({
    updater,
    ask: async () => ({ response: 1 }),
    prepare: async () => true,
    installing: () => {},
  });
  await controller.check();
  assert.equal(installed.length, 1);
  assert.equal(installed[0].bundle, '/Applications/帅帅练琴屋.app');
});
