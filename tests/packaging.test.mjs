import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
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
