# Network Error Troubleshooting Guide

## Problem
Receiving network errors when making calls to `http://13.51.207.99:4000` on physical Android device.

## Solutions

### 1. Rebuild the App (REQUIRED)
The network security configuration changes require a **full rebuild** of the Android app. The changes won't take effect with just a hot reload.

**Steps:**
```bash
# Stop the current Expo server
# Then rebuild the app:
npx expo run:android

# OR if using EAS Build:
eas build --platform android
```

**Important:** After rebuilding, uninstall the old app from your device and install the newly built one.

### 2. Verify Network Security Config is Applied

After rebuilding, check that the network security config file exists:
- Location: `android/app/src/main/res/xml/network_security_config.xml`
- Should contain: `<base-config cleartextTrafficPermitted="true">`

Also verify `AndroidManifest.xml` includes:
- `android:networkSecurityConfig="@xml/network_security_config"`
- `android:usesCleartextTraffic="true"`

### 3. Check Device Network Connectivity

**Test if device can reach the server:**
1. Connect your device to the same network as your development machine
2. Open a browser on the device and try: `http://13.51.207.99:4000`
3. If it doesn't load, the device cannot reach the server

**Common issues:**
- Device on different network (WiFi vs mobile data)
- Firewall blocking the connection
- VPN interfering with connection
- Server IP address changed

### 4. Alternative: Use Your Computer's IP Address

If the server is running on your local machine, use your computer's local IP instead:

**Find your computer's IP:**
- Windows: `ipconfig` (look for IPv4 Address)
- Mac/Linux: `ifconfig` or `ip addr`

**Update the URL in:**
- `lib/socket.ts` - Change `SOCKET_URL`
- `lib/api.ts` - Change `API_BASE_URL`
- `plugins/withNetworkSecurityConfig.js` - Update domain in XML

### 5. Check Server Status

Verify the server is running and accessible:
```bash
# Test from your computer
curl http://13.51.207.99:4000

# Or check if port is open
telnet 13.51.207.99 4000
```

### 6. Android Debugging

Enable network debugging in Android:
1. Go to Settings > Developer Options
2. Enable "USB Debugging" and "Network Debugging"
3. Check Logcat for network errors:
   ```bash
   adb logcat | grep -i "network\|cleartext\|security"
   ```

### 7. Test with Different Network

Try connecting from:
- Different WiFi network
- Mobile data (if server is publicly accessible)
- Same network as development machine

## Error Messages Explained

- **"Network Error"** - Usually means Android is blocking HTTP traffic
  - Solution: Rebuild app with network security config
  
- **"Connection timeout"** - Device cannot reach server
  - Solution: Check network connectivity, firewall, VPN
  
- **"Connection refused"** - Server is not running or not accessible
  - Solution: Verify server is running and reachable

## Quick Checklist

- [ ] App has been rebuilt (not just hot reloaded)
- [ ] Old app uninstalled from device
- [ ] Network security config file exists in `android/app/src/main/res/xml/`
- [ ] AndroidManifest includes `usesCleartextTraffic="true"`
- [ ] Device can reach server IP (test in browser)
- [ ] Server is running and accessible
- [ ] Device and server on same network (if local)
- [ ] No firewall/VPN blocking connection

## Verification Steps

After rebuilding, verify the configuration was applied:

### Option 1: Use Verification Script
```bash
node scripts/verify-network-config.js
```

This will check:
- Network security config XML file exists
- AndroidManifest includes required attributes
- Configuration values are correct

### Option 2: Manual Verification

1. **Check if Android directory exists:**
   ```bash
   ls android/app/src/main/res/xml/network_security_config.xml
   ```

2. **Check AndroidManifest.xml:**
   ```bash
   grep -i "usesCleartextTraffic\|networkSecurityConfig" android/app/src/main/AndroidManifest.xml
   ```

3. **Check build logs:**
   Look for these messages during build:
   - `✅ Network security config file created at:`
   - `✅ AndroidManifest updated with network security config`

### Option 3: Test Network Connectivity in App

The app now includes network diagnostics. When you tap "Retry" on the connection error banner, it will:
- Test server connectivity
- Provide specific error messages
- Help identify the exact issue

## Still Having Issues?

### Debug Checklist:

1. **Verify Config Plugin Ran:**
   - Check build logs for config plugin output
   - Look for: `✅ Network security config file created`
   - If missing, the plugin may not be running

2. **Check Device Logs:**
   ```bash
   adb logcat | grep -i "network\|cleartext\|security\|socket"
   ```
   Look for errors like:
   - "Cleartext HTTP traffic not permitted"
   - "NetworkSecurityConfig"
   - Socket connection errors

3. **Test Server from Device Browser:**
   - Open Chrome on your device
   - Navigate to: `http://13.51.207.99:4000`
   - If it doesn't load, the device cannot reach the server (not an app issue)

4. **Verify Server is Running:**
   ```bash
   # From your computer
   curl http://13.51.207.99:4000
   ```

5. **Try Clean Rebuild:**
   ```bash
   # Clean and rebuild
   npx expo prebuild --clean
   npx expo run:android
   ```

6. **Check Network:**
   - Ensure device and server are on same network
   - Disable VPN if active
   - Try mobile data instead of WiFi (or vice versa)

7. **Alternative Solutions:**
   - Use HTTPS instead of HTTP (requires SSL certificate on server)
   - Use a domain name instead of IP address
   - Test with a different device to isolate device-specific issues
   - Check if server firewall is blocking connections

## Common Error Messages

- **"Network Error" or "ERR_NETWORK"**
  - Android is blocking HTTP traffic
  - Solution: Ensure app was rebuilt with network security config
  - Verify `usesCleartextTraffic="true"` in AndroidManifest

- **"Connection timeout"**
  - Device cannot reach server
  - Solution: Check network connectivity, firewall, VPN

- **"Connection refused"**
  - Server is not running or not accessible
  - Solution: Verify server is running and reachable

- **"Cleartext HTTP traffic not permitted"**
  - Network security config not applied
  - Solution: Rebuild app, verify config plugin ran

