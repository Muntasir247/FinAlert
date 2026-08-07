const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withExcludeLegacySupport(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents += `
allprojects {
    configurations.all {
        exclude group: 'com.android.support', module: 'support-compat'
        exclude group: 'com.android.support', module: 'support-v4'
        exclude group: 'com.android.support', module: 'support-media-compat'
    }
}
`;
    }
    return config;
  });
};