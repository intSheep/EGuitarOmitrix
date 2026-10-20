import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { copyPublicApp, inventory } from './build-lib.mjs';
import { bundleCourse } from './course-resources.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = root + 'dist';
const pkg = JSON.parse(await readFile(root + 'package.json', 'utf8'));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
let files = await copyPublicApp(root + 'app', out);
let courseResources = null;
if (process.env.EGUITAR_COURSE_PACK) {
  const bundled = await bundleCourse(out, process.env.EGUITAR_COURSE_PACK);
  courseResources = bundled.metadata;
  files = [...new Set([...files, ...bundled.files])].sort();
}
const info = { app: 'EGuitarOmitrix', version: pkg.version, commit: git('rev-parse', 'HEAD'), sourceDirty: Boolean(git('status', '--porcelain')), sourceDate: git('show', '-s', '--format=%cI', 'HEAD'), privateMediaIncluded: Boolean(courseResources), learnerRecordsIncluded: false, courseResources, files: await inventory(out, files) };
await writeFile(out + '/build-info.json', JSON.stringify(info, null, 2) + '\n');
const desktop = JSON.parse(await readFile(root + 'desktop/package.json', 'utf8'));
if (desktop.version !== pkg.version) throw Error('Desktop and root versions must match');
console.log(`Built ${files.length} assets for ${pkg.version}; ${courseResources ? `course ${courseResources.version} (${courseResources.itemCount} indexed items)` : 'lightweight build, course media excluded'}.`);
