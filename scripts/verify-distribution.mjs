import { readFile, readdir, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { inventory } from './build-lib.mjs';
import { runCourseTool } from './course-resources.mjs';
const root = resolve(process.argv[2] || 'dist');
const info = JSON.parse(await readFile(join(root, 'build-info.json'), 'utf8'));
const expected = info.files.map(file => file.path).sort();
if (new Set(expected).size !== expected.length || expected.some(path => typeof path !== 'string' || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..'))) throw Error('Invalid asset inventory');
const actual = [];
async function walk(dir, prefix = '') {
  for (const name of await readdir(dir)) {
    const file = join(dir, name), relative = prefix + name, data = await lstat(file);
    if (data.isSymbolicLink()) throw Error('Distribution must not contain symlinks');
    if (data.isDirectory()) await walk(file, relative + '/');
    else actual.push(relative);
  }
}
await walk(root);
const bootstrap = process.argv.includes('--android') ? ['cordova.js', 'cordova_plugins.js'] : [];
const extras = actual.filter(file => !expected.includes(file) && file !== 'build-info.json' && !bootstrap.includes(file));
if (extras.length) throw Error('Unexpected distributed files: ' + extras.join(', '));
const computed = await inventory(root, expected);
if (JSON.stringify(computed) !== JSON.stringify(info.files)) throw Error('Distribution bytes do not match the build manifest');
if (info.learnerRecordsIncluded !== false) throw Error('Learner records must be excluded');
if (info.courseResources) {
  const metadata = runCourseTool('directory', ['--source', join(root, 'local-scores')]);
  if (info.privateMediaIncluded !== true || JSON.stringify(metadata) !== JSON.stringify(info.courseResources)) throw Error('Bundled course identity mismatch');
} else if (info.privateMediaIncluded !== false || JSON.parse(await readFile(join(root, 'local-scores/index.json'), 'utf8')).items.length) throw Error('Unapproved course material');
console.log(`Verified ${expected.length} bundled assets (${info.version}, ${info.commit}; course ${info.courseResources?.version || 'excluded'}).`);
