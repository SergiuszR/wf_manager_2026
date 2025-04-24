import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import axios, { AxiosError } from 'axios';
import { shareUser } from './webflow';

// In-memory user store since MongoDB is disabled
const users = new Map<string, any>();

// Function to share user data with other controllers
export const shareUserWithWebflow = (userId: string, userData: any) => {
  console.log(`Sharing user data for ID: ${userId} from auth controller`);
  users.set(userId, userData);
  // Also share with webflow controller
  shareUser(userId, userData);
};

// Authenticate with Webflow token
export const authenticateWithToken = async (req: Request, res: Response) => {
  try {
    console.log('Authenticate request received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    const { token, tokenName } = req.body;

    if (!token) {
      console.log('Token missing in request');
      return res.status(400).json({ message: 'Webflow token is required' });
    }

    if (!tokenName) {
      console.log('Token name missing in request');
      return res.status(400).json({ message: 'Token name is required' });
    }
    
    // Basic token validation - check minimal length
    if (token.length < 20) {
      console.error('⚠️ Invalid token detected - token too short');
      return res.status(400).json({ 
        message: 'Invalid token. Please use a real Webflow API token with sufficient length.' 
      });
    }

    console.log('Validating token with Webflow API v2...');
    
    // Validate token with direct API v2 call
    try {
      const sitesResponse = await axios({
        method: 'GET',
        url: 'https://api.webflow.com/v2/sites',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept-Version': '2.0.0',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Webflow API v2 sites response status:', sitesResponse.status);
      
      // Check if we have a valid response
      const sites = sitesResponse.data?.sites || [];
      
      console.log(`Found ${sites.length} sites`);
      
      if (sites.length === 0) {
        console.warn('Empty sites list returned - might be test/demo data or no sites');
      }
      
      // Check for signs of demo data - site names or URLs that look like examples
      const suspiciousSites = sites.filter((site: any) => {
        const displayName = (site.displayName || "").toLowerCase();
        const shortName = (site.shortName || "").toLowerCase();
        
        return displayName.includes('demo') || 
               displayName.includes('test') || 
               displayName.includes('example') ||
               shortName.includes('demo') || 
               shortName.includes('test') || 
               shortName.includes('example');
      });
      
      if (suspiciousSites && suspiciousSites.length > 0) {
        console.error('⚠️ DEMO SITES DETECTED - rejecting token');
        console.error('Suspicious sites:', JSON.stringify(suspiciousSites, null, 2));
        return res.status(400).json({ 
          message: 'Demo/test environment detected. Please use a real Webflow API token.' 
        });
      }
      
      // Generate a unique ID for the user
      const userId = generateUserId();
      console.log(`Generated user ID: ${userId}`);
      
      // Create user data
      const userData = {
        id: userId,
        webflowToken: token,
        tokenName
      };
      
      console.log('User data created:', JSON.stringify(userData, null, 2));
      
      // Store user in memory
      users.set(userId, userData);
      
      // Share user data with webflow controller
      shareUser(userId, userData);
      
      // Generate JWT session token
      const sessionToken = generateToken(userId);
      console.log(`Generated session token for user ${userId}`);

      res.status(200).json({
        message: 'Authentication successful',
        token: sessionToken,
        user: {
          id: userId,
          tokenName,
          webflowToken: token
        }
      });
    } catch (error: any) {
      console.error('Webflow API validation error:');
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
        
        // Handle specific API error responses
        if (error.response.status === 401) {
          return res.status(400).json({ message: 'Invalid Webflow token. Authentication failed.' });
        }
      }
      
      return res.status(400).json({ 
        message: 'Invalid Webflow token or insufficient permission scopes. Please ensure your token has the sites:read scope.'
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user profile
export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized - no user ID found' });
    }
    
    const user = users.get(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return user data including webflowToken
    res.json({
      user: {
        id: user.id,
        tokenName: user.tokenName,
        webflowToken: user.webflowToken
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper function to generate JWT token
const generateToken = (id: string): string => {
  const secret = process.env.JWT_SECRET || '2LAhsbAhEHiRNHQnYktVIveHIjXNrDUHA0VO5OJNHDKYzbiAETafebnH8M6EW1VrRDUgJGa9wyRMnBg0Ru/vjg==';
  return jwt.sign({ id }, secret);
};

// Helper function to generate a unique ID
const generateUserId = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}; 