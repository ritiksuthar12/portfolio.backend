const mongoose = require('mongoose');
const dbStore = require('../services/dbStore');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ritik_portfolio';
  try {
    console.log(`Connecting to MongoDB at: ${uri.replace(/\/\/.*@/, '//<credentials>@')}`);
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    dbStore.setMongoConnected(true);

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Switched to JSON store fallback.');
      dbStore.setMongoConnected(false);
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected. Syncing data...');
      dbStore.setMongoConnected(true);
    });
  } catch (error) {
    console.warn(`⚠️  MongoDB connection failed: ${error.message}`);
    console.log(`ℹ️  Continuing with persistent local JSON store. You can configure MONGODB_URI in server/.env anytime!`);
    dbStore.setMongoConnected(false);
  }
};

module.exports = connectDB;
