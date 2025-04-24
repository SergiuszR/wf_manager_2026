import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';

// Import routes
import authRoutes from './routes/auth';
import webflowRoutes from './routes/webflow';

// Load environment variables
dotenv.config();

// Set required environment variables for production mode
process.env.NODE_ENV = 'production';
process.env.PRODUCTION_MODE = 'true';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/webflow', webflowRoutes);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Debug endpoint to show environment configuration
app.get('/api/debug', (req: Request, res: Response) => {
  // Check for environment variables
  const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PRODUCTION_MODE: process.env.PRODUCTION_MODE,
    PORT: process.env.PORT,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '***' + process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-6) : undefined
  };
  
  res.status(200).json({
    config,
    message: 'Using real Webflow API v2 - no demo mode'
  });
});

// Start server without requiring MongoDB
console.log('Starting server with MongoDB connection disabled');
console.log('Environment variables:', {
  NODE_ENV: process.env.NODE_ENV,
  PRODUCTION_MODE: process.env.PRODUCTION_MODE,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '***' + process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-6) : undefined
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 