const mongoose = require('mongoose');
const dns = require('dns');

// Force Google DNS to resolve MongoDB Atlas SRV records reliably in Node.js
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('[DATABASE] Error: MONGO_URI environment variable is not defined in .env file.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`[DATABASE] Successfully connected to MongoDB!`);
    console.log(`[DATABASE] Host: ${conn.connection.host}`);
    console.log(`[DATABASE] Database Name: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[DATABASE] Error: Connection failed!`);
    console.error(`[DATABASE] Details: ${error.message}`);
    
    console.error('\n=== MONGO DB ATLAS DIAGNOSTIC HELP ===');
    if (error.message.includes('auth failed') || error.message.includes('Authentication failed') || error.message.includes('bad auth')) {
      console.error('👉 Authentication Failed: The username or password in your MONGO_URI is incorrect.');
    } else if (error.message.includes('querySrv ETIMEOUT') || error.message.includes('ENOTFOUND') || error.message.includes('MongooseServerSelectionError') || error.message.includes('connect ECONNREFUSED')) {
      console.error('👉 Network or IP Whitelisting Error:');
      console.error('   1. Check if your current IP address is whitelisted in Atlas Network Access settings (set to 0.0.0.0/0 for access from anywhere).');
      console.error('   2. Verify your internet connection or DNS settings.');
    } else {
      console.error('👉 Other Configuration Issue: Please check that your MONGO_URI and database name are spelled correctly, and that your Atlas Cluster is active.');
    }
    console.error('======================================\n');

    process.exit(1);
  }
};

module.exports = connectDB;
