const packageJson = require('./package.json');

const baseBuild = packageJson.build;

module.exports = {
  appId: baseBuild.appId,
  productName: baseBuild.productName,
  asar: baseBuild.asar,
  directories: { output: 'release/updates' },
  files: baseBuild.files,
  win: {
    target: ['nsis'],
    icon: baseBuild.win.icon,
  },
  nsis: {
    ...baseBuild.nsis,
    artifactName: '小橙子桌宠-Update-${version}-x64.${ext}',
    differentialPackage: false,
    deleteAppDataOnUninstall: false,
  },
};
