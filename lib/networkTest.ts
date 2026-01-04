/**
 * Network connectivity test utility
 * Use this to diagnose network issues on physical devices
 */

import axios from 'axios';

const SOCKET_URL = 'http://13.51.207.99:4000';
const API_URL = 'http://13.51.207.99:4000/api';

export interface NetworkTestResult {
  success: boolean;
  error?: string;
  details?: any;
}

/**
 * Test basic HTTP connectivity to the server
 */
export async function testServerConnectivity(): Promise<NetworkTestResult> {
  try {
    console.log('🔍 Testing server connectivity to:', SOCKET_URL);
    
    const response = await axios.get(SOCKET_URL, {
      timeout: 10000,
      validateStatus: (status) => status < 500, // Accept any status < 500
    });
    
    console.log('✅ Server responded with status:', response.status);
    return {
      success: true,
      details: {
        status: response.status,
        headers: response.headers,
      },
    };
  } catch (error: any) {
    console.error('❌ Server connectivity test failed:', error.message);
    
    let errorMessage = 'Unknown error';
    
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Connection timeout - Server did not respond within 10 seconds';
    } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      errorMessage = 'Network error - This usually means Android is blocking HTTP traffic. Ensure network security config is applied and app is rebuilt.';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused - Server is not running or not accessible from this network';
    } else if (error.code === 'ENOTFOUND' || error.message?.includes('getaddrinfo')) {
      errorMessage = 'DNS resolution failed - Cannot resolve server address';
    } else {
      errorMessage = error.message || 'Unknown network error';
    }
    
    return {
      success: false,
      error: errorMessage,
      details: {
        code: error.code,
        message: error.message,
      },
    };
  }
}

/**
 * Test API endpoint connectivity
 */
export async function testAPIConnectivity(): Promise<NetworkTestResult> {
  try {
    console.log('🔍 Testing API connectivity to:', API_URL);
    
    const response = await axios.get(API_URL, {
      timeout: 10000,
      validateStatus: (status) => status < 500,
    });
    
    console.log('✅ API responded with status:', response.status);
    return {
      success: true,
      details: {
        status: response.status,
      },
    };
  } catch (error: any) {
    console.error('❌ API connectivity test failed:', error.message);
    
    return {
      success: false,
      error: error.message || 'Unknown API error',
      details: {
        code: error.code,
        message: error.message,
      },
    };
  }
}

/**
 * Run all network tests and return comprehensive results
 */
export async function runNetworkDiagnostics(): Promise<{
  serverTest: NetworkTestResult;
  apiTest: NetworkTestResult;
  summary: string;
}> {
  console.log('🚀 Starting network diagnostics...\n');
  
  const serverTest = await testServerConnectivity();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between tests
  const apiTest = await testAPIConnectivity();
  
  let summary = '';
  if (serverTest.success && apiTest.success) {
    summary = '✅ All network tests passed!';
  } else if (!serverTest.success && !apiTest.success) {
    summary = '❌ Both server and API tests failed. This suggests a network connectivity issue or Android blocking HTTP traffic.';
  } else if (!serverTest.success) {
    summary = '⚠️ Server test failed but API test passed (unusual).';
  } else {
    summary = '⚠️ Server test passed but API test failed.';
  }
  
  console.log('\n📊 Network Diagnostics Summary:');
  console.log('Server Test:', serverTest.success ? '✅' : '❌', serverTest.error || 'Success');
  console.log('API Test:', apiTest.success ? '✅' : '❌', apiTest.error || 'Success');
  console.log('Summary:', summary);
  
  return {
    serverTest,
    apiTest,
    summary,
  };
}


