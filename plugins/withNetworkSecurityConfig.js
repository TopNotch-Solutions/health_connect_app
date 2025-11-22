const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withNetworkSecurityConfig(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    
    // Ensure the application element exists
    if (manifest.manifest.application) {
      // Set the networkSecurityConfig attribute
      manifest.manifest.application[0].$['android:networkSecurityConfig'] = '@xml/network_security_config';
    }
    
    return config;
  });
};
