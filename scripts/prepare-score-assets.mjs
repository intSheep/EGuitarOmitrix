import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const source = fileURLToPath(
  new URL("../node_modules/@coderline/alphatab/dist/", import.meta.url),
);
const dest = fileURLToPath(new URL("../app/vendor/alphatab/", import.meta.url));
await mkdir(dest, { recursive: true });
for (const name of [
  "alphaTab.core.mjs",
  "alphaTab.worker.mjs",
  "alphaTab.worklet.mjs",
  "alphaTab.min.mjs",
  "alphaTab.core.min.mjs",
  "alphaTab.worker.min.mjs",
  "alphaTab.worklet.min.mjs",
  "font",
  "soundfont",
])
  await cp(`${source}/${name}`, `${dest}/${name}`, { recursive: true });
console.log("Local alphaTab runtime prepared.");

await cp(
  new URL("../node_modules/@coderline/alphatab/LICENSE", import.meta.url),
  `${dest}/LICENSE`,
);
