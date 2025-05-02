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
    const webflowToken = getEffectiveWebflowToken(req);
    if (!webflowToken) {
      res.status(401).json({ message: 'No Webflow token found' });
      return;
    }

    const { siteId, operation } = req.query;
    
    // GET method handlers for sites
    if (req.method === 'GET') {
      if (!siteId) {
        // List all sites
        await getSites(req, res, webflowToken);
        return;
      } else if (typeof siteId === 'string') {
        // Get single site details
        await getSiteById(req, res, siteId, webflowToken);
        return;
      } else {
        res.status(400).json({ message: 'Invalid site ID' });
        return;
      }
    }
    
    // POST method handlers for publishing a site
    else if (req.method === 'POST') {
      if (operation === 'publish') {
        // Publish site
        await publishSite(req, res, webflowToken);
        return;
      } else {
        res.status(400).json({ message: 'Invalid operation' });
        return;
      }
    }
    
    // Method not allowed
    else {
      res.status(405).json({ message: 'Method Not Allowed' });
      return;
    }
  } catch (error: any) {
    console.error('Error in sites API:', error.message);
    res.status(500).json({ message: 'Failed to process request', error: error.message });
  }
}

// Handler to get all sites
async function getSites(req: VercelRequest, res: VercelResponse, webflowToken: string) {
  try {
    const client = axios.create({
      baseURL: 'https://api.webflow.com',
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    
    const response = await client.get('/v2/sites');
    
    // Enhance site objects with additional info
    const enhancedSites = (response.data.sites || []).map((site: any) => {
      return {
        ...site,
        displayName: site.displayName || site.shortName || 'Unnamed Site',
        domain: site.customDomains && site.customDomains.length > 0 
          ? site.customDomains[0].url 
          : `${site.shortName}.webflow.io`,
        url: site.customDomains && site.customDomains.length > 0 
          ? `https://${site.customDomains[0].url}`
          : `https://${site.shortName}.webflow.io`,
        previewUrl: `https://webflow.com/design/${site.id}`
      };
    });
    
    res.status(200).json({ sites: enhancedSites });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch sites', error: error.message });
  }
}

// Handler to get site by ID
async function getSiteById(req: VercelRequest, res: VercelResponse, siteId: string, webflowToken: string) {
  try {
    const client = axios.create({
      baseURL: 'https://api.webflow.com',
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    
    const response = await client.get(`/v2/sites/${siteId}`);
    
    const site = response.data;
    const enhancedSite = {
      ...site,
      displayName: site.displayName || site.shortName || 'Unnamed Site',
      domain: site.customDomains && site.customDomains.length > 0 
        ? site.customDomains[0].url 
        : `${site.shortName}.webflow.io`,
      url: site.customDomains && site.customDomains.length > 0 
        ? `https://${site.customDomains[0].url}`
        : `https://${site.shortName}.webflow.io`,
      previewUrl: `https://webflow.com/design/${site.id}`
    };
    
    res.status(200).json(enhancedSite);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch site details', error: error.message });
  }
}

// Handler to publish site
async function publishSite(req: VercelRequest, res: VercelResponse, webflowToken: string) {
  try {
    const { siteId, scheduledTime } = req.body;
    
    if (!siteId || typeof siteId !== 'string') {
      res.status(400).json({ message: 'Site ID is required' });
      return;
    }
    
    const client = axios.create({
      baseURL: 'https://api.webflow.com',
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    
    // Prepare request body for publishing
    const publishBody: any = { domains: 'all' };
    
    if (scheduledTime) {
      try {
        const date = new Date(scheduledTime);
        publishBody.scheduledTime = date.toISOString();
      } catch (e) {
        res.status(400).json({ message: 'Invalid scheduled time format' });
        return;
      }
    }
    
    // Publish the site
    const response = await client.post(`/v2/sites/${siteId}/publish`, publishBody);
    
    res.status(200).json(response.data);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to publish site', error: error.message });
  }
} 