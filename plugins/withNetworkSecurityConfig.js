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
      // Cleartext is denied by default. Android 9+ already blocks it; this
      // config must not switch that protection back off, or we cannot honestly
      // answer "all user data is encrypted in transit" on the Play listing.
      //
      // The only exceptions are the loopback addresses used to reach a local
      // backend from an emulator (see lib/backend.ts). They are unreachable
      // from a real device, so a shipped build has no cleartext path at all.
      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Deny cleartext (HTTP) everywhere. Do not set this to true. -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <!-- Local development only: Android emulator host alias and loopback.
         Never reachable from a real device, so this does not weaken release
         builds. Do not add public hosts here — use HTTPS instead. -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">10.0.2.2</domain>
        <domain includeSubdomains="false">localhost</domain>
        <!-- Android matches hostnames literally: "localhost" does NOT cover
             127.0.0.1, and expo start dash-dash-localhost connects via 127.0.0.1. -->
        <domain includeSubdomains="false">127.0.0.1</domain>
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