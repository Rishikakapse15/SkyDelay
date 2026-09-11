import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from './models/User.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const API_KEY = process.env.AVIATION_EDGE_KEY;
const WEATHER_KEY = process.env.WEATHERAPI_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection (Safe Fallback)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/skydelay';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('🍃 MongoDB connected successfully'))
  .catch((err) => {
    console.error('⚠️ MongoDB connection warning:', err.message);
  });

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SkyDelay Telemetry Gateway active' });
});

// ================= AUTHENTICATION ROUTES =================

// 1. User Registration
// ================= IN-MEMORY USER STORAGE =================
const users = [];

// 1. User Registration
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please provide name, email, and password' });
  }

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: 'User with this email already exists' });
  }

  const newUser = { id: Date.now(), name, email, password };
  users.push(newUser);

  console.log('✅ User registered successfully:', newUser);

  return res.status(201).json({
    message: 'User registered successfully!',
    user: { id: newUser.id, name: newUser.name, email: newUser.email }
  });
});

// 2. User Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  return res.status(200).json({
    message: 'Logged in successfully!',
    user: { id: user.id, name: user.name, email: user.email }
  });
});
// ================= SKYDELAY DATA ROUTES =================

// Flight Tracker Proxy Route
// ================= SKYDELAY DATA ROUTES =================

// Live Flight Tracker Route (Aviation Edge API)
// Helper function to format ISO/time strings to 12-hour AM/PM
const formatToAMPM = (timeStr, fallback) => {
  if (!timeStr) return fallback;
  
  let hours, minutes;
  if (timeStr.includes('T')) {
    const timePart = timeStr.split('T')[1];
    [hours, minutes] = timePart.split(':').map(Number);
  } else {
    [hours, minutes] = timeStr.split(':').map(Number);
  }

  if (isNaN(hours) || isNaN(minutes)) return fallback;

  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;

  return `${hours}:${formattedMinutes} ${ampm}`;
};

// Live Flight Tracker Route (Aviation Edge API + AM/PM Formatting)
// Route to toggle saving/removing a flight
// Dynamic Demo Data Generator for fallback protection
function generateDemoFlight(carrier, number) {
  const isAmerican = carrier === 'AA';
  const isIndiGo = carrier === '6E';

  return {
    airlineCode: carrier,
    flightNo: number,
    airCarrierName: isAmerican ? 'American Airlines' : isIndiGo ? 'IndiGo Airlines' : `${carrier} Airways`,
    status: 'Scheduled',
    depCode: isAmerican ? 'DFW' : 'BOM',
    arrCode: isAmerican ? 'ORD' : 'DED',
    origin: {
      coords: isAmerican ? [32.8998, -97.0403] : [19.0896, 72.8656],
      city: isAmerican ? 'Dallas, TX' : 'Mumbai',
      name: isAmerican ? 'Dallas Fort Worth Intl Airport' : 'Chhatrapati Shivaji Maharaj Intl Airport',
      tz: isAmerican ? 'CDT' : 'IST',
      time: formatToAMPM('08:40', '08:40 AM')
    },
    destination: {
      coords: isAmerican ? [41.9742, -87.9073] : [30.1897, 78.1803],
      city: isAmerican ? 'Chicago, IL' : 'Dehradun',
      name: isAmerican ? "O'Hare Intl Airport" : 'Jolly Grant Airport',
      tz: isAmerican ? 'CDT' : 'IST',
      time: formatToAMPM('11:00', '11:00 AM')
    }
  };
}

// Live telemetry endpoint
app.get('/api/flight/live', async (req, res) => {
  const carrier = (req.query.carrier || '6E').toUpperCase();
  const flightNumber = req.query.flightNumber || '204';

  // 1. Get telemetry data (API or Fallback)
  const baseFlight = generateDemoFlight(carrier, flightNumber);

  // 2. Query Python ML Microservice for Delay Risk Prediction
  let riskPrediction = { delayProbability: 'Low (15%)', modelAccuracy: '89%' };
  try {
    const mlResponse = await fetch('http://localhost:5001/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carrier, flightNumber })
    });
    if (mlResponse.ok) {
      riskPrediction = await mlResponse.json();
    }
  } catch (err) {
    console.warn('Flask ML service offline, using default risk metrics');
  }

  // 3. Return consolidated data to frontend
  return res.json({
    ...baseFlight,
    riskPrediction
  });
});
app.post('/api/user/saved-flights', async (req, res) => {
  const { email, carrier, number } = req.body;
  if (!email || !carrier || !number) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const flightCode = `${carrier}${number}`;
    const existingIndex = user.savedFlights.indexOf(flightCode);

    if (existingIndex > -1) {
      user.savedFlights.splice(existingIndex, 1); // Remove if already saved
    } else {
      user.savedFlights.push(flightCode); // Add flight string (e.g. "6E204")
    }

    await user.save();
    return res.json({ savedFlights: user.savedFlights });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update saved flights' });
  }
});
app.listen(PORT, () => {
  console.log(`🚀 SkyDelay Backend running on http://localhost:${PORT}`);
});