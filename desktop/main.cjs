const { app, BrowserWindow, dialog, ipcMain, Menu, net, powerMonitor, protocol, session, shell, systemPreferences } = require('electron');
const path = require('node:path');
const { realpath, mkdir, writeFile } = require('node:fs/promises');
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
let closePending = false;
const { createCloseBarrier } = require('./lifecycle.cjs');
const persistBeforeClose = createCloseBarrier({
  prepare: () => window && !window.isDestroyed() ? window.webContents.executeJavaScript('window.eguitarPrepareForClose ? window.eguitarPrepareForClose() : window.eguitarPauseForBackground?.()') : Promise.resolve(),
  ask: options => dialog.showMessageBox(window, options),
});
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
      let approved = true;
      try {
        if (process.platform === 'darwin') {
          const status = systemPreferences.getMediaAccessStatus('microphone');
          approved = status === 'granted' || (status === 'not-determined' && await systemPreferences.askForMediaAccess('microphone'));
          if (!approved) {
            const answer = await dialog.showMessageBox(window, { type: 'info', message: 'macOS 尚未允许麦克风访问', detail: '请在系统设置的隐私与安全性 → 麦克风中允许帅帅练琴屋，然后重新点击开始调音。', buttons: ['取消', '打开系统设置'], defaultId: 0, cancelId: 0 });
            if (answer.response === 1) await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
          }
        }
      } catch { approved = false; }
      finally { prompting = false; }
      callback(approved && !contents.isDestroyed() && isAppURL(contents.getURL()) && !window.isDestroyed() && window.isVisible() && !window.isMinimized());
    });
    local.setDevicePermissionHandler(() => false);
    window = new BrowserWindow({
      width: 1280, height: 900, minWidth: 390, minHeight: 600, show: false,
      title: '帅帅练琴屋', backgroundColor: '#f4f6fb', icon: path.join(__dirname, 'icon.png'), autoHideMenuBar: true,
      ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 18 } } : {}),
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false, backgroundThrottling: false },
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
      if (closePending) return;
      closePending = true;
      persistBeforeClose().then(saved => {
        if (!saved) return;
        if (process.platform === 'darwin') window.hide();
        else { quitting = true; app.quit(); }
      }).finally(() => { closePending = false; });
    });
    app.on('activate', () => { if (!window.isDestroyed()) { window.show(); window.focus(); } });
    powerMonitor.on('suspend', background);
    window.once('ready-to-show', () => window.show());
    await window.loadURL(ORIGIN + '/index.html');
    const { createUpdateController, createMacUpdater } = require('./updates.cjs');
    const updaterInstance = app.isPackaged
      ? (process.platform === 'win32'
        ? require('electron-updater').autoUpdater
        : process.platform === 'darwin'
          ? createMacUpdater({ currentVersion: app.getVersion() })
          : null)
      : null;
    const updates = updaterInstance
      ? createUpdateController({
        updater: updaterInstance,
        ask: options => dialog.showMessageBox(window, options),
        prepare: () => window.webContents.executeJavaScript('window.eguitarPrepareForUpdate()'),
        installing: () => { quitting = true; },
        failed: () => { quitting = false; },
        progress: value => { if (!window.isDestroyed()) window.setProgressBar(value); },
      }) : null;
    ipcMain.handle('eguitar:open-guitar-pro', async (event, bytes) => {
      if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame || !isAppURL(event.senderFrame.url)) throw Error('Untrusted score request');
      if (!(bytes instanceof Uint8Array) || bytes.length < 4 || bytes.length > 32 * 1024 * 1024) throw Error('Invalid score payload');
      const folder = path.join(app.getPath('userData'), 'score-cache');
      await mkdir(folder, { recursive: true });
      const hash = require('node:crypto').createHash('sha256').update(bytes).digest('hex');
      const file = path.join(folder, hash + '.gp');
      await writeFile(file, bytes);
      await background();
      if (process.platform === 'darwin') {
        await new Promise((resolve, reject) =>
          require('node:child_process').execFile('/usr/bin/open', ['-a', 'Guitar Pro 8', file], error => {
            if (!error) return resolve();
            require('node:child_process').execFile('/usr/bin/open', ['-a', 'Guitar Pro', file], error2 =>
              error2 ? reject(Error('无法打开 Guitar Pro 8，请确认已安装。')) : resolve()
            );
          })
        );
      } else {
        const error = await shell.openPath(file);
        if (error) throw Error(error);
      }
    });
    ipcMain.handle('eguitar:open-course', async (event, value) => {
      if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame || !isAppURL(event.senderFrame.url)) throw Error('Untrusted course request');
      const url = externalURL(value);
      if (!url) throw Error('Unsupported course URL');
      await background();
      await shell.openExternal(url);
    });
    ipcMain.handle('eguitar:check-updates', async event => {
      if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame || !isAppURL(event.senderFrame.url)) throw Error('Untrusted update request');
      if (!updates) throw Error('请使用已安装的正式版本检查更新');
      await updates.check();
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
      { label: '帮助', submenu: [
        { label: '检查更新', enabled: !!updates, click: () => updates.check() },
        { label: '下载与版本说明', click: () => { background(); shell.openExternal('https://github.com/intSheep/EGuitarOmitrix/releases').catch(() => {}); } },
        { label: '关于帅帅练琴屋', click: () => dialog.showMessageBox(window, { message: '帅帅练琴屋 ' + app.getVersion(), detail: '感谢「帅帅是把电吉他」老师的课程。本项目是独立练习辅助工具，非老师官方出品。' }) },
      ] },
    ]));
    window.setAutoHideMenuBar(false);
    window.setMenuBarVisibility(true);
  }).catch(error => { dialog.showErrorBox('EGuitarOmitrix', '应用无法启动：' + error.message); app.exit(1); });
  app.on('before-quit', event => {
    if (quitting) return;
    event.preventDefault();
    persistBeforeClose().then(saved => { if (saved) { quitting = true; app.quit(); } });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
