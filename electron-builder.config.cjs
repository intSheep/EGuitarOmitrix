module.exports = {
  appId: 'io.github.intsheep.eguitaromitrix',
  productName: '帅帅练琴屋',
  directories: { app: 'desktop', output: 'release/windows' },
  files: ['main.cjs', 'security.cjs', 'updates.cjs', 'package.json', 'icon.png'],
  extraResources: [{ from: 'dist', to: 'web', filter: ['**/*'] }],
  asar: true,
  npmRebuild: false,
  publish: { provider: 'github', owner: 'intSheep', repo: 'EGuitarOmitrix', releaseType: 'release' },
  artifactName: 'EGuitarOmitrix-${version}-windows-${arch}-setup.${ext}',
  mac: { target: ['dmg', 'zip'], category: 'public.app-category.education', artifactName: 'EGuitarOmitrix-${version}-mac-${arch}.${ext}', extendInfo: { NSMicrophoneUsageDescription: '仅在本机分析吉他音高，不录音、不上传。' } },
  win: { executableName: 'EGuitarOmitrix', target: [{ target: 'nsis', arch: ['x64'] }], icon: 'desktop/icon.png' },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true, deleteAppDataOnUninstall: false },
};
