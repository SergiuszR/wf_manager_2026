import { VercelRequest, VercelResponse } from '@vercel/node';
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

async function publishSite(req: VercelRequest, res: VercelResponse, webflowToken: string) {
  try {
    console.log('[publishSite] Incoming body:', req.body);
    console.log('[publishSite] Incoming headers:', req.headers);
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
    // Fetch site details to get custom domain IDs
    const siteDetails = await client.get(`/v2/sites/${siteId}`);
    const customDomains = (siteDetails.data.customDomains || []).map((d: any) => d.id);

    const publishBody: any = {};
    if (customDomains.length > 0) {
      publishBody.customDomains = customDomains;
      publishBody.publishToWebflowSubdomain = true; // publish to both custom and .webflow.io
    } else {
      publishBody.publishToWebflowSubdomain = true; // only .webflow.io
    }

    if (scheduledTime) {
      try {
        const date = new Date(scheduledTime);
        publishBody.scheduledTime = date.toISOString();
      } catch (e) {
        res.status(400).json({ message: 'Invalid scheduled time format' });
        return;
      }
    }

    // Use the beta endpoint!
    const response = await client.post(`/beta/sites/${siteId}/publish`, publishBody);
    res.status(200).json(response.data);
  } catch (error: any) {
    console.error('[publishSite] Error:', error);
    res.status(500).json({ message: 'Failed to publish site', error: error.message, details: error.response?.data });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  const { url } = req;
  if (!url) return res.status(400).send('Missing URL');
  try {
    const path = url.split('?')[0];
    const pathComponents = path.split('/').filter(Boolean);
    const webflowIndex = pathComponents.indexOf('webflow');
    if (webflowIndex === -1) {
      return res.status(404).send('Not found: Invalid path structure');
    }
    const webflowToken = getEffectiveWebflowToken(req);
    if (!webflowToken) {
      res.status(401).json({ message: 'No Webflow token found' });
      return;
    }
    // /api/webflow/sites
    if (path.endsWith('/sites')) {
      return getSites(req, res, webflowToken);
    }
    // /api/webflow/sites/:siteId
    const sitesIndex = pathComponents.indexOf('sites');
    if (sitesIndex !== -1 && sitesIndex < pathComponents.length - 1) {
      const siteId = pathComponents[sitesIndex + 1];
      if (!path.includes('/assets')) {
        req.query.siteId = siteId;
        if (req.method === 'GET') {
          return getSiteById(req, res, siteId, webflowToken);
        } else if (req.method === 'POST') {
          return publishSite(req, res, webflowToken);
        }
      }
    }
    // /api/webflow/sites/publish
    if (path.endsWith('/sites/publish') && req.method === 'POST') {
      return publishSite(req, res, webflowToken);
    }
    res.status(404).send('Sites endpoint not found');
  } catch (error: any) {
    res.status(500).send(`Server error: ${error.message}`);
  }
} 