import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('../app/', import.meta.url));
const out = fileURLToPath(new URL('../dist/', import.meta.url));
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(app, out, { recursive: true });
console.log('Static app built in dist/');
