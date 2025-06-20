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

async function getSiteAssets(req: VercelRequest, res: VercelResponse, siteId: string, webflowToken: string) {
  try {
    // Verify site exists
    const client = axios.create({
      baseURL: 'https://api.webflow.com',
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    await client.get(`/v2/sites/${siteId}`);
    
    // Get assets from beta API
    const response = await axios.get(`https://api.webflow.com/beta/sites/${siteId}/assets`, {
      headers: {
        'Authorization': `Bearer ${webflowToken}`
      }
    });
    res.status(200).json(response.data);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch assets', error: error.message });
  }
}

async function createSiteAsset(req: VercelRequest, res: VercelResponse, siteId: string, webflowToken: string) {
  try {
    const { fileName, fileHash } = req.body;
    if (!fileName || !fileHash) {
      res.status(400).json({ message: 'fileName and fileHash are required' });
      return;
    }
    const response = await axios.post(
      `https://api.webflow.com/beta/sites/${siteId}/assets`,
      { fileName, fileHash },
      {
        headers: {
          'Authorization': `Bearer ${webflowToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    res.status(200).json({
      uploadUrl: response.data.uploadUrl,
      uploadDetails: response.data.uploadDetails,
      id: response.data.id
    });
  } catch (error: any) {
    if (error.response) {
      console.error('Webflow API error (POST):', error.response.data);
      res.status(error.response.status || 500).json({
        message: 'Webflow API error',
        webflowError: error.response.data,
        status: error.response.status
      });
    } else {
      res.status(500).json({ message: 'Failed to create asset', error: error.message });
    }
  }
}

async function getSiteAssetsCSV(req: VercelRequest, res: VercelResponse, siteId: string, webflowToken: string) {
  try {
    // Verify site exists
    const client = axios.create({
      baseURL: 'https://api.webflow.com',
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    await client.get(`/v2/sites/${siteId}`);
    
    // Get assets from beta API
    const response = await axios.get(`https://api.webflow.com/beta/sites/${siteId}/assets`, {
      headers: { 'Authorization': `Bearer ${webflowToken}` }
    });
    const assets = response.data.assets || [];
    
    let csvContent = 'Name,Filename,URL,Size (KB),Content Type,Alt Text,Created,Updated\n';
    assets.forEach((asset: any) => {
      const sizeKB = asset.size ? Math.round(asset.size / 1024) : 0;
      const altText = asset.altText ? `"${asset.altText.replace(/"/g, '""')}"` : '';
      const displayName = asset.displayName ? `"${asset.displayName.replace(/"/g, '""')}"` : '';
      const filename = asset.originalFileName ? `"${asset.originalFileName.replace(/"/g, '""')}"` : '';
      const url = asset.hostedUrl || '';
      const contentType = asset.contentType || '';
      const created = asset.createdOn ? new Date(asset.createdOn).toLocaleDateString() : '';
      const updated = asset.lastUpdated ? new Date(asset.lastUpdated).toLocaleDateString() : '';
      csvContent += `${displayName},${filename},${url},${sizeKB},${contentType},${altText},${created},${updated}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="assets-${siteId}.csv"`);
    res.status(200).send(csvContent);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to generate CSV', error: error.message });
  }
}

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
    
    // Helper function with retry logic for rate limiting
    const makeRequestWithRetry = async (requestFn: () => Promise<any>, retryCount = 0): Promise<any> => {
      try {
        return await requestFn();
      } catch (error: any) {
        if (error.response?.status === 429 && retryCount < 3) {
          const delayMs = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`[SITES-GROUP] Rate limited, retrying in ${delayMs}ms (attempt ${retryCount + 1})`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return makeRequestWithRetry(requestFn, retryCount + 1);
        }
        throw error;
      }
    };
    
    // Get custom domains using the dedicated endpoint
    console.log(`[SITES-GROUP] Fetching custom domains for site ${siteId}`);
    let customDomainIds: string[] = [];
    
    try {
      const customDomainsResponse = await makeRequestWithRetry(() => 
        client.get(`/v2/sites/${siteId}/custom_domains`)
      );
      const customDomains = customDomainsResponse.data.customDomains || [];
      customDomainIds = customDomains.map((domain: any) => domain.id).filter(Boolean);
      console.log(`[SITES-GROUP] Found ${customDomainIds.length} custom domains:`, customDomainIds);
    } catch (error: any) {
      console.log(`[SITES-GROUP] Could not fetch custom domains:`, error.response?.data || error.message);
      // Continue without custom domains
    }
    
    // Prepare request body for publishing according to v2 API
    const publishBody: any = {
      customDomains: customDomainIds, // Use custom domain IDs if available
      publishToWebflowSubdomain: customDomainIds.length === 0 // Publish to webflow.io if no custom domains
    };
    
    if (scheduledTime) {
      try {
        const date = new Date(scheduledTime);
        publishBody.scheduledTime = date.toISOString();
      } catch (e) {
        res.status(400).json({ message: 'Invalid scheduled time format' });
        return;
      }
    }
    
    console.log(`[SITES-GROUP] Publishing site ${siteId} with body:`, publishBody);
    
    // Publish the site using v2 API with retry logic
    const response = await makeRequestWithRetry(() => 
      client.post(`/v2/sites/${siteId}/publish`, publishBody)
    );
    
    console.log(`[SITES-GROUP] Publish response:`, response.data);
    res.status(200).json({
      message: 'Site published successfully',
      publishDetails: response.data
    });
  } catch (error: any) {
    console.error(`[SITES-GROUP] Error publishing site:`, error.response?.data || error.message);
    
    if (error.response) {
      // Handle specific error cases
      if (error.response.status === 429) {
        res.status(429).json({ 
          message: 'Too many requests. Please wait before trying again. Note: Webflow has a rate limit of 1 publish per minute.',
          error: error.response.data 
        });
      } else {
        res.status(error.response.status).json({ 
          message: error.response.data?.message || 'Failed to publish site',
          error: error.response.data 
        });
      }
    } else {
      res.status(500).json({ 
        message: 'Failed to publish site', 
        error: error.message 
      });
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[SITES-GROUP] ${req.method} ${req.url}`);
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  const { url } = req;
  if (!url) return res.status(400).send('Missing URL');
  try {
    const path = url.split('?')[0];
    const pathComponents = path.split('/').filter(Boolean);
    console.log(`[SITES-GROUP] Path components:`, pathComponents);
    
    const webflowIndex = pathComponents.indexOf('webflow');
    if (webflowIndex === -1) {
      console.log(`[SITES-GROUP] No 'webflow' found in path:`, path);
      return res.status(404).send('Not found: Invalid path structure');
    }
    const webflowToken = getEffectiveWebflowToken(req);
    if (!webflowToken) {
      console.log(`[SITES-GROUP] No webflow token found`);
      res.status(401).json({ message: 'No Webflow token found' });
      return;
    }

    // /api/webflow/sites/publish
    if (path.endsWith('/sites/publish')) {
      console.log(`[SITES-GROUP] Publish site request, Method:`, req.method);
      if (req.method === 'POST') {
        return publishSite(req, res, webflowToken);
      }
      res.status(405).json({ message: 'Method Not Allowed' });
      return;
    }

    // /api/webflow/sites/:siteId/assets/csv
    if (path.includes('/sites/') && path.endsWith('/assets/csv')) {
      const siteIndex = pathComponents.indexOf('sites');
      if (siteIndex !== -1 && siteIndex < pathComponents.length - 1) {
        const siteId = pathComponents[siteIndex + 1];
        console.log(`[SITES-GROUP] Getting assets CSV for site:`, siteId);
        if (req.method === 'GET') {
          return getSiteAssetsCSV(req, res, siteId, webflowToken);
        }
        res.status(405).json({ message: 'Method Not Allowed' });
        return;
      }
    }

    // /api/webflow/sites/:siteId/assets
    if (path.includes('/sites/') && path.endsWith('/assets')) {
      const siteIndex = pathComponents.indexOf('sites');
      if (siteIndex !== -1 && siteIndex < pathComponents.length - 1) {
        const siteId = pathComponents[siteIndex + 1];
        console.log(`[SITES-GROUP] Assets request for site:`, siteId, 'Method:', req.method);
        if (req.method === 'GET') {
          return getSiteAssets(req, res, siteId, webflowToken);
        } else if (req.method === 'POST') {
          return createSiteAsset(req, res, siteId, webflowToken);
        }
        res.status(405).json({ message: 'Method Not Allowed' });
        return;
      }
    }
    
    // /api/webflow/sites
    if (path.endsWith('/sites')) {
      console.log(`[SITES-GROUP] Getting all sites`);
      return getSites(req, res, webflowToken);
    }
    
    console.log(`[SITES-GROUP] No matching route found for:`, path);
    res.status(404).send('Sites endpoint not found');
  } catch (error: any) {
    console.error(`[SITES-GROUP] Error:`, error.message);
    res.status(500).send(`Server error: ${error.message}`);
  }
} 