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

    const { assetId, siteId, operation } = req.query;
    
    // GET method handlers
    if (req.method === 'GET') {
      if (assetId) {
        if (typeof assetId !== 'string') {
          res.status(400).json({ message: 'Invalid asset ID' });
          return;
        }
        
        // Get single asset by ID
        await getAssetById(req, res, assetId, webflowToken);
        return;
      } else if (siteId) {
        if (typeof siteId !== 'string') {
          res.status(400).json({ message: 'Invalid site ID' });
          return;
        }
        
        if (operation === 'csv') {
          // Get assets CSV for site
          await getAssetsCSV(req, res, siteId, webflowToken);
          return;
        } else {
          // Get all assets for site
          await getSiteAssets(req, res, siteId, webflowToken);
          return;
        }
      } else {
        res.status(400).json({ message: 'Site ID or asset ID is required' });
        return;
      }
    }
    
    // POST method handlers
    else if (req.method === 'POST') {
      if (siteId) {
        if (typeof siteId !== 'string') {
          res.status(400).json({ message: 'Invalid site ID' });
          return;
        }
        
        // Create asset for site
        await createAsset(req, res, siteId, webflowToken);
        return;
      } else {
        res.status(400).json({ message: 'Site ID is required' });
        return;
      }
    }
    
    // PATCH method handlers
    else if (req.method === 'PATCH') {
      if (assetId) {
        if (typeof assetId !== 'string') {
          res.status(400).json({ message: 'Invalid asset ID' });
          return;
        }
        
        // Update asset metadata
        await updateAsset(req, res, assetId, webflowToken);
        return;
      } else {
        res.status(400).json({ message: 'Asset ID is required' });
        return;
      }
    }
    
    // Method not allowed
    else {
      res.status(405).json({ message: 'Method Not Allowed' });
      return;
    }
  } catch (error: any) {
    console.error('Error in assets API:', error.message);
    res.status(500).json({ message: 'Failed to process request', error: error.message });
  }
}

// Handler to get asset by ID
async function getAssetById(req: VercelRequest, res: VercelResponse, assetId: string, webflowToken: string) {
  try {
    const response = await axios.get(`https://api.webflow.com/beta/assets/${assetId}`, {
      headers: {
        'Authorization': `Bearer ${webflowToken}`
      }
    });
    
    res.status(200).json(response.data);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch asset', error: error.message });
  }
}

// Handler to get all assets for a site
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

// Handler to get assets CSV for a site
async function getAssetsCSV(req: VercelRequest, res: VercelResponse, siteId: string, webflowToken: string) {
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
    
    const assets = response.data.assets || [];
    
    // Generate CSV content
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
    
    // Set CSV headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="assets-${siteId}.csv"`);
    
    res.status(200).send(csvContent);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to generate CSV', error: error.message });
  }
}

// Handler to create an asset
async function createAsset(req: VercelRequest, res: VercelResponse, siteId: string, webflowToken: string) {
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
    res.status(500).json({ message: 'Failed to create asset', error: error.message });
  }
}

// Handler to update an asset
async function updateAsset(req: VercelRequest, res: VercelResponse, assetId: string, webflowToken: string) {
  try {
    const { altText, displayName } = req.body;
    
    if (typeof altText !== 'string' && typeof displayName !== 'string') {
      res.status(400).json({ message: 'At least one of altText or displayName is required' });
      return;
    }
    
    const requestBody: Record<string, string> = {};
    
    if (typeof altText === 'string') requestBody.altText = altText;
    if (typeof displayName === 'string') requestBody.displayName = displayName;
    
    const response = await axios.patch(
      `https://api.webflow.com/beta/assets/${assetId}`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${webflowToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    res.status(200).json(response.data);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update asset', error: error.message });
  }
} 