import { execFileSync } from 'node:child_process';
import { readFile, mkdir, cp } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const { version } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const majorMinorPatch = version.split('.').map(Number);
if (majorMinorPatch.length !== 3 || majorMinorPatch.some(n => !Number.isInteger(n) || n < 0 || n > 99)) throw Error('Android versions require three components from 0 to 99');
const versionCode = majorMinorPatch[0] * 10000 + majorMinorPatch[1] * 100 + majorMinorPatch[2] + 1;
execFileSync(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', ['--no-daemon', 'assembleDebug', `-PappVersionName=${version}`, `-PappVersionCode=${versionCode}`], {
  cwd: new URL('android/', root), stdio: 'inherit', shell: process.platform === 'win32',
});
await mkdir(new URL('release/android/', root), { recursive: true });
await cp(new URL('android/app/build/outputs/apk/debug/app-debug.apk', root), new URL(`release/android/EGuitarOmitrix-${version}-android-test.apk`, root));
execFileSync(process.execPath, ['scripts/artifact-manifest.mjs', 'release/android'], { cwd: root, stdio: 'inherit' });
