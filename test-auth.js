const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const API_URL = 'http://localhost:5000/api/auth';
const TEST_EMAIL = 'testuser@example.com';
const TEST_PASSWORD = 'password123';
const TEST_OTP = '123456';

const runTests = async () => {
  console.log('=== Starting PaceTrack Auth API Integration Tests ===\n');

  // 1. Connect to database
  console.log('1. Connecting to local MongoDB...');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pacetrack');
  console.log('   Connected.');

  // Clean up existing test user
  await User.deleteOne({ email: TEST_EMAIL });
  console.log(`   Cleaned up any existing test user: ${TEST_EMAIL}`);

  // Helper for JSON post/put requests
  const apiRequest = async (endpoint, method, body = {}, token = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: JSON.stringify(body)
    });
    const data = await response.json();
    return { status: response.status, data };
  };

  try {
    // 2. Signup Test
    console.log('\n2. Testing POST /signup...');
    const signupRes = await apiRequest('/signup', 'POST', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    console.log('   Response status:', signupRes.status);
    console.log('   Response data:', signupRes.data);
    if (signupRes.status !== 201) throw new Error('Signup failed');

    // Verify unverified user in DB
    const dbUserBefore = await User.findOne({ email: TEST_EMAIL });
    if (!dbUserBefore || dbUserBefore.isVerified !== false) {
      throw new Error('User was not saved or is marked verified incorrectly');
    }
    console.log('   User verified in DB: unverified status is correct');

    // 3. Inject fixed OTP for testing
    console.log('\n3. Overriding OTP in DB for testing...');
    const hashedOtp = await bcrypt.hash(TEST_OTP, 10);
    dbUserBefore.otp = hashedOtp;
    dbUserBefore.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
    await dbUserBefore.save();
    console.log(`   Set test OTP to "${TEST_OTP}" in DB`);

    // 4. Verify OTP with incorrect code
    console.log('\n4. Testing POST /verify-otp with WRONG code...');
    const wrongVerifyRes = await apiRequest('/verify-otp', 'POST', {
      email: TEST_EMAIL,
      otp: '999999'
    });
    console.log('   Response status:', wrongVerifyRes.status);
    console.log('   Response data:', wrongVerifyRes.data);
    if (wrongVerifyRes.status !== 400) throw new Error('Wrong OTP should be rejected');

    // 5. Verify OTP with correct code
    console.log('\n5. Testing POST /verify-otp with CORRECT code...');
    const correctVerifyRes = await apiRequest('/verify-otp', 'POST', {
      email: TEST_EMAIL,
      otp: TEST_OTP
    });
    console.log('   Response status:', correctVerifyRes.status);
    console.log('   Response data:', correctVerifyRes.data);
    if (correctVerifyRes.status !== 200 || !correctVerifyRes.data.token) {
      throw new Error('OTP verification failed with correct code');
    }
    const token = correctVerifyRes.data.token;
    console.log('   Received Auth Token:', token.substring(0, 20) + '...');

    // 6. Test Login (correct credentials)
    console.log('\n6. Testing POST /login with correct credentials...');
    const loginRes = await apiRequest('/login', 'POST', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    console.log('   Response status:', loginRes.status);
    console.log('   Response data:', loginRes.data);
    if (loginRes.status !== 200 || !loginRes.data.token) {
      throw new Error('Login failed');
    }

    // 7. Test Login (unverified/wrong credentials)
    console.log('\n7. Testing POST /login with invalid password...');
    const wrongLoginRes = await apiRequest('/login', 'POST', {
      email: TEST_EMAIL,
      password: 'wrongpassword'
    });
    console.log('   Response status:', wrongLoginRes.status);
    console.log('   Response data:', wrongLoginRes.data);
    if (wrongLoginRes.status === 200) throw new Error('Login with incorrect password should fail');

    // 8. Test Protected Profile Update
    console.log('\n8. Testing PUT /profile with valid token...');
    const profileUpdates = {
      name: 'Pace Tester',
      age: 28,
      gender: 'non-binary',
      fitnessLevel: 'advanced',
      goal: 'increase endurance',
      weeklyGoalKm: 35
    };
    const profileRes = await apiRequest('/profile', 'PUT', profileUpdates, token);
    console.log('   Response status:', profileRes.status);
    console.log('   Response data:', profileRes.data);
    if (profileRes.status !== 200 || profileRes.data.profile.name !== 'Pace Tester') {
      throw new Error('Profile update failed');
    }
    console.log('   Profile fields verified in response.');

    // 9. Test Profile Update with invalid token
    console.log('\n9. Testing PUT /profile with invalid token...');
    const invalidProfileRes = await apiRequest('/profile', 'PUT', profileUpdates, 'badtoken123');
    console.log('   Response status:', invalidProfileRes.status);
    console.log('   Response data:', invalidProfileRes.data);
    if (invalidProfileRes.status !== 401) {
      throw new Error('Profile update with invalid token should be rejected');
    }

    console.log('\n=== All Tests Passed Successfully! ===');
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
};

// Start tests
runTests();
