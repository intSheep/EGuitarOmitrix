const { app, BrowserWindow, dialog, Menu, net, protocol, session, shell } = require('electron');
const path = require('node:path');
const { realpath } = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { ORIGIN, CSP, isAppURL, resourcePath, externalURL, audioOnly } = require('./security.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'eguitar', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true,
} }]);
// Stable across installer versions. Never use the owner's browser profile.
app.setPath('userData', process.env.EGUITAR_TEST_PROFILE || path.join(app.getPath('appData'), 'EGuitarOmitrix'));
let window;
let quitting = false;
let prompting = false;
const background = () => window && !window.isDestroyed()
  ? window.webContents.executeJavaScript('window.eguitarPauseForBackground?.()').catch(() => {})
  : Promise.resolve();

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(async () => {
    const root = await realpath(app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '../dist'));
    protocol.handle('eguitar', async request => {
      try {
        if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
        const file = await realpath(resourcePath(root, request.url));
        if (!file.startsWith(root + path.sep)) throw new Error('Invalid resource');
        const response = await net.fetch(pathToFileURL(file).href);
        const headers = new Headers(response.headers);
        headers.set('Content-Security-Policy', CSP);
        headers.set('X-Content-Type-Options', 'nosniff');
        return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
      } catch { return new Response('Not found', { status: 404 }); }
    });
    const local = session.defaultSession;
    local.setPermissionCheckHandler((contents, permission, origin, details) =>
      contents === window?.webContents && isAppURL(contents.getURL()) && isAppURL(origin) && permission === 'media' && details.mediaType === 'audio');
    local.setPermissionRequestHandler(async (contents, permission, callback, details) => {
      if (contents !== window?.webContents || !isAppURL(contents.getURL()) || !isAppURL(details.requestingUrl) ||
          !details.isMainFrame || permission !== 'media' || !audioOnly(details.mediaTypes) || !window.isFocused()) {
        callback(false); return;
      }
      prompting = true;
      let approved = false;
      try { const result = await dialog.showMessageBox(window, {
        type: 'question', title: '开启麦克风', message: '允许帅帅练琴屋使用麦克风调音吗？',
        detail: '声音仅在本机分析，不录音、不上传。关闭调音器或离开应用即停止。',
        buttons: ['取消', '允许本次使用'], defaultId: 0, cancelId: 0,
      });
      approved = result.response === 1;
      } catch { /* Closing a native dialog denies access. */ }
      finally { prompting = false; }
      callback(approved && !contents.isDestroyed() && isAppURL(contents.getURL()) && !window.isDestroyed() && window.isVisible() && !window.isMinimized());
    });
    local.setDevicePermissionHandler(() => false);
    window = new BrowserWindow({
      width: 1280, height: 900, minWidth: 390, minHeight: 600, show: false,
      title: '帅帅练琴屋', backgroundColor: '#ffffff', icon: path.join(__dirname, 'icon.png'), autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false },
    });
    const openExternal = value => {
      const url = externalURL(value);
      if (url) { background(); shell.openExternal(url).catch(() => {}); }
    };
    window.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
    window.webContents.on('will-navigate', (event, url) => {
      if (!isAppURL(url)) { event.preventDefault(); openExternal(url); }
    });
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.on('blur', () => { if (!prompting) background(); });
    window.on('minimize', background);
    window.on('close', event => {
      if (quitting) return;
      event.preventDefault();
      background().finally(() => { quitting = true; window.close(); });
    });
    window.once('ready-to-show', () => window.show());
    await window.loadURL(ORIGIN + '/index.html');
    const { createUpdateController } = require('./updates.cjs');
    const updates = app.isPackaged && ['win32', 'darwin'].includes(process.platform)
      ? createUpdateController({
        updater: require('electron-updater').autoUpdater,
        ask: options => dialog.showMessageBox(window, options),
        prepare: () => window.webContents.executeJavaScript('window.eguitarPrepareForUpdate()'),
        installing: () => { quitting = true; },
        failed: () => { quitting = false; },
      }) : null;
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { label: '帮助', submenu: [
        { label: '检查更新', enabled: !!updates, click: () => updates.check() },
        { label: '下载与版本说明', click: () => { background(); shell.openExternal('https://github.com/intSheep/EGuitarOmitrix/releases').catch(() => {}); } },
        { label: '关于帅帅练琴屋', click: () => dialog.showMessageBox(window, { message: '帅帅练琴屋 ' + app.getVersion(), detail: '感谢「帅帅是把电吉他」老师的课程。本项目是独立练习辅助工具，非老师官方出品。' }) },
      ] },
    ]));
    window.setAutoHideMenuBar(false);
    window.setMenuBarVisibility(true);
  }).catch(error => { dialog.showErrorBox('EGuitarOmitrix', '应用无法启动：' + error.message); app.exit(1); });
  app.on('window-all-closed', () => app.quit());
}
