/**
 * Role Detection Algorithm Tests
 * 
 * This file tests the role detection logic from RoleContext.jsx
 */

// Simulate the getInitialRole function (improved version)
function getInitialRole(hostname) {
  const lowerHostname = hostname.toLowerCase();
  
  // Staff subdomain → medical role
  if (lowerHostname.startsWith('staff.')) {
    return 'medical';
  }
  
  // Default to patient role (www, root domain, localhost, etc.)
  return 'patient';
}

// Test cases
const testCases = [
  // Medical role (staff subdomain)
  { hostname: 'staff.mdsystem.com', expected: 'medical', description: 'Staff subdomain' },
  { hostname: 'staff.localhost', expected: 'medical', description: 'Staff localhost' },
  { hostname: 'staff.mdsystem.local', expected: 'medical', description: 'Staff local domain' },
  { hostname: 'staff.', expected: 'medical', description: 'Staff with just dot' },
  { hostname: 'Staff.mdsystem.com', expected: 'medical', description: 'Capital Staff (case insensitive)' },
  { hostname: 'STAFF.mdsystem.com', expected: 'medical', description: 'Uppercase STAFF' },
  
  // Patient role (www or default)
  { hostname: 'www.mdsystem.com', expected: 'patient', description: 'WWW subdomain' },
  { hostname: 'mdsystem.com', expected: 'patient', description: 'Root domain' },
  { hostname: 'localhost', expected: 'patient', description: 'Localhost' },
  { hostname: 'localhost:5173', expected: 'patient', description: 'Localhost with port' },
  { hostname: 'patient.mdsystem.com', expected: 'patient', description: 'Patient subdomain (not staff)' },
  { hostname: '192.168.1.1', expected: 'patient', description: 'IP address' },
  
  // Edge cases
  { hostname: 'staffing.mdsystem.com', expected: 'patient', description: 'Staffing subdomain (not staff.)' },
  { hostname: 'staff', expected: 'patient', description: 'Just "staff" without dot' },
  { hostname: '', expected: 'patient', description: 'Empty hostname (safe default)' },
];

console.log('=== ROLE DETECTION ALGORITHM TESTS ===\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = getInitialRole(test.hostname);
  const success = result === test.expected;
  
  if (success) {
    passed++;
    console.log(`✅ Test ${index + 1}: ${test.description}`);
    console.log(`   Hostname: "${test.hostname}" → Role: "${result}"\n`);
  } else {
    failed++;
    console.log(`❌ Test ${index + 1}: ${test.description}`);
    console.log(`   Hostname: "${test.hostname}"`);
    console.log(`   Expected: "${test.expected}", Got: "${result}"\n`);
  }
});

console.log('=== TEST SUMMARY ===');
console.log(`Total Tests: ${testCases.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
  console.log('\n✨ All tests passed! Algorithm is working correctly.\n');
  console.log('Algorithm behavior:');
  console.log('  • hostname starts with "staff." → medical role');
  console.log('  • Case insensitive (Staff. STAFF. staff. all work)');
  console.log('  • Anything else → patient role (safe default)');
  console.log('  • "staff" without dot → patient (security: requires explicit subdomain)');
} else {
  console.log('\n⚠️  ISSUES FOUND - See failed tests above');
}

// Export for Node.js execution
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getInitialRole, testCases };
}
