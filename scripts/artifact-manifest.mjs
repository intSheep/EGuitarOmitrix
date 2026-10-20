import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
const directory = resolve(process.argv[2] || 'release/windows');
const info = JSON.parse(await readFile(new URL('../dist/build-info.json', import.meta.url), 'utf8'));
const files = (await readdir(directory)).filter(name => /\.(?:exe|apk|aab|blockmap)$/.test(name)).sort();
if (!files.length) throw Error('No installable artifacts found');
if (files.some(name => !name.startsWith(`EGuitarOmitrix-${info.version}-`))) throw Error('Old or unexpected artifact version; clean the release directory first');
const artifacts = [];
for (const name of files) {
  const bytes = await readFile(resolve(directory, name));
  artifacts.push({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(resolve(directory, basename(directory) + '-SHA256SUMS.txt'), artifacts.map(a => `${a.sha256}  ${a.name}\n`).join(''));
await writeFile(resolve(directory, basename(directory) + '-manifest.json'), JSON.stringify({ app: info.app, version: info.version, commit: info.commit, sourceDirty: info.sourceDirty, platform: basename(directory), signing: basename(directory) === 'windows' ? 'unsigned' : 'debug-signed test key; not production', privateMediaIncluded: false, artifacts }, null, 2) + '\n');
console.log('Wrote artifact manifest and SHA-256 checksums.');
