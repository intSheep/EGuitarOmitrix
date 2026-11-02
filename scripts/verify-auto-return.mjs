// Owner correction (2026-11-02): manual timing and a single contextual return.
// Run npm run build first. The maintained suite starts its own isolated local server.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'tests/e2e/playwright.config.mjs', 'quiet-practice.spec.mjs'], {cwd:root,stdio:'inherit'});
if(result.error) throw result.error;
process.exitCode=result.status ?? 1;
