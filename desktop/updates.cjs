// Main-process update authority. The renderer can request a check only; native dialogs control download/install.
const { createHash } = require('node:crypto');
const { constants, createWriteStream } = require('node:fs');
const { access, mkdtemp, readFile, rename, rm, stat } = require('node:fs/promises');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');

const RELEASES_API = 'https://api.github.com/repos/intSheep/EGuitarOmitrix/releases/latest';
const MAX_MAC_ZIP = 512 * 1024 * 1024;
const MAC_BUNDLE_ID = 'io.github.intsheep.eguitaromitrix';

function runFile(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (error, stdout) => (error ? reject(error) : resolve(stdout)));
  });
}

function versionTuple(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version || '').trim());
  if (!m) throw Error('版本号格式无效');
  const parts = m.slice(1).map(Number);
  if (parts.some(n => !Number.isInteger(n) || n < 0 || n > 999)) throw Error('版本号超出范围');
  return parts;
}

function isNewerVersion(candidate, current) {
  const a = versionTuple(candidate), b = versionTuple(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

function allowedReleaseURL(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
    return u.hostname === 'api.github.com' || u.hostname === 'github.com' || u.hostname.endsWith('.githubusercontent.com');
  } catch { return false; }
}

async function fetchReleaseStream(url, fetchImpl = fetch) {
  let current = url;
  for (let redirects = 0; redirects < 6; redirects++) {
    if (!allowedReleaseURL(current)) throw Error('更新地址不在允许范围内');
    const response = await fetchImpl(current, {
      redirect: 'manual',
      headers: { 'User-Agent': 'EGuitarOmitrix-Desktop', Accept: 'application/vnd.github+json, application/octet-stream, */*' },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw Error('更新重定向地址缺失');
      current = new URL(location, current).href;
      continue;
    }
    if (!response.ok) throw Error('更新服务器返回 ' + response.status);
    return response;
  }
  throw Error('更新重定向次数过多');
}

async function fetchReleaseJSON(url, fetchImpl = fetch) {
  const res = await fetchReleaseStream(url, fetchImpl);
  const text = await res.text();
  if (text.length > 2 * 1024 * 1024) throw Error('版本清单体积过大');
  return JSON.parse(text);
}

async function replaceMacBundle(candidate, bundle, backup, move = rename) {
  await move(bundle, backup);
  try {
    await move(candidate, bundle);
  } catch (installError) {
    try {
      await move(backup, bundle);
    } catch (rollbackError) {
      throw Error('无法恢复旧版。旧应用保存在 ' + backup + '\n' + rollbackError.message, { cause: installError });
    }
    throw installError;
  }
}

async function validateMacBundle(bundle, expectedVersion) {
  const plist = path.join(bundle, 'Contents', 'Info.plist');
  const property = async key => (await runFile('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', plist])).trim();
  const [identifier, version, executable, build] = await Promise.all([
    property('CFBundleIdentifier'),
    property('CFBundleShortVersionString'),
    property('CFBundleExecutable'),
    readFile(path.join(bundle, 'Contents', 'Resources', 'web', 'build-info.json'), 'utf8').then(JSON.parse),
  ]);
  if (identifier !== MAC_BUNDLE_ID || version !== expectedVersion || build.version !== expectedVersion ||
      executable !== '帅帅练琴屋') throw Error('安装包身份或版本不匹配');
  await access(path.join(bundle, 'Contents', 'MacOS', executable), constants.X_OK);
  await access(path.join(bundle, 'Contents', 'Resources', 'app.asar'), constants.R_OK);
}

function createMacUpdater({ currentVersion, arch = process.arch, exePath = process.execPath, fetchImpl = fetch, installBundle, app } = {}) {
  const emitter = new (require('node:events').EventEmitter)();
  let latest = null;
  let downloadedZip = null;
  let stagingDir = null;

  const targetBundle = () => {
    const idx = exePath.lastIndexOf('.app/Contents/MacOS/');
    if (idx <= 0) throw Error('无法定位当前安装的应用，请从下载页手动更新。');
    return exePath.slice(0, idx + 4);
  };

  const cleanup = async () => {
    downloadedZip = null;
    if (stagingDir) {
      const dir = stagingDir;
      stagingDir = null;
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  };

  emitter.checkForUpdates = async () => {
    await cleanup();
    latest = null;
    const release = await fetchReleaseJSON(RELEASES_API, fetchImpl);
    if (release.draft || release.prerelease) throw Error('暂无可用的正式发布版本');
    const version = String(release.tag_name || '').replace(/^v/, '');
    if (!isNewerVersion(version, currentVersion)) {
      emitter.emit('update-not-available', { version: currentVersion });
      return {};
    }
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const findAsset = name => assets.find(a => a && a.name === name && typeof a.browser_download_url === 'string');
    const manifestAsset = findAsset('mac-manifest.json');
    if (!manifestAsset) throw Error('该版本尚未包含 macOS 更新清单');
    const manifest = await fetchReleaseJSON(manifestAsset.browser_download_url, fetchImpl);
    if (manifest.version !== version || manifest.platform !== 'mac') throw Error('macOS 更新清单版本不匹配');
    const zipName = `EGuitarOmitrix-${version}-mac-${arch === 'x64' ? 'x64' : 'arm64'}.zip`;
    const entry = (manifest.artifacts || []).find(a => a && a.name === zipName);
    const zipAsset = findAsset(zipName);
    if (!entry || !zipAsset || !Number.isInteger(entry.bytes) || entry.bytes <= 0 || entry.bytes > MAX_MAC_ZIP || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw Error('该版本缺少当前芯片架构的 macOS 更新包');
    }
    latest = { version, zipName, bytes: entry.bytes, sha256: entry.sha256, url: zipAsset.browser_download_url };
    emitter.emit('update-available', { version });
    return {};
  };

  emitter.downloadUpdate = async () => {
    if (!latest) throw Error('请先检查更新');
    stagingDir = await mkdtemp(path.join(tmpdir(), 'eguitar-mac-update-'));
    const zipFile = path.join(stagingDir, latest.zipName);
    try {
      const response = await fetchReleaseStream(latest.url, fetchImpl);
      const hash = createHash('sha256');
      let total = 0;
      const verify = new Transform({
        transform(chunk, _encoding, callback) {
          total += chunk.length;
          if (total > latest.bytes || total > MAX_MAC_ZIP) {
            callback(Error('下载文件大小超出预期'));
            return;
          }
          hash.update(chunk);
          emitter.emit('download-progress', { percent: (total * 100) / latest.bytes });
          callback(null, chunk);
        },
      });
      await pipeline(response.body, verify, createWriteStream(zipFile, { flags: 'wx' }));
      if (total !== latest.bytes || hash.digest('hex') !== latest.sha256) throw Error('更新包 SHA-256 校验失败');
      downloadedZip = zipFile;
    } catch (error) {
      await cleanup();
      throw error;
    }
  };

  emitter.discardDownload = cleanup;
  emitter.quitAndInstall = async () => {
    const zipFile = downloadedZip, dir = stagingDir, bundle = targetBundle();
    if (!zipFile || !dir || !latest) throw Error('没有已验证的更新包，请重新下载。');
    if (installBundle) {
      await installBundle({ zipFile, stagingDir: dir, bundle });
      return;
    }
    // Stage outside the live bundle on the same volume. Extraction and validation
    // must finish before the installed application is moved.
    if (!app) throw Error('无法重新打开应用，请从下载页手动更新。');
    const installDir = await mkdtemp(path.join(path.dirname(bundle), '.eguitar-update-'));
    const candidate = path.join(installDir, '帅帅练琴屋.app');
    const backup = path.join(installDir, 'previous.app');
    try {
      await runFile('/usr/bin/ditto', ['-x', '-k', zipFile, installDir]);
      await validateMacBundle(candidate, latest.version);
      await replaceMacBundle(candidate, bundle, backup);
      try {
        app.relaunch({ execPath: exePath });
      } catch (error) {
        // Put the validated candidate aside to restore the original after a failed relaunch.
        await replaceMacBundle(backup, bundle, candidate);
        throw error;
      }
      await cleanup();
      await rm(installDir, { recursive: true, force: true }).catch(() => {});
      app.exit(0);
    } catch (error) {
      // Keep the original bundle if a filesystem error also prevents rollback.
      if (!await stat(backup).then(() => true, () => false)) {
        await rm(installDir, { recursive: true, force: true }).catch(() => {});
      }
      throw error;
    }
  };

  return emitter;
}

function createUpdateController({ updater, ask, prepare, installing, failed = () => {}, progress = () => {} }) {
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  let busy = false;
  let available = null;
  updater.on('update-available', info => { available = info; });
  updater.on('update-not-available', () => { available = null; });
  // electron-updater also emits errors for rejected operations; handle the event.
  updater.on('error', () => {});
  updater.on('download-progress', info => {
    if (busy && Number.isFinite(info.percent)) progress(Math.max(0, Math.min(1, info.percent / 100)));
  });
  return {
    async check({ automatic = false } = {}) {
      if (busy) return;
      busy = true;
      try {
        if (!automatic) progress(2);
        available = null;
        let result;
        try {
          result = await updater.checkForUpdates();
        } catch (error) {
          if (automatic) return;
          throw error;
        }
        if (!result) {
          if (automatic) return;
          throw Error('此安装方式暂不支持在线更新，请从下载页安装。');
        }
        if (!available) {
          if (!automatic) await ask({ type: 'info', message: '当前已是最新版本', buttons: ['好的'] });
          return;
        }
        const consent = await ask({ type: 'question', message: '发现新版本 ' + available.version,
          detail: '现在下载？下载完成后会再次询问是否安装，不会自动重启。',
          buttons: ['稍后', '下载更新'], defaultId: 0, cancelId: 0 });
        if (consent.response !== 1) return;
        progress(0);
        await updater.downloadUpdate();
        progress(-1);
        const install = await ask({ type: 'question', message: '更新已下载并校验',
          detail: '安装前将保存并暂停练习。安装完成后应用会重新打开。',
          buttons: ['稍后', '保存并重启'], defaultId: 0, cancelId: 0 });
        if (install.response !== 1) return;
        if (await prepare() !== true) throw Error('未能确认练习已保存，请稍后重试。');
        installing();
        progress(2);
        await updater.quitAndInstall(false, true);
      } catch (error) {
        failed();
        await ask({ type: 'error', message: '更新未完成',
          detail: '请重试，或从下载页手动安装。\n' + error.message,
          buttons: ['好的'] });
      } finally {
        await updater.discardDownload?.();
        progress(-1);
        busy = false;
      }
    },
  };
}
module.exports = { createUpdateController, createMacUpdater, isNewerVersion, allowedReleaseURL, replaceMacBundle };
