const packageJson = require('./package.json');

const baseBuild = packageJson.build;

module.exports = {
  appId: baseBuild.appId,
  productName: baseBuild.productName,
  asar: baseBuild.asar,
  electronDist: baseBuild.electronDist,
  asarUnpack: baseBuild.asarUnpack,
  directories: { output: 'release/updates' },
  files: baseBuild.files,
  win: {
    target: ['nsis'],
    icon: baseBuild.win.icon,
  },
  nsis: {
    ...baseBuild.nsis,
    artifactName: 'Little-Orange-Desktop-Pet-Update-x64.${ext}',
    differentialPackage: false,
    deleteAppDataOnUninstall: false,
  },
};
