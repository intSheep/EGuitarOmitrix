module.exports = {
  appId: 'io.github.intsheep.eguitaromitrix',
  productName: 'EGuitarOmitrix',
  directories: { app: 'desktop', output: 'release/windows' },
  files: ['main.cjs', 'security.cjs', 'package.json', 'icon.png'],
  extraResources: [{ from: 'dist', to: 'web', filter: ['**/*'] }],
  asar: true,
  npmRebuild: false,
  publish: null,
  artifactName: 'EGuitarOmitrix-${version}-windows-${arch}-setup.${ext}',
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: 'desktop/icon.png' },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true, deleteAppDataOnUninstall: false },
};
