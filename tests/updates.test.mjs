import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createUpdateController, createMacUpdater, isNewerVersion, allowedReleaseURL, replaceMacBundle } from '../desktop/updates.cjs';
function fixture({ responses = [1, 1], downloadError, saveError, checkError, installError, version = '0.5.0' } = {}) {
  const events = [], dialogs = [];
  const updater = new EventEmitter();
  updater.checkForUpdates = async () => { events.push('check'); if (checkError) throw Error('synthetic offline'); updater.emit(version ? 'update-available' : 'update-not-available', { version }); return {}; };
  updater.downloadUpdate = async () => { events.push('download'); if (downloadError) throw Error('synthetic checksum failure'); };
  updater.quitAndInstall = async () => { events.push('install'); if (installError) throw Error('synthetic permission denied'); };
  const controller = createUpdateController({ updater,
    ask: async options => { dialogs.push(options); return { response: responses.shift() ?? 0 }; },
    prepare: async () => { events.push('save'); if (saveError) throw Error('synthetic storage failure'); return true; },
    installing: () => events.push('quitting'),
    failed: () => events.push('failed'),
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

test('startup checks are silent unless a compatible new version is found', async () => {
  for (const options of [{ version: null }, { checkError: true }]) {
    const f = fixture(options);
    await f.controller.check({ automatic: true });
    assert.deepEqual(f.events, ['check']);
    assert.deepEqual(f.dialogs, []);
  }
  const f = fixture({ responses: [0] });
  await f.controller.check({ automatic: true });
  assert.match(f.dialogs[0].message, /发现新版本 0.5.0/);
  assert.deepEqual(f.events, ['check']);
});

test('async install failures reset the quit state and show the error', async () => {
  const f = fixture({ installError: true });
  await f.controller.check();
  assert.deepEqual(f.events, ['check', 'download', 'save', 'quitting', 'install', 'failed']);
  assert.match(f.dialogs.at(-1).detail, /permission denied/);
});

test('bundle replacement restores the prior app after a failed second rename', async () => {
  const moves = [];
  await assert.rejects(replaceMacBundle('candidate', 'current', 'backup', async (from, to) => {
    moves.push([from, to]);
    if (from === 'candidate') throw Error('synthetic permission denied');
  }), /permission denied/);
  assert.deepEqual(moves, [['current', 'backup'], ['candidate', 'current'], ['backup', 'current']]);
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


test('macOS extracts and replaces a validated bundle, restoring the old bundle if relaunch fails', {
  skip: process.platform !== 'darwin',
}, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'eguitar-synthetic-replace-'));
  const bundleName = '帅帅练琴屋.app';
  const bundle = path.join(root, 'installed.app');
  const executable = path.join(bundle, 'Contents', 'MacOS', '帅帅练琴屋');
  const plist = path.join(root, bundleName, 'Contents', 'Info.plist');
  const contents = path.dirname(plist);
  const resources = path.join(contents, 'Resources');
  try {
    await mkdir(path.dirname(executable), { recursive: true });
    await writeFile(executable, 'synthetic old executable');
    await mkdir(path.join(resources, 'web'), { recursive: true });
    await mkdir(path.join(contents, 'MacOS'), { recursive: true });
    await writeFile(path.join(contents, 'MacOS', '帅帅练琴屋'), 'synthetic new executable', { mode: 0o755 });
    await writeFile(path.join(resources, 'app.asar'), 'synthetic app data');
    await writeFile(path.join(resources, 'web', 'build-info.json'), '{"version":"0.6.1"}');
    await writeFile(plist, `<?xml version="1.0" encoding="UTF-8"?>
      <plist version="1.0"><dict>
      <key>CFBundleIdentifier</key><string>io.github.intsheep.eguitaromitrix</string>
      <key>CFBundleExecutable</key><string>帅帅练琴屋</string>
      <key>CFBundleShortVersionString</key><string>0.6.1</string>
      </dict></plist>`);
    const archive = path.join(root, 'candidate.zip');
    execFileSync('/usr/bin/ditto', ['-c', '-k', '--keepParent', path.dirname(contents), archive]);
    const zip = await readFile(archive);
    const zipName = 'EGuitarOmitrix-0.6.1-mac-arm64.zip';
    const url = name => 'https://github.com/intSheep/EGuitarOmitrix/releases/download/v0.6.1/' + name;
    const fetchImpl = async value => value.endsWith('/releases/latest')
      ? Response.json({ tag_name: 'v0.6.1', assets: ['mac-manifest.json', zipName].map(name => ({ name, browser_download_url: url(name) })) })
      : value.endsWith('/mac-manifest.json')
        ? Response.json({ version: '0.6.1', platform: 'mac', artifacts: [{ name: zipName, bytes: zip.length, sha256: createHash('sha256').update(zip).digest('hex') }] })
        : new Response(zip);
    let relaunchFails = true;
    const lifecycle = [];
    const updater = createMacUpdater({ currentVersion: '0.6.0', arch: 'arm64', exePath: executable, fetchImpl, app: {
      relaunch: options => {
        assert.equal(options.execPath, executable);
        if (relaunchFails) throw Error('synthetic relaunch failure');
        lifecycle.push('relaunch');
      },
      exit: code => { assert.equal(code, 0); lifecycle.push('exit'); },
    } });
    try {
      await updater.checkForUpdates();
      await updater.downloadUpdate();
      await assert.rejects(updater.quitAndInstall(), /synthetic relaunch failure/);
      assert.equal(await readFile(executable, 'utf8'), 'synthetic old executable');
      relaunchFails = false;
      await updater.quitAndInstall();
      assert.equal(await readFile(executable, 'utf8'), 'synthetic new executable');
      assert.deepEqual(lifecycle, ['relaunch', 'exit']);
    } finally {
      await updater.discardDownload();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
