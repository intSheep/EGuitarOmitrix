import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, cp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copyPublicApp, inventory } from '../scripts/build-lib.mjs';
import security from '../desktop/security.cjs';

test('distribution excludes private media, arbitrary data, vendor additions and escaping symlinks', async () => {
  const base = await mkdtemp(join(tmpdir(), 'eguitar-build-synthetic-'));
  const app = join(base, 'app'), out = join(base, 'dist');
  const publicFiles = ['index.html', 'app.js', 'styles.css', 'assets/mark.svg', 'assets/fretboard.svg', 'assets/tuner-electric-guitar.png', 'data/course.json', 'data/assignments.json', ...['alphaTab.min.mjs', 'alphaTab.core.mjs', 'alphaTab.worker.mjs', 'alphaTab.worklet.mjs', 'font/test.woff2', 'soundfont/test.sf2', 'LICENSE'].map(name => 'vendor/alphatab/' + name)];
  const privateFiles = ['local-scores/p003/score.musicxml', 'local-scores/index.json', 'data/personal.json', 'assets/private.png', 'vendor/credentials.json', '.env'];
  try {
    for (const name of [...publicFiles, ...privateFiles]) {
      await mkdir(join(app, name, '..'), { recursive: true });
      await writeFile(join(app, name), 'SYNTHETIC ' + name);
    }
    const copied = await copyPublicApp(app, out);
    assert.deepEqual(copied, [...publicFiles, 'local-scores/index.json'].sort());
    assert.deepEqual(JSON.parse(await readFile(join(out, 'local-scores/index.json'), 'utf8')), { items: [] });
    const manifest = await inventory(out, copied);
    assert.ok(manifest.every(file => file.bytes > 0 && /^[a-f0-9]{64}$/.test(file.sha256)));
    if (process.platform !== 'win32') {
      await writeFile(join(base, 'private.js'), 'SYNTHETIC OUTSIDE SECRET');
      await symlink(join(base, 'private.js'), join(app, 'escape.js'));
      await assert.rejects(copyPublicApp(app, out), /escapes/);
    }
  } finally { await rm(base, { recursive: true, force: true }); }
});
test('desktop restricts resources, outbound navigation and microphone media types', () => {
  const root = join(tmpdir(), 'eguitar-synthetic-public');
  assert.equal(security.resourcePath(root, 'eguitar://app/'), join(root, 'index.html'));
  for (const url of ['https://example.com/', 'eguitar://app.evil/index.html', 'eguitar://name@app/index.html', 'eguitar://app/%2e%2e%2fsecret', 'eguitar://app/%5csecret', 'eguitar://app/%00']) assert.throws(() => security.resourcePath(root, url));
  assert.ok(security.externalURL('https://www.bilibili.com/video/BV1FT411Z7iu/?p=3'));
  for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'https://www.bilibili.com.evil/', 'https://name@www.bilibili.com/', 'http://www.bilibili.com/', 'ms-settings:']) assert.equal(security.externalURL(url), null);
  assert.equal(security.audioOnly(['audio']), true);
  for (const types of [[], ['audio', 'video'], ['video'], undefined]) assert.equal(security.audioOnly(types), false);
});
test('release tags require matching clean source on main and reject branch-only revisions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'eguitar-release-synthetic-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  const check = tag => execFileSync(process.execPath, [join(root, 'scripts/check-release.mjs'), tag], { cwd: root, stdio: 'pipe' });
  try {
    await mkdir(join(root, 'scripts'));
    await cp(new URL('../scripts/check-release.mjs', import.meta.url), join(root, 'scripts/check-release.mjs'));
    await writeFile(join(root, 'package.json'), JSON.stringify({ version: '0.3.0' }));
    git('init', '-q'); git('add', '.');
    git('-c', 'user.name=Synthetic QA', '-c', 'user.email=synthetic@example.invalid', 'commit', '-qm', 'Synthetic release fixture');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD'); git('tag', 'v0.3.0');
    assert.match(check('v0.3.0').toString(), /Validated/);
    assert.throws(() => check('v0.3.1'));
    assert.throws(() => check('v0.3.0; echo unsafe'));
    await writeFile(join(root, 'untracked.txt'), 'SYNTHETIC');
    assert.throws(() => check('v0.3.0'));
    git('add', '.'); git('-c', 'user.name=Synthetic QA', '-c', 'user.email=synthetic@example.invalid', 'commit', '-qm', 'Synthetic branch-only revision');
    git('tag', '-f', 'v0.3.0');
    assert.throws(() => check('v0.3.0'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('release inventory includes update metadata, excludes builder diagnostics and rejects a missing feed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'eguitar-artifacts-synthetic-'));
  try {
    await mkdir(join(root, 'scripts'));
    await mkdir(join(root, 'dist'));
    await mkdir(join(root, 'windows'));
    await cp(new URL('../scripts/artifact-manifest.mjs', import.meta.url), join(root, 'scripts/artifact-manifest.mjs'));
    await writeFile(join(root, 'dist/build-info.json'), JSON.stringify({ version: '0.4.0', app: 'SYNTHETIC', commit: 'SYNTHETIC', learnerRecordsIncluded: false }));
    await writeFile(join(root, 'windows/EGuitarOmitrix-0.4.0-windows-x64-setup.exe'), 'SYNTHETIC INSTALLER');
    await writeFile(join(root, 'windows/builder-effective-config.yaml'), 'SYNTHETIC DIAGNOSTIC');
    await writeFile(join(root, 'windows/builder-debug.yml'), 'SYNTHETIC DIAGNOSTIC');
    const run = () => execFileSync(process.execPath, [join(root, 'scripts/artifact-manifest.mjs'), join(root, 'windows')], { stdio: 'pipe' });
    assert.throws(run, /latest.yml is required/);
    await writeFile(join(root, 'windows/latest.yml'), 'version: 0.4.0\n');
    run();
    const manifest = JSON.parse(await readFile(join(root, 'windows/windows-manifest.json'), 'utf8'));
    assert.deepEqual(manifest.artifacts.map(a => a.name), ['EGuitarOmitrix-0.4.0-windows-x64-setup.exe', 'latest.yml']);
    await writeFile(join(root, 'windows/EGuitarOmitrix-0.3.0-windows-x64-setup.exe'), 'SYNTHETIC STALE INSTALLER');
    assert.throws(run, /Old or unexpected artifact/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
