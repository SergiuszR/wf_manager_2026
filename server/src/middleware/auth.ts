import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Authentication middleware
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('=== AUTH MIDDLEWARE START ===');
    console.log(`Path: ${req.path}`);
    console.log(`Method: ${req.method}`);
    console.log(`Headers: ${JSON.stringify(req.headers)}`);
    
    // Check for header auth bypass with x-webflow-token
    if (req.headers['x-webflow-token']) {
      console.log('x-webflow-token header present, bypassing JWT verification');
      // Set dummy user ID for controllers that need it
      req.user = 'webflow-api-user';
      return next();
    }
    
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    
    console.log(`Authorization header present: ${!!authHeader}`);
    
    if (!authHeader) {
      console.log('No authorization token provided');
      return res.status(401).json({ message: 'No authorization token provided' });
    }
    
    // Extract the token (Bearer format)
    const token = authHeader.split(' ')[1];
    
    console.log(`Token extracted: ${!!token}`);
    console.log(`Token length: ${token?.length}`);
    
    if (!token) {
      console.log('Invalid authorization format');
      return res.status(401).json({ message: 'Invalid authorization format' });
    }
    
    // Verify the token
    const secret = process.env.JWT_SECRET || '2LAhsbAhEHiRNHQnYktVIveHIjXNrDUHA0VO5OJNHDKYzbiAETafebnH8M6EW1VrRDUgJGa9wyRMnBg0Ru/vjg=='; // Using the Supabase JWT secret
    console.log(`Verifying token with secret length: ${secret.length}`);
    
    try {
      // Extract the sub from the payload, which contains the user ID
      const decoded = jwt.verify(token, secret);
      
      if (typeof decoded === 'object' && decoded !== null) {
        req.user = decoded.sub || decoded.id || 'unknown-user';
        console.log(`Decoded user ID: ${req.user}`);
      } else {
        req.user = 'unknown-user';
      }
      
      console.log('=== AUTH MIDDLEWARE END ===');
      
      // Continue to the next middleware/controller
      next();
    } catch (jwtError) {
      console.error('JWT verification failed, attempting to parse token without verification');
      
      // If verification fails, try to at least extract the user ID from the token
      try {
        const base64Payload = token.split('.')[1];
        const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf8'));
        req.user = payload.sub || 'unverified-user';
        console.log(`Using unverified user ID: ${req.user}`);
        next();
      } catch (parseError) {
        console.error('Failed to parse token payload:', parseError);
        console.log('Authentication failed');
        return res.status(401).json({ message: 'Authentication failed' });
      }
    }
  } catch (error) {
    console.error('Authentication error:', error);
    
    // Handle various JWT errors
    if (error instanceof jwt.TokenExpiredError) {
      console.log('Token expired');
      return res.status(401).json({ message: 'Token expired' });
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.log('Invalid token');
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    // Generic error
    console.log('Authentication failed');
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

// Extend Express Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: string;
    }
  }
} 