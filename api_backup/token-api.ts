import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import jwt from 'jsonwebtoken';

function getEffectiveWebflowToken(req: VercelRequest): string | null {
  const headerToken = req.headers['x-webflow-token'] as string | undefined;
  if (headerToken) return headerToken;
  
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const secret = process.env.JWT_SECRET || '2LAhsbAhEHiRNHQnYktVIveHIjXNrDUHA0VO5OJNHDKYzbiAETafebnH8M6EW1VrRDUgJGa9wyRMnBg0Ru/vjg==';
        jwt.verify(token, secret);
      } catch (e) {}
    }
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Handle token validation
    if (req.method === 'GET' && req.url?.includes('/validate')) {
      await validateToken(req, res);
      return;
    }
    
    // Handle token saving
    if (req.method === 'POST' && !req.url?.includes('/validate')) {
      await saveToken(req, res);
      return;
    }
    
    // Method not allowed
    res.status(405).json({ message: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Error in token API:', error.message);
    res.status(500).json({ message: 'Failed to process request', error: error.message });
  }
}

// Handler to validate a Webflow token
async function validateToken(req: VercelRequest, res: VercelResponse) {
  const webflowToken = getEffectiveWebflowToken(req);
  
  if (!webflowToken) {
    res.status(401).json({ message: 'No Webflow token found' });
    return;
  }
  
  try {
    // Verify token by making a simple API call to get sites
    const client = axios.create({
      baseURL: 'https://api.webflow.com',
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    
    const response = await client.get('/v2/sites');
    const sites = response.data.sites || [];
    
    res.status(200).json({ 
      valid: true,
      sitesCount: sites.length,
      message: `Token is valid. Access to ${sites.length} sites.`
    });
  } catch (error: any) {
    // Token is invalid if API call fails
    console.error('Error validating token:', error.message);
    
    res.status(401).json({ 
      valid: false,
      message: error.response?.data?.message || 'Invalid token'
    });
  }
}

// Handler to save a Webflow token
async function saveToken(req: VercelRequest, res: VercelResponse) {
  const { token } = req.body;
  
  if (!token || typeof token !== 'string') {
    res.status(400).json({ message: 'Token is required' });
    return;
  }
  
  try {
    // Verify token by making a simple API call
    const client = axios.create({
      baseURL: 'https://api.webflow.com',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    
    const response = await client.get('/v2/sites');
    const sites = response.data.sites || [];
    
    // NOTE: In a real application, you would store the token in a database
    // Here we're just returning success
    
    res.status(200).json({ 
      success: true,
      sitesCount: sites.length,
      message: `Token saved. Access to ${sites.length} sites.`
    });
  } catch (error: any) {
    console.error('Error saving token:', error.message);
    
    res.status(401).json({ 
      success: false,
      message: error.response?.data?.message || 'Invalid token'
    });
  }
} 