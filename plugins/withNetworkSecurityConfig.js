const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withNetworkSecurityConfig(config) {
  // PLATFORM GUARD: If we are building for iOS, bypass this plugin safely!
  if (config.modRequest?.platform !== 'android' && !config.android) {
    return config;
  }

  // First, create the network security config XML file
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      // Secondary safety check inside dangerous mod block
      if (config.modRequest.platform !== 'android') return config;

      const xmlDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }
      
      const xmlPath = path.join(xmlDir, 'network_security_config.xml');
      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Allow cleartext (HTTP) traffic for all domains -->
    <!-- This is temporary while setting up SSL certificates -->
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <!-- Allow cleartext traffic for specific IP addresses if needed -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">13.51.207.99</domain>
    </domain-config>
</network-security-config>`;
      
      fs.writeFileSync(xmlPath, xmlContent, 'utf8');
      return config;
    },
  ]);

  // Then, update the AndroidManifest to reference it
  return withAndroidManifest(config, async (config) => {
    // Tertiary check to verify native context existence
    if (!config.modResults || !config.modResults.manifest) {
      return config;
    }

    const manifest = config.modResults;
    
    if (manifest.manifest.application) {
      const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
      const googleMapsApiKey = config.android?.config?.googleMaps?.apiKey;

      if (googleMapsApiKey) {
        AndroidConfig.Manifest.addMetaDataItemToMainApplication(
          mainApplication,
          'com.google.android.geo.API_KEY',
          googleMapsApiKey,
        );
      }

      manifest.manifest.application[0].$['android:networkSecurityConfig'] = '@xml/network_security_config';
    }
    
    return config;
  });
};