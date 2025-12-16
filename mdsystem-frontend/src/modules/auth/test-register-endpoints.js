/**
 * Registration Flow Endpoint Test
 * This file shows all the API endpoints called during the registration process
 * 
 * HOW TO RUN:
 * node mdsystem-frontend/src/modules/auth/test-register-endpoints.js
 */

// Base URL based on DEV_PORTAL setting in apiBaseUrlProvider.js
// Change DEV_PORTAL in apiBaseUrlProvider.js to 'www' or 'staff'
const DEV_PORTAL = 'www'; // Should match the setting in apiBaseUrlProvider.js
const BASE_URL = DEV_PORTAL === 'www' 
  ? 'https://www.mdsystemtip.space' 
  : 'https://www.mdsystemtip.space';

// Sample test data
const testData = {
  email: 'juan.delacruz@tip.edu.ph',
  password: 'TestPassword123!',
  role: 'patient',
  otp: '123456',
  verificationKey: 'sample-verification-key-12345'
};

console.log('========================================');
console.log('REGISTRATION FLOW - API ENDPOINTS TEST');
console.log('========================================\n');

console.log('Base URL:', BASE_URL);
console.log('Test Data:', JSON.stringify(testData, null, 2));
console.log('\n========================================\n');

// Step 1: Initial Registration
console.log('STEP 1: Initial Registration');
console.log('─────────────────────────────');
const step1Endpoint = 'auth/register';
const step1FullUrl = `${BASE_URL}/${step1Endpoint}`;
const step1Body = {
  email: testData.email,
  password: testData.password,
  role: testData.role
};
console.log('Method: POST');
console.log('Endpoint:', step1Endpoint);
console.log('Full URL:', step1FullUrl);
console.log('Request Body:', JSON.stringify(step1Body, null, 2));
console.log('\n');

// Step 2: Send Email Verification OTP
console.log('STEP 2: Send Email Verification OTP');
console.log('─────────────────────────────────────');
const step2Endpoint = '/auth/email/verification';
const step2FullUrl = `${BASE_URL}${step2Endpoint}`;
const step2Body = {
  email: testData.email,
  recaptchaToken: 'RECAPTCHA_TOKEN_PLACEHOLDER'
};
console.log('Method: POST');
console.log('Endpoint:', step2Endpoint);
console.log('Full URL:', step2FullUrl);
console.log('Request Body:', JSON.stringify(step2Body, null, 2));
console.log('\n');

// Step 3: Verify OTP
console.log('STEP 3: Verify Email OTP');
console.log('────────────────────────');
const step3Endpoint = '/auth/email/verification/verify';
const step3FullUrl = `${BASE_URL}${step3Endpoint}`;
const step3Body = {
  email: testData.email,
  otp: testData.otp
};
console.log('Method: POST');
console.log('Endpoint:', step3Endpoint);
console.log('Full URL:', step3FullUrl);
console.log('Request Body:', JSON.stringify(step3Body, null, 2));
console.log('Expected Response: { ok: true, verificationKey: "..." }');
console.log('\n');

// Step 3b: Resend OTP (optional)
console.log('STEP 3b: Resend OTP (Optional)');
console.log('──────────────────────────────');
const step3bEndpoint = '/auth/email/verification';
const step3bFullUrl = `${BASE_URL}${step3bEndpoint}`;
const step3bBody = {
  email: testData.email,
  recaptchaToken: 'RECAPTCHA_TOKEN_PLACEHOLDER'
};
console.log('Method: POST');
console.log('Endpoint:', step3bEndpoint);
console.log('Full URL:', step3bFullUrl);
console.log('Request Body:', JSON.stringify(step3bBody, null, 2));
console.log('\n');

// Step 4: Record Consent
console.log('STEP 4: Record Consent');
console.log('──────────────────────');
const step4Endpoint = 'auth/consent/register';
const step4FullUrl = `${BASE_URL}/${step4Endpoint}`;
const step4Body = {
  verificationKey: testData.verificationKey
};
console.log('Method: POST');
console.log('Endpoint:', step4Endpoint);
console.log('Full URL:', step4FullUrl);
console.log('Request Body:', JSON.stringify(step4Body, null, 2));
console.log('\n');

// Step 5: Complete Registration
console.log('STEP 5: Complete Registration');
console.log('─────────────────────────────');
const step5Endpoint = 'auth/register/complete';
const step5FullUrl = `${BASE_URL}/${step5Endpoint}`;
const step5Body = {
  verificationKey: testData.verificationKey,
  email: testData.email,
  password: testData.password,
  role: testData.role
};
console.log('Method: POST');
console.log('Endpoint:', step5Endpoint);
console.log('Full URL:', step5FullUrl);
console.log('Request Body:', JSON.stringify(step5Body, null, 2));
console.log('Expected Response: { ok: true, accessToken: "...", refreshToken: "..." }');
console.log('\n');

console.log('========================================');
console.log('SUMMARY - ALL ENDPOINTS');
console.log('========================================');
console.log('1. POST', step1FullUrl);
console.log('2. POST', step2FullUrl);
console.log('3. POST', step3FullUrl);
console.log('3b. POST', step3bFullUrl, '(resend)');
console.log('4. POST', step4FullUrl);
console.log('5. POST', step5FullUrl);
console.log('\n');

console.log('========================================');
console.log('NOTES');
console.log('========================================');
console.log('🔧 Current Portal:', DEV_PORTAL);
console.log('📡 Base URL:', BASE_URL);
console.log('');
console.log('⚠️  Notice the inconsistency:');
console.log('   - Step 1: "auth/register" (no leading slash)');
console.log('   - Step 2: "/auth/email/verification" (has leading slash)');
console.log('   - Step 4: "auth/consent/register" (no leading slash)');
console.log('');
console.log('When using axiosRequest with baseURL, these endpoints will resolve to:');
console.log('   - auth/register →', `${BASE_URL}/auth/register`);
console.log('   - /auth/email/verification →', `${BASE_URL}/auth/email/verification`);
console.log('');
console.log('✅ Best practice: Be consistent with or without leading slashes');
console.log('');
console.log('💡 To switch portals:');
console.log('   1. Open: src/services/apiBaseUrlProvider.js');
console.log('   2. Change: const DEV_PORTAL = \'www\' or \'staff\'');
console.log('   3. Update DEV_PORTAL in this test file to match');
console.log('');
