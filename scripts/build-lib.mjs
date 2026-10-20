import { cp, mkdir, readdir, realpath, stat, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';

// Public application assets only. Local score indexes/media and arbitrary data never ship.
export async function copyPublicApp(app, out) {
  const root = await realpath(app);
  const copied = [];
  async function copy(relative) {
    const source = await realpath(resolve(root, relative));
    if (!source.startsWith(root + sep)) throw Error('Asset escapes application root: ' + relative);
    if ((await stat(source)).isDirectory()) {
      for (const name of (await readdir(source)).sort()) await copy(relative + '/' + name);
    } else {
      const target = resolve(out, relative);
      await mkdir(dirname(target), { recursive: true });
      await cp(source, target);
      copied.push(relative);
    }
  }
  for (const name of (await readdir(root)).sort()) {
    if (/^[a-z][a-z0-9-]*\.(?:js|css|html)$/.test(name)) await copy(name);
  }
  for (const relative of ['assets/mark.svg', 'assets/fretboard.svg', 'assets/tuner-electric-guitar.png', 'data/course.json', 'data/assignments.json']) await copy(relative);
  for (const name of ['alphaTab.min.mjs', 'alphaTab.core.mjs', 'alphaTab.worker.mjs', 'alphaTab.worklet.mjs', 'font', 'soundfont', 'LICENSE']) await copy('vendor/alphatab/' + name);
  await mkdir(resolve(out, 'local-scores'), { recursive: true });
  await writeFile(resolve(out, 'local-scores/index.json'), JSON.stringify({ items: [] }) + '\n');
  copied.push('local-scores/index.json');
  return copied.sort();
}
export async function inventory(root, files) {
  return Promise.all(files.map(async path => {
    const bytes = await readFile(resolve(root, path));
    return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }));
}
