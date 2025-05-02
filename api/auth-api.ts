import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '2LAhsbAhEHiRNHQnYktVIveHIjXNrDUHA0VO5OJNHDKYzbiAETafebnH8M6EW1VrRDUgJGa9wyRMnBg0Ru/vjg==';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { url, method } = req;
    
    // Authenticate with token
    if (method === 'POST' && url?.includes('/authenticate')) {
      await handleAuthenticate(req, res);
      return;
    }
    
    // Register user
    if (method === 'POST' && url?.includes('/register')) {
      await handleRegister(req, res);
      return;
    }
    
    // Login user
    if (method === 'POST' && url?.includes('/login')) {
      await handleLogin(req, res);
      return;
    }
    
    // Get user profile
    if (method === 'GET' && url?.includes('/profile')) {
      await handleProfile(req, res);
      return;
    }
    
    // Method not allowed
    res.status(405).json({ message: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Error in auth API:', error.message);
    res.status(500).json({ message: 'Failed to process request', error: error.message });
  }
}

// Authenticate with a provided token
async function handleAuthenticate(req: VercelRequest, res: VercelResponse) {
  const { token, tokenName } = req.body;
  
  if (!token || typeof token !== 'string') {
    res.status(400).json({ message: 'Token is required' });
    return;
  }
  
  // For demo purposes, we're not doing actual authentication
  // In a real app, you'd verify the token against a service
  
  try {
    // Create a JWT with the token embedded
    const jwtToken = jwt.sign(
      { 
        webflowToken: token,
        name: tokenName || 'Unnamed Token',
        authenticated: true 
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    res.status(200).json({ 
      success: true,
      token: jwtToken,
      message: 'Authenticated successfully'
    });
  } catch (error: any) {
    res.status(401).json({ 
      success: false,
      message: 'Authentication failed'
    });
  }
}

// Register a new user
async function handleRegister(req: VercelRequest, res: VercelResponse) {
  const { username, password } = req.body;
  
  if (!username || !password) {
    res.status(400).json({ message: 'Username and password are required' });
    return;
  }
  
  // In a real app, you would store this in a database
  // For this demo, we'll just create a token
  
  try {
    const token = jwt.sign(
      { 
        username,
        authenticated: true 
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    res.status(200).json({ 
      success: true,
      token,
      message: 'User registered successfully'
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Registration failed'
    });
  }
}

// Login a user
async function handleLogin(req: VercelRequest, res: VercelResponse) {
  const { username, password } = req.body;
  
  if (!username || !password) {
    res.status(400).json({ message: 'Username and password are required' });
    return;
  }
  
  // In a real app, you would verify against a database
  // For this demo, we'll just create a token
  
  try {
    const token = jwt.sign(
      { 
        username,
        authenticated: true 
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    res.status(200).json({ 
      success: true,
      token,
      message: 'Login successful'
    });
  } catch (error: any) {
    res.status(401).json({ 
      success: false,
      message: 'Login failed'
    });
  }
}

// Get user profile
async function handleProfile(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    res.status(401).json({ message: 'No authorization header' });
    return;
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    res.status(200).json({ 
      username: decoded.username,
      webflowToken: decoded.webflowToken,
      authenticated: decoded.authenticated,
      name: decoded.name
    });
  } catch (error: any) {
    res.status(401).json({ message: 'Invalid token' });
  }
} 