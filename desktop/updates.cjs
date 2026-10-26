// Main-process only. No renderer IPC, credentials, silent install or startup network call.
function createUpdateController({ updater, ask, prepare, installing, failed = () => {} }) {
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  let busy = false;
  let available = null;
  updater.on('update-available', info => { available = info; });
  updater.on('update-not-available', () => { available = null; });
  // electron-updater also emits errors for rejected operations; handle the event.
  updater.on('error', () => {});
  return {
    async check() {
      if (busy) return;
      busy = true;
      try {
        available = null;
        const result = await updater.checkForUpdates();
        if (!result) throw Error('此安装方式暂不支持在线更新，请从下载页安装。');
        if (!available) {
          await ask({ type: 'info', message: '当前已是最新版本', buttons: ['好的'] });
          return;
        }
        const consent = await ask({ type: 'question', message: '发现新版本 ' + available.version,
          detail: '现在下载？下载完成后会再次询问是否安装，不会自动重启。',
          buttons: ['稍后', '下载更新'], defaultId: 0, cancelId: 0 });
        if (consent.response !== 1) return;
        await updater.downloadUpdate();
        const install = await ask({ type: 'question', message: '更新已下载并校验',
          detail: '安装前将保存并暂停练习。建议先在练习回顾中导出备份。安装会退出应用。',
          buttons: ['稍后', '保存并安装'], defaultId: 0, cancelId: 0 });
        if (install.response !== 1) return;
        if (await prepare() !== true) throw Error('未能确认练习已保存，请稍后重试。');
        installing();
        updater.quitAndInstall(false, true);
      } catch (error) {
        failed();
        await ask({ type: 'error', message: '更新未完成',
          detail: '当前版本仍可使用。请检查网络或从下载页重试。\n' + error.message,
          buttons: ['好的'] });
      } finally { busy = false; }
    },
  };
}
module.exports = { createUpdateController };
