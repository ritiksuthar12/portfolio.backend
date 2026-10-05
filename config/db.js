const mongoose = require('mongoose');
const dbStore = require('../services/dbStore');

const DEFAULT_URI = 'mongodb://portfolio:8Sp4kW6VBDkVPPQK@ac-rmjpy3e-shard-00-00.n4w3u1a.mongodb.net:27017,ac-rmjpy3e-shard-00-01.n4w3u1a.mongodb.net:27017,ac-rmjpy3e-shard-00-02.n4w3u1a.mongodb.net:27017/portfoliodata?ssl=true&replicaSet=atlas-gyi082-shard-0&authSource=admin&appName=practice-mongo';

let cachedPromise = null;

const connectDB = async () => {
  // If already connected, return active connection
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    dbStore.setMongoConnected(true);
    return mongoose.connection;
  }

  // If a connection attempt is in progress, wait for it
  if (cachedPromise) {
    try {
      const conn = await cachedPromise;
      return conn;
    } catch {
      cachedPromise = null;
    }
  }

  const uri = process.env.MONGODB_URI || DEFAULT_URI;

  try {
    const maskedUri = uri.replace(/\/\/.*@/, '//<credentials>@');
    console.log(`Connecting to MongoDB at: ${maskedUri}`);

    cachedPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 10000,
    });

    const conn = await cachedPromise;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    dbStore.setMongoConnected(true);

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected.');
      cachedPromise = null;
      dbStore.setMongoConnected(false);
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected.');
      dbStore.setMongoConnected(true);
    });

    return conn;
  } catch (error) {
    cachedPromise = null;
    console.warn(`⚠️  MongoDB connection failed: ${error.message}`);
    dbStore.setMongoConnected(false);
    return null;
  }
};

module.exports = connectDB;

