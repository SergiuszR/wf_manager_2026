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

    // /api/webflow/assets/:assetId (GET, PATCH)
    const assetsIndex = pathComponents.indexOf('assets');
    if (
      assetsIndex !== -1 &&
      assetsIndex < pathComponents.length - 1 &&
      pathComponents[webflowIndex + 1] === 'assets' &&
      !path.includes('/sites/')
    ) {
      const assetId = pathComponents[assetsIndex + 1];
      const webflowToken = getEffectiveWebflowToken(req);
      if (!webflowToken) {
        res.status(401).json({ message: 'No Webflow token found' });
        return;
      }
      if (req.method === 'GET') {
        try {
          const response = await axios.get(`https://api.webflow.com/beta/assets/${assetId}`, {
            headers: { 'Authorization': `Bearer ${webflowToken}` }
          });
          res.status(200).json(response.data);
        } catch (error: any) {
          res.status(500).json({ message: 'Failed to fetch asset', error: error.message });
        }
        return;
      } else if (req.method === 'PATCH') {
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
        return;
      } else {
        res.status(405).json({ message: 'Method Not Allowed' });
        return;
      }
    }

    // /api/webflow/sites/:siteId/assets/csv (GET)
    if (path.includes('/sites/') && path.endsWith('/assets/csv')) {
      const siteIndex = pathComponents.indexOf('sites');
      if (siteIndex !== -1 && siteIndex < pathComponents.length - 1) {
        const siteId = pathComponents[siteIndex + 1];
        const webflowToken = getEffectiveWebflowToken(req);
        if (!webflowToken) {
          res.status(401).json({ message: 'No Webflow token found' });
          return;
        }
        if (req.method === 'GET') {
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
          return;
        }
        res.status(405).json({ message: 'Method Not Allowed' });
        return;
      }
    }

    // /api/webflow/sites/:siteId/assets (GET, POST)
    if (path.includes('/sites/') && path.endsWith('/assets')) {
      const siteIndex = pathComponents.indexOf('sites');
      if (siteIndex !== -1 && siteIndex < pathComponents.length - 1) {
        const siteId = pathComponents[siteIndex + 1];
        req.query.siteId = siteId;
        const webflowToken = getEffectiveWebflowToken(req);
        if (!webflowToken) {
          res.status(401).json({ message: 'No Webflow token found' });
          return;
        }
        if (req.method === 'POST') {
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
          return;
        }
        if (req.method === 'GET') {
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
            if (error.response) {
              console.error('Webflow API error (GET):', error.response.data);
              res.status(error.response.status || 500).json({
                message: 'Webflow API error',
                webflowError: error.response.data,
                status: error.response.status
              });
            } else {
              res.status(500).json({ message: 'Failed to fetch assets', error: error.message });
            }
          }
          return;
        }
        res.status(405).json({ message: 'Method Not Allowed' });
        return;
      }
    }

    console.log('No matching assets endpoint found for:', path);
    return res.status(404).send('Assets endpoint not found');
  } catch (error) {
    console.error('Error handling assets request:', error);
    res.status(500).send(`Server error: ${error.message}`);
  }
} 