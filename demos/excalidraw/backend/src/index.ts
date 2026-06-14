import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { dbAdapter } from './db.js';
import { statusRouter } from './routes/status.js';
import { createDionysysRouter } from './routes/dionysys.js';

dotenv.config();

const app = express();

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
app.use(cors({ 
  origin: allowedOrigin === '*' 
    ? true // Reflects request origin, effectively allowing all
    : allowedOrigin.split(',').map(s => s.trim()),
  credentials: true
}));
app.use(express.json());

const port = process.env.PORT || 3001;
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/autoui_ab_testing';

// Note: dbAdapter is imported from ./db.js

app.get('/health', (req, res) => {
  res.json({ status: 'ok', dbConnected: mongoose.connection.readyState === 1 });
});

// REST Routes
app.use('/api/dionysys', createDionysysRouter());
app.use('/api/status', statusRouter);

async function startServer() {
  try {
    await dbAdapter.connect(mongoUri);
    app.listen(port, () => {
      console.log(`Backend server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}


startServer();
