#!/usr/bin/env node

/**
 * Script to verify network security configuration in built Android app
 * Run this after building the APK to check if config was applied correctly
 */

const fs = require('fs');
const path = require('path');

const androidDir = path.join(__dirname, '..', 'android');
const xmlConfigPath = path.join(androidDir, 'app', 'src', 'main', 'res', 'xml', 'network_security_config.xml');
const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');

console.log('🔍 Verifying Network Security Configuration...\n');

// Check if android directory exists
if (!fs.existsSync(androidDir)) {
  console.log('⚠️  Android directory not found. Run "npx expo prebuild" first.');
  console.log('   Or if using EAS Build, check the build logs for config plugin output.');
  process.exit(1);
}

// Check network security config XML file
console.log('1. Checking network_security_config.xml...');
if (fs.existsSync(xmlConfigPath)) {
  console.log('   ✅ File exists:', xmlConfigPath);
  const content = fs.readFileSync(xmlConfigPath, 'utf8');
  if (content.includes('cleartextTrafficPermitted="true"')) {
    console.log('   ✅ Contains cleartextTrafficPermitted="true"');
  } else {
    console.log('   ❌ Does NOT contain cleartextTrafficPermitted="true"');
  }
  if (content.includes('13.51.207.99')) {
    console.log('   ✅ Contains server IP address');
  }
} else {
  console.log('   ❌ File NOT found:', xmlConfigPath);
  console.log('   ⚠️  Network security config was not created!');
}

// Check AndroidManifest.xml
console.log('\n2. Checking AndroidManifest.xml...');
if (fs.existsSync(manifestPath)) {
  console.log('   ✅ File exists:', manifestPath);
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  
  if (manifestContent.includes('android:networkSecurityConfig')) {
    console.log('   ✅ Contains android:networkSecurityConfig attribute');
    const match = manifestContent.match(/android:networkSecurityConfig="([^"]+)"/);
    if (match) {
      console.log('   📋 Value:', match[1]);
    }
  } else {
    console.log('   ❌ Does NOT contain android:networkSecurityConfig');
  }
  
  if (manifestContent.includes('android:usesCleartextTraffic')) {
    console.log('   ✅ Contains android:usesCleartextTraffic attribute');
    const match = manifestContent.match(/android:usesCleartextTraffic="([^"]+)"/);
    if (match) {
      console.log('   📋 Value:', match[1]);
      if (match[1] === 'true') {
        console.log('   ✅ Value is "true" (correct)');
      } else {
        console.log('   ❌ Value is not "true"');
      }
    }
  } else {
    console.log('   ❌ Does NOT contain android:usesCleartextTraffic');
  }
} else {
  console.log('   ❌ File NOT found:', manifestPath);
  console.log('   ⚠️  Run "npx expo prebuild" to generate Android files');
}

console.log('\n📝 Next Steps:');
console.log('   1. If files are missing, run: npx expo prebuild --clean');
console.log('   2. Rebuild the app: npx expo run:android');
console.log('   3. Uninstall old app from device and install new build');
console.log('   4. Test network connectivity from device browser');


