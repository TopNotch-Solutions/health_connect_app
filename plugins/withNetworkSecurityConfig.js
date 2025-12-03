const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withNetworkSecurityConfig(config) {
  // First, create the network security config XML file
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const xmlDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      
      // Create the xml directory if it doesn't exist
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
        <domain includeSubdomains="true">13.61.152.64</domain>
    </domain-config>
</network-security-config>`;
      
      fs.writeFileSync(xmlPath, xmlContent, 'utf8');
      return config;
    },
  ]);

  // Then, update the AndroidManifest to reference it
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
