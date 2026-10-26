import { execFileSync } from 'node:child_process';
import { readFile, rm, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const script = fileURLToPath(new URL('./course-resources.py', import.meta.url));
export const courseLockPath = fileURLToPath(new URL('../config/course-resources.lock.json', import.meta.url));
export const readCourseLock = async () => JSON.parse(await readFile(courseLockPath, 'utf8'));
export function runCourseTool(command, args, lock = courseLockPath) {
  return JSON.parse(execFileSync(process.env.EGUITAR_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'),
    [script, command, '--lock', lock, ...args], { encoding: 'utf8', maxBuffer: 1024 * 1024 }));
}
export async function bundleCourse(out, archive) {
  const temporary = resolve(out, 'course-staging');
  const metadata = runCourseTool('extract', ['--archive', resolve(archive), '--output', temporary]);
  await rm(resolve(out, 'local-scores'), { recursive: true, force: true });
  await rename(temporary, resolve(out, 'local-scores'));
  const manifest = JSON.parse(await readFile(resolve(out, 'local-scores/resource-manifest.json'), 'utf8'));
  return { metadata, files: [...manifest.files.map(file => 'local-scores/' + file.path), 'local-scores/resource-manifest.json'] };
}
