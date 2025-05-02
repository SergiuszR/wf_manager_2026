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
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  try {
    const { pageId } = req.query;
    if (!pageId || typeof pageId !== 'string') {
      res.status(400).json({ message: 'Page ID is required' });
      return;
    }

    const webflowToken = getEffectiveWebflowToken(req);
    if (!webflowToken) {
      res.status(401).json({ message: 'No Webflow token found' });
      return;
    }

    // Get site ID from query parameters or try to fetch it
    let { siteId } = req.query;
    
    if (!siteId || typeof siteId !== 'string') {
      try {
        // If siteId is not provided, try to get page details to find siteId
        const pageResponse = await axios.get(`https://api.webflow.com/v2/pages/${pageId}`, {
          headers: {
            'Authorization': `Bearer ${webflowToken}`,
            'Accept-Version': '2.0.0',
            'Content-Type': 'application/json',
          },
        });
        siteId = pageResponse.data.site.id;
      } catch (error: any) {
        res.status(500).json({ message: 'Failed to determine site ID for page', error: error.message });
        return;
      }
    }

    // Fetch the page DOM
    const response = await axios.get(`https://api.webflow.com/v2/sites/${siteId}/pages/${pageId}/dom`, {
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });

    res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Error fetching page DOM:', error.message);
    
    // Forward the appropriate status code from the Webflow API
    if (error.response?.status) {
      return res.status(error.response.status).json({ 
        message: 'Error fetching page DOM', 
        error: error.response?.data?.message || error.message 
      });
    }
    
    res.status(500).json({ message: 'Failed to fetch page DOM', error: error.message });
  }
} 