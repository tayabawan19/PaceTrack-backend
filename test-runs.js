const mongoose = require('mongoose');
const User = require('./models/User');
const Run = require('./models/Run');

const API_URL = 'http://localhost:5000/api';
const TEST_EMAIL = 'runtester@example.com';
const TEST_PASSWORD = 'password123';

const runTests = async () => {
  console.log('=== Starting PaceTrack Run API Integration Tests ===\n');

  // 1. Connect to database
  console.log('1. Connecting to local MongoDB...');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pacetrack');
  console.log('   Connected.');

  // Clean up existing test runs and users
  const existingUser = await User.findOne({ email: TEST_EMAIL });
  if (existingUser) {
    await Run.deleteMany({ user: existingUser._id });
    await User.deleteOne({ _id: existingUser._id });
  }
  console.log('   Cleaned up existing test records.');

  // Helper for JSON requests
  const apiRequest = async (path, method, body = {}, token = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: method !== 'GET' ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    return { status: response.status, data };
  };

  try {
    // 2. Register and verify a test user
    console.log('\n2. Registering and verifying user...');
    // Create pre-verified user directly in DB for testing convenience
    const user = new User({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      isVerified: true,
      profile: {
        name: 'Run Tester',
        weeklyGoalKm: 25
      }
    });
    await user.save();
    console.log('   User created and verified in DB.');

    // 3. Login to get token
    console.log('\n3. Logging in to obtain JWT token...');
    const loginRes = await apiRequest('/auth/login', 'POST', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    if (loginRes.status !== 200 || !loginRes.data.token) {
      throw new Error('Login failed, could not acquire token');
    }
    const token = loginRes.data.token;
    console.log('   Auth Token acquired.');

    // 4. Create Run 1 (today, 10km, 3000s, pace 5, 800 cal)
    console.log('\n4. Testing POST /api/runs (Run 1 - today)...');
    const startedAt1 = new Date(); // right now
    const run1Payload = {
      distanceKm: 10.2,
      durationSeconds: 3060,
      avgPaceMinPerKm: 5.0,
      caloriesBurned: 816,
      startedAt: startedAt1.toISOString(),
      route: [
        { latitude: 40.7128, longitude: -74.0060, timestamp: startedAt1.toISOString() },
        { latitude: 40.7138, longitude: -74.0070, timestamp: new Date(startedAt1.getTime() + 1000).toISOString() }
      ]
    };
    const createRun1Res = await apiRequest('/runs', 'POST', run1Payload, token);
    console.log('   Response status:', createRun1Res.status);
    if (createRun1Res.status !== 201) throw new Error('Create run 1 failed');
    const run1Id = createRun1Res.data._id;
    console.log('   Run 1 created with ID:', run1Id);

    // 5. Create Run 2 (5 days ago, 5.5km, 1800s, pace 5.4, 440 cal)
    console.log('\n5. Testing POST /api/runs (Run 2 - 5 days ago)...');
    const startedAt2 = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const run2Payload = {
      distanceKm: 5.5,
      durationSeconds: 1800,
      avgPaceMinPerKm: 5.45,
      caloriesBurned: 440,
      startedAt: startedAt2.toISOString(),
      route: []
    };
    const createRun2Res = await apiRequest('/runs', 'POST', run2Payload, token);
    console.log('   Response status:', createRun2Res.status);
    if (createRun2Res.status !== 201) throw new Error('Create run 2 failed');

    // 6. Create Run 3 (10 days ago, 8km, 2500s, pace 5.2, 640 cal)
    console.log('\n6. Testing POST /api/runs (Run 3 - 10 days ago)...');
    const startedAt3 = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const run3Payload = {
      distanceKm: 8.0,
      durationSeconds: 2500,
      avgPaceMinPerKm: 5.2,
      caloriesBurned: 640,
      startedAt: startedAt3.toISOString()
    };
    const createRun3Res = await apiRequest('/runs', 'POST', run3Payload, token);
    console.log('   Response status:', createRun3Res.status);
    if (createRun3Res.status !== 201) throw new Error('Create run 3 failed');

    // 7. Get Runs List
    console.log('\n7. Testing GET /api/runs...');
    const listRes = await apiRequest('/runs', 'GET', {}, token);
    console.log('   Response status:', listRes.status);
    console.log('   Total runs returned:', listRes.data.length);
    if (listRes.status !== 200 || listRes.data.length !== 3) {
      throw new Error('Failed to retrieve all user runs');
    }
    // Verify sorting newest first (startedAt desc)
    const listDates = listRes.data.map(r => new Date(r.startedAt).getTime());
    if (listDates[0] < listDates[1] || listDates[1] < listDates[2]) {
      throw new Error('Runs list is not sorted newest first');
    }
    console.log('   Runs list is sorted correctly.');

    // 8. Get Single Run Details
    console.log('\n8. Testing GET /api/runs/:id...');
    const detailsRes = await apiRequest(`/runs/${run1Id}`, 'GET', {}, token);
    console.log('   Response status:', detailsRes.status);
    if (detailsRes.status !== 200 || detailsRes.data.route.length !== 2) {
      throw new Error('Failed to retrieve correct run details');
    }
    console.log('   Run details matches created payload.');

    // 9. Get Aggregated Stats
    console.log('\n9. Testing GET /api/runs/stats (Aggregation Pipelines)...');
    const statsRes = await apiRequest('/runs/stats', 'GET', {}, token);
    console.log('   Response status:', statsRes.status);
    console.log('   Response data:', statsRes.data);
    
    if (statsRes.status !== 200) throw new Error('Failed to fetch aggregated stats');
    
    // Assert calculations
    // today stats: Run 1 only (10.2km, 816 cal)
    // weekly stats: Run 1 + Run 2 (10.2 + 5.5 = 15.7km)
    // total runs: Run 1 + Run 2 + Run 3 = 3
    // weeklyGoalKm: 25 (from profile)
    // todaySteps: 10.2 * 1300 = 13260
    const { todayDistanceKm, todaySteps, todayCalories, weeklyDistanceKm, totalRuns, weeklyGoalKm } = statsRes.data;
    
    if (Math.abs(todayDistanceKm - 10.2) > 0.01) throw new Error('Today distance is incorrect');
    if (todaySteps !== Math.round(10.2 * 1300)) throw new Error('Today steps calculation is incorrect');
    if (todayCalories !== 816) throw new Error('Today calories is incorrect');
    if (Math.abs(weeklyDistanceKm - 15.7) > 0.01) throw new Error('Weekly distance is incorrect');
    if (totalRuns !== 3) throw new Error('Total runs count is incorrect');
    if (weeklyGoalKm !== 25) throw new Error('Weekly goal is incorrect');

    console.log('   Aggregations match expected values exactly.');

    console.log('\n=== All Run API Tests Passed Successfully! ===');
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
};

runTests();
