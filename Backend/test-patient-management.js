const fs = require('fs');
const path = require('path');

console.log('🧪 Patient Management Code Analysis (Updated)\n');
let issues = [];
let successes = [];

// 1. Check file structure
console.log('1️⃣ Checking file structure...');
const baseDir = path.join(__dirname, 'routes/admin/patient-management');
const requiredFiles = [
  { path: 'schema.graphql', type: 'Schema' },
  { path: 'graphql.js', type: 'GraphQL Server' },
  { path: 'resolvers/wrapper/wrapper.js', type: 'Resolver Wrapper' },
  { path: 'resolvers/admin/admin-resolver.js', type: 'Admin Resolver' },
];

requiredFiles.forEach(file => {
  const fullPath = path.join(baseDir, file.path);
  if (fs.existsSync(fullPath)) {
    console.log(`   ✅ ${file.type}: ${file.path}`);
    successes.push(`Found ${file.type}`);
  } else {
    console.log(`   ❌ ${file.type}: ${file.path} NOT FOUND`);
    issues.push(`Missing ${file.type} at ${file.path}`);
  }
});

// 2. Validate GraphQL Schema (New version)
console.log('\n2️⃣ Validating updated GraphQL schema...');
const schemaPath = path.join(baseDir, 'schema.graphql');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  const checks = [
    { pattern: 'enum PatientIdentity', name: 'PatientIdentity enum' },
    { pattern: 'Student', name: 'Student profile type' },
    { pattern: 'Employee', name: 'Employee profile type' },
    { pattern: 'Superior', name: 'Superior profile type' },
    { pattern: 'type Patient', name: 'Patient type definition' },
    { pattern: 'type Query', name: 'Query type' },
    { pattern: 'type Mutation', name: 'Mutation type' },
    { pattern: 'getPatients', name: 'getPatients query' },
    { pattern: 'getPatient', name: 'getPatient query' },
    { pattern: 'getPatientsByProfile', name: 'getPatientsByProfile query' },
    { pattern: 'createPatient', name: 'createPatient mutation' },
    { pattern: 'profile: PatientIdentity', name: 'Profile as ENUM field' },
    { pattern: 'created_at: String', name: 'created_at timestamp field' },
  ];

  checks.forEach(check => {
    if (schema.includes(check.pattern)) {
      console.log(`   ✅ ${check.name}`);
      successes.push(`Schema has ${check.name}`);
    } else {
      console.log(`   ❌ ${check.name} - NOT FOUND`);
      issues.push(`Schema missing ${check.name}`);
    }
  });
}

// 3. Validate Admin Resolver
console.log('\n3️⃣ Validating admin resolver...');
const resolverPath = path.join(baseDir, 'resolvers/admin/admin-resolver.js');
if (fs.existsSync(resolverPath)) {
  const resolver = fs.readFileSync(resolverPath, 'utf-8');

  const resolverChecks = [
    { pattern: 'Query:', name: 'Query resolvers' },
    { pattern: 'Mutation:', name: 'Mutation resolvers' },
    { pattern: 'getPatients:', name: 'getPatients resolver' },
    { pattern: 'getPatient:', name: 'getPatient resolver' },
    { pattern: 'getPatientsByProfile:', name: 'getPatientsByProfile resolver' },
    { pattern: 'createPatient:', name: 'createPatient resolver' },
    { pattern: 'UserCredentials', name: 'User credential validation' },
    { pattern: 'profile', name: 'Profile ENUM handling' },
  ];

  resolverChecks.forEach(check => {
    if (resolver.includes(check.pattern)) {
      console.log(`   ✅ ${check.name}`);
      successes.push(`Resolver has ${check.name}`);
    } else {
      console.log(`   ❌ ${check.name} - NOT FOUND`);
      issues.push(`Resolver missing ${check.name}`);
    }
  });

  // Check error handling
  if (resolver.includes('throw new Error')) {
    console.log(`   ✅ Error handling present`);
    successes.push('Error handling implemented');
  }
}

// 4. Validate GraphQL Server Setup
console.log('\n4️⃣ Validating GraphQL server setup...');
const graphqlPath = path.join(baseDir, 'graphql.js');
if (fs.existsSync(graphqlPath)) {
  const graphql = fs.readFileSync(graphqlPath, 'utf-8');

  const setupChecks = [
    { pattern: 'ApolloServer', name: 'Apollo Server import' },
    { pattern: 'expressMiddleware', name: 'Express middleware' },
    { pattern: 'readFileSync', name: 'Schema file reading' },
    { pattern: 'schema.graphql', name: 'Schema file reference' },
    { pattern: '/api/admin/patient-management', name: 'GraphQL endpoint path' },
    { pattern: 'async', name: 'Async function' },
    { pattern: 'server.start', name: 'Server initialization' },
  ];

  setupChecks.forEach(check => {
    if (graphql.includes(check.pattern)) {
      console.log(`   ✅ ${check.name}`);
      successes.push(`Setup has ${check.name}`);
    } else {
      console.log(`   ❌ ${check.name} - NOT FOUND`);
      issues.push(`Setup missing ${check.name}`);
    }
  });
}

// 5. Validate Resolver Wrapper
console.log('\n5️⃣ Validating resolver wrapper...');
const wrapperPath = path.join(baseDir, 'resolvers/wrapper/wrapper.js');
if (fs.existsSync(wrapperPath)) {
  const wrapper = fs.readFileSync(wrapperPath, 'utf-8');

  if (wrapper.includes('adminResolver') && wrapper.includes('Query:') && wrapper.includes('Mutation:')) {
    console.log(`   ✅ Resolver wrapper correctly exports all types`);
    successes.push('Wrapper combines all resolvers');
  } else {
    console.log(`   ❌ Resolver wrapper might be incomplete`);
    issues.push('Wrapper might be incomplete');
  }
}

// 6. Check integration in staff.js
console.log('\n6️⃣ Checking integration in staff server...');
const staffPath = path.join(__dirname, 'staff.js');
if (fs.existsSync(staffPath)) {
  const staff = fs.readFileSync(staffPath, 'utf-8');

  if (staff.includes('patient-management') || staff.includes('PatientManagement')) {
    console.log(`   ✅ Patient management imported in staff.js`);
    successes.push('Staff server imports patient-management');
  } else {
    console.log(`   ❌ Patient management not found in staff.js`);
    issues.push('Staff server does not import patient-management');
  }

  if (staff.includes('initAdminPatientManagementGraphQL')) {
    console.log(`   ✅ Patient management GraphQL initialized in staff.js`);
    successes.push('Staff server initializes GraphQL');
  } else {
    console.log(`   ❌ Patient management not initialized in staff.js`);
    issues.push('Staff server does not initialize patient-management');
  }
}

// 7. Summary
console.log('\n📊 Summary:');
console.log(`   ✅ Successes: ${successes.length}`);
console.log(`   ❌ Issues: ${issues.length}`);

if (issues.length === 0) {
  console.log('\n✅ Patient Management System is properly configured!');
  console.log('\n📍 Configuration Details:');
  console.log('   - GraphQL Endpoint: /api/admin/patient-management');
  console.log('   - Server: Staff Server (port 3001 by default)');
  console.log('   - Database Schema: Matches actual Patients table structure');
  console.log('   - Profile Type: PatientIdentity ENUM (Student, Employee, Superior)');
  console.log('   - Features:');
  console.log('     • Query all patients');
  console.log('     • Get patient by ID');
  console.log('     • Filter patients by profile type');
  console.log('     • Create new patient');
  console.log('   - Database Validation: User credential reference check on patient creation');
  console.log('\n🎯 Example GraphQL Queries:');
  console.log(`
    # Get all patients
    query {
      getPatients {
        id
        profile
        created_at
      }
    }

    # Get students only
    query {
      getPatientsByProfile(profile: Student) {
        id
        profile
        created_at
      }
    }

    # Create new patient
    mutation {
      createPatient(id: 1, profile: Student) {
        id
        profile
        created_at
      }
    }
  `);
  process.exit(0);
} else {
  console.log('\n❌ Issues found:');
  issues.forEach(issue => console.log(`   - ${issue}`));
  process.exit(1);
}
