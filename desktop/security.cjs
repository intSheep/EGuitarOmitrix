const path = require('node:path');
const ORIGIN = 'eguitar://app';
const CSP = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; worker-src 'self' blob:; script-src 'self'; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
function isAppURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'eguitar:' && url.host === 'app' && !url.username && !url.password;
  } catch { return false; }
}
function resourcePath(root, value) {
  if (!isAppURL(value)) throw new Error('Untrusted origin');
  const pathname = decodeURIComponent(new URL(value).pathname);
  if (pathname.includes('\\') || pathname.includes('\0')) throw new Error('Invalid path');
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error('Invalid path');
  return file;
}
function externalURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname === 'www.bilibili.com' && !url.username && !url.password && !url.port) return url.href;
  } catch { /* Unsupported links are blocked. */ }
  return null;
}
function audioOnly(types) {
  return Array.isArray(types) && types.length > 0 && types.every(type => type === 'audio');
}
module.exports = { ORIGIN, CSP, isAppURL, resourcePath, externalURL, audioOnly };
