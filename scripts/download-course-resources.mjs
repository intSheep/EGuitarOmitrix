import { execFileSync } from 'node:child_process';
import { appendFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readCourseLock, runCourseTool } from './course-resources.mjs';
const lock = await readCourseLock();
if (!/^course-resources-\d{4}\.\d{2}\.\d{2}\.[1-9]\d*$/.test(lock.releaseTag) ||
    lock.asset !== lock.releaseTag + '.zip') throw Error('Invalid locked course release');
const repo = 'intSheep/EGuitarOmitrix';
const directory = resolve('private');
await mkdir(directory, { recursive: true });
execFileSync('gh', ['release', 'download', lock.releaseTag, '--repo', repo, '--pattern', lock.asset, '--dir', directory, '--clobber'], { stdio: 'inherit' });
const archive = resolve(directory, lock.asset);
const metadata = runCourseTool('verify', ['--archive', archive]);
if (process.env.GITHUB_ENV) await appendFile(process.env.GITHUB_ENV, `EGUITAR_COURSE_PACK=${archive}\n`);
console.log(`Verified course ${metadata.version}: ${metadata.itemCount} items, ${metadata.fileCount} files.`);
