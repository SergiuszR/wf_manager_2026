import { Request, Response, NextFunction } from 'express';

// Middleware to force real API mode
export const forceRealApiMode = (req: Request, res: Response, next: NextFunction) => {
  // Log headers for debugging
  console.log('Incoming request headers:', {
    'x-disable-demo': req.headers['x-disable-demo'],
    'x-use-real-api': req.headers['x-use-real-api']
  });
  
  // Set a global flag for this request to indicate that we should use the real API
  // This is available to all parts of the code handling this request
  (req as any).useRealApi = true;
  (req as any).disableMocks = true;
  
  // Force environment variables for this request
  process.env.DISABLE_WEBFLOW_MOCKS = 'true';
  process.env.PRODUCTION_MODE = 'true';
  process.env.WEBFLOW_API_REAL = 'true';
  process.env.NODE_ENV = 'production';
  
  console.log('Forcing real API mode for this request');
  
  // Continue to the next middleware
  next();
}; 