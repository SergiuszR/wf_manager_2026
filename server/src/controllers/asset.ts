import { Request, Response } from 'express';
import axios from 'axios';
import FormData from 'form-data';
import { RequestHandler } from 'express';
import { getUsersMap } from './webflow';

// Add interface for multer request with proper typing
interface RequestWithFile extends Request {
  file?: Express.Multer.File;
}

// Get the token from the user object using the shared users map
const getWebflowToken = (userId?: string): string | null => {
  if (!userId) {
    console.log('No user ID provided to asset controller');
    return null;
  }
  
  console.log(`Getting token for user ID: ${userId} in asset controller`);
  const users = getUsersMap();
  const user = users.get(userId);
  
  if (!user) {
    console.log(`User not found in memory store for ID: ${userId}`);
    return null;
  }
  
  console.log(`Found user in asset controller: ${JSON.stringify({
    id: user.id,
    hasToken: !!user.webflowToken,
    tokenLength: user.webflowToken ? user.webflowToken.length : 0
  })}`);
  
  return user.webflowToken || null;
};

/**
 * Get all assets for a site
 */
export const getAssets = (async (req: Request, res: Response) => {
  console.log('=== GET ASSETS START ===');
  
  // Check for header token first
  const headerToken = req.headers['x-webflow-token'] as string | undefined;
  if (headerToken) {
    console.log('Using token from x-webflow-token header');
    console.log(`Token length: ${headerToken.length}`);
    console.log(`First 5 chars: ${headerToken.substring(0, 5)}...`);
  } else {
    console.log('No x-webflow-token header found, trying user token');
  }
  
  // Get from user if no header token
  const webflowToken = headerToken || getWebflowToken(req.user);
  
  console.log(`User ID: ${req.user}`);
  console.log(`Header token present: ${!!headerToken}`);
  console.log(`User token present: ${!!getWebflowToken(req.user)}`);
  console.log(`Final token present: ${!!webflowToken}`);
  
  if (!webflowToken) {
    console.log('ERROR: No valid token found');
    return res.status(401).json({ message: 'No Webflow token found' });
  }

  const { siteId } = req.params;
  if (!siteId) {
    return res.status(400).json({ message: 'Site ID is required' });
  }

  try {
    console.log(`Fetching assets for site ${siteId}`);
    console.log(`Using token: ${webflowToken.substring(0, 5)}...${webflowToken.substring(webflowToken.length - 5)}`);
    
    const response = await axios.get(
      `https://api.webflow.com/beta/sites/${siteId}/assets`,
      {
        headers: {
          'Authorization': `Bearer ${webflowToken}`
        }
      }
    );

    // Debug log: print the full Webflow API response
    console.log('Webflow API asset response:', JSON.stringify(response.data, null, 2));

    console.log(`Found ${response.data.assets?.length || 0} assets`);
    console.log('=== GET ASSETS END ===');
    
    return res.status(200).json(response.data);
    
  } catch (error: any) {
    console.error('Error fetching assets:', error);
    console.error('Error response:', error.response?.data);
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Failed to fetch assets';
    
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message
    });
  }
}) as unknown as RequestHandler;

/**
 * Get a single asset by ID
 */
export const getAssetById = (async (req: Request, res: Response) => {
  console.log('=== GET ASSET BY ID START ===');
  const webflowToken = getWebflowToken(req.user);
  if (!webflowToken) {
    return res.status(401).json({ message: 'No Webflow token found' });
  }

  const { assetId } = req.params;
  if (!assetId) {
    return res.status(400).json({ message: 'Asset ID is required' });
  }

  try {
    console.log(`Fetching asset with ID ${assetId}`);
    const response = await axios.get(
      `https://api.webflow.com/beta/assets/${assetId}`,
      {
        headers: {
          'Authorization': `Bearer ${webflowToken}`
        }
      }
    );

    console.log('Asset fetched successfully');
    console.log('=== GET ASSET BY ID END ===');
    
    return res.status(200).json(response.data);
    
  } catch (error: any) {
    console.error('Error fetching asset:', error);
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Failed to fetch asset';
    
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message
    });
  }
}) as unknown as RequestHandler;

// Make this a custom request handler for multer
export const uploadAsset = (async (req: Request, res: Response) => {
  console.log('=== UPLOAD ASSET START ===');
  
  // Check for header token first
  const headerToken = req.headers['x-webflow-token'] as string | undefined;
  if (headerToken) {
    console.log('Using token from x-webflow-token header');
    console.log(`Token length: ${headerToken.length}`);
  } else {
    console.log('No x-webflow-token header found, trying user token');
  }
  
  // Get from user if no header token
  const webflowToken = headerToken || getWebflowToken(req.user);
  
  console.log(`User ID: ${req.user}`);
  console.log(`Header token present: ${!!headerToken}`);
  console.log(`User token present: ${!!getWebflowToken(req.user)}`);
  console.log(`Final token present: ${!!webflowToken}`);
  
  if (!webflowToken) {
    console.log('ERROR: No valid token found');
    return res.status(401).json({ message: 'No Webflow token found' });
  }

  const { siteId } = req.params;
  if (!siteId) {
    return res.status(400).json({ message: 'Site ID is required' });
  }

  // New beta API: expect fileName and fileHash in body
  const { fileName, fileHash } = req.body;
  if (!fileName || !fileHash) {
    return res.status(400).json({ message: 'fileName and fileHash are required' });
  }

  try {
    console.log(`Creating asset metadata for site ${siteId} with fileName: ${fileName}`);
    
    // Step 1: Request upload details from Webflow
    const response = await axios.post(
      `https://api.webflow.com/beta/sites/${siteId}/assets`,
      { fileName, fileHash },
      {
        headers: {
          'Authorization': `Bearer ${webflowToken}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    console.log('Successfully obtained upload details from Webflow');
    console.log('=== UPLOAD ASSET END ===');
    
    // Return uploadUrl, uploadDetails, and asset id to frontend
    return res.status(200).json({
      uploadUrl: response.data.uploadUrl,
      uploadDetails: response.data.uploadDetails,
      id: response.data.id
    });
  } catch (error: any) {
    console.error('Error uploading asset (step 1):', error);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', JSON.stringify(error.response.data));
    }
    
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Failed to get upload details from Webflow';
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message
    });
  }
}) as unknown as RequestHandler;

/**
 * Generate a CSV with all assets
 */
export const downloadAssetsCSV = (async (req: Request, res: Response) => {
  console.log('=== DOWNLOAD ASSETS CSV START ===');
  const webflowToken = getWebflowToken(req.user);
  if (!webflowToken) {
    return res.status(401).json({ message: 'No Webflow token found' });
  }

  const { siteId } = req.params;
  if (!siteId) {
    return res.status(400).json({ message: 'Site ID is required' });
  }

  try {
    console.log(`Fetching assets for site ${siteId}`);
    const response = await axios.get(
      `https://api.webflow.com/beta/sites/${siteId}/assets`,
      {
        headers: {
          'Authorization': `Bearer ${webflowToken}`
        }
      }
    );

    const assets = response.data.assets || [];
    console.log(`Found ${assets.length} assets`);

    // Generate CSV content
    const csvHeader = 'ID,Display Name,Original File Name,Content Type,Size (bytes),Hosted URL,Alt Text,Created On,Last Updated\n';
    const csvRows = assets.map((asset: any) => {
      return [
        asset.id || '',
        `"${(asset.displayName || '').replace(/"/g, '""')}"`,
        `"${(asset.originalFileName || '').replace(/"/g, '""')}"`,
        asset.contentType || '',
        asset.size != null ? asset.size : '',
        `"${asset.hostedUrl || ''}"`,
        `"${(asset.altText != null ? asset.altText : '').replace(/"/g, '""')}"`,
        asset.createdOn || '',
        asset.lastUpdated || ''
      ].join(',');
    }).join('\n');

    const csvContent = csvHeader + csvRows;
    
    // Set the appropriate headers for a CSV file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="webflow-assets-${siteId}.csv"`);
    
    console.log('=== DOWNLOAD ASSETS CSV END ===');
    return res.send(csvContent);
    
  } catch (error: any) {
    console.error('Error generating assets CSV:', error);
    if (error.response) {
      console.error('Backend error response data:', error.response.data);
      console.error('Backend error response status:', error.response.status);
      console.error('Backend error response headers:', error.response.headers);
    }
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Failed to generate assets CSV';
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message
    });
  }
}) as unknown as RequestHandler;

/**
 * Update asset altText
 */
export const updateAssetAltText = (async (req: Request, res: Response) => {
  console.log('=== UPDATE ASSET ALT TEXT START ===');
  
  // Check for header token first
  const headerToken = req.headers['x-webflow-token'] as string | undefined;
  if (headerToken) {
    console.log('Using token from x-webflow-token header');
    console.log(`Token length: ${headerToken.length}`);
  } else {
    console.log('No x-webflow-token header found, trying user token');
  }
  
  // Get from user if no header token
  const webflowToken = headerToken || getWebflowToken(req.user);
  
  console.log(`User ID: ${req.user}`);
  console.log(`Header token present: ${!!headerToken}`);
  console.log(`User token present: ${!!getWebflowToken(req.user)}`);
  console.log(`Final token present: ${!!webflowToken}`);
  
  if (!webflowToken) {
    console.log('ERROR: No valid token found');
    return res.status(401).json({ message: 'No Webflow token found' });
  }

  const { assetId } = req.params;
  const { altText, displayName } = req.body;
  if (!assetId) {
    return res.status(400).json({ message: 'Asset ID is required' });
  }
  if (typeof altText !== 'string' && typeof displayName !== 'string') {
    return res.status(400).json({ message: 'At least one of altText or displayName is required' });
  }

  try {
    // Prepare the request body with only the provided fields
    const requestBody: { altText?: string; displayName?: string } = {};
    if (typeof altText === 'string') {
      requestBody.altText = altText;
    }
    if (typeof displayName === 'string') {
      requestBody.displayName = displayName;
    }

    console.log(`Updating asset ${assetId} with data:`, requestBody);
    
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
    
    console.log('Asset updated successfully');
    console.log('=== UPDATE ASSET ALT TEXT END ===');
    
    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Error updating asset:', error);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }
    
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Failed to update asset';
    return res.status(statusCode).json({
      message: errorMessage,
      error: error.message
    });
  }
}) as unknown as RequestHandler; 