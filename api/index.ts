import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';

// Import routes from the server codebase
import authRoutes from '../server/src/routes/auth';
import webflowRoutes from '../server/src/routes/webflow';

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());

// Log all incoming API requests
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/webflow', webflowRoutes);

app.get('/api/health', (req: Request, res: Response) => {
  console.log('[API] /api/health called');
  res.status(200).json({ status: 'ok', message: 'Server is running (Vercel)' });
});

app.get('/api/debug', (req: Request, res: Response) => {
  console.log('[API] /api/debug called');
  const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PRODUCTION_MODE: process.env.PRODUCTION_MODE,
    PORT: process.env.PORT,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '***' + process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-6) : undefined
  };
  res.status(200).json({
    config,
    message: 'Using real Webflow API v2 - no demo mode (Vercel)'
  });
});

// Export the app as a Vercel handler
export default app; 