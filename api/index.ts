import express, { Request, Response, NextFunction, Router } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import axios from 'axios';

// Load environment variables
// Note: For Vercel deployment, make sure to add these environment variables in the Vercel dashboard:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - Any other environment variables used by the app
dotenv.config();

// Explicitly set production mode for Vercel environment
process.env.NODE_ENV = 'production';
process.env.PRODUCTION_MODE = 'true';

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());

// Log all incoming API requests
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// --------- Auth Middleware ---------
// Add user property to Request interface
declare global {
  namespace Express {
    interface Request {
      user?: string;
    }
  }
} 

// Authentication middleware
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('=== AUTH MIDDLEWARE START ===');
    console.log(`Path: ${req.path}`);
    console.log(`Method: ${req.method}`);
    
    // Check for header auth bypass with x-webflow-token
    if (req.headers['x-webflow-token']) {
      console.log('x-webflow-token header present, bypassing JWT verification');
      // Set dummy user ID for controllers that need it
      req.user = 'webflow-api-user';
      return next();
    }
    
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.log('No authorization token provided');
      return res.status(401).json({ message: 'No authorization token provided' });
    }
    
    // Extract the token (Bearer format)
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      console.log('Invalid authorization format');
      return res.status(401).json({ message: 'Invalid authorization format' });
    }
    
    // Verify the token
    const secret = process.env.JWT_SECRET || '2LAhsbAhEHiRNHQnYktVIveHIjXNrDUHA0VO5OJNHDKYzbiAETafebnH8M6EW1VrRDUgJGa9wyRMnBg0Ru/vjg==';
    
    try {
      // Extract the sub from the payload, which contains the user ID
      const decoded = jwt.verify(token, secret);
      
      if (typeof decoded === 'object' && decoded !== null) {
        req.user = decoded.sub || decoded.id || 'unknown-user';
      } else {
        req.user = 'unknown-user';
      }
      
      // Continue to the next middleware/controller
      next();
    } catch (error) {
      console.error('JWT verification failed');
      return res.status(401).json({ message: 'Authentication failed' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

// --------- Auth Routes ---------
const authRouter = Router();

// In-memory user store
const users = new Map<string, any>();

// Authenticate with Webflow token
authRouter.post('/authenticate', async (req: Request, res: Response) => {
  try {
    console.log('Authenticate request received');
    const { token, tokenName } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Webflow token is required' });
    }

    if (!tokenName) {
      return res.status(400).json({ message: 'Token name is required' });
    }
    
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
      
      // Generate a unique ID for the user
      const userId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Create user data
      const userData = {
        id: userId,
        webflowToken: token,
        tokenName
      };
      
      // Store user in memory
      users.set(userId, userData);
      
      // Generate JWT session token
      const secret = process.env.JWT_SECRET || '2LAhsbAhEHiRNHQnYktVIveHIjXNrDUHA0VO5OJNHDKYzbiAETafebnH8M6EW1VrRDUgJGa9wyRMnBg0Ru/vjg==';
      const sessionToken = jwt.sign({ id: userId }, secret);

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
        
        // Handle specific API error responses
        if (error.response.status === 401) {
          return res.status(400).json({ message: 'Invalid Webflow token. Authentication failed.' });
        }
      }
      
      return res.status(400).json({ 
        message: 'Invalid Webflow token or insufficient permission scopes.'
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile
authRouter.get('/profile', authenticate, async (req: Request, res: Response) => {
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
});

// --------- Webflow Routes ---------
const webflowRouter = Router();

// Helper for webflow token
const getWebflowToken = (userId?: string): string | null => {
  if (!userId) {
    return null;
  }
  const user = users.get(userId);
  return user?.webflowToken || null;
};

// Create Webflow API client
const createWebflowAPIClient = (token: string) => {
  return axios.create({
    baseURL: 'https://api.webflow.com',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept-Version': '2.0.0',
      'Content-Type': 'application/json'
    }
  });
};

// Get a token from request (either from x-webflow-token header or user)
const getEffectiveWebflowToken = (req: Request): string | null => {
  const headerToken = req.headers['x-webflow-token'] as string | undefined;
  return headerToken || getWebflowToken(req.user);
};

// Helper to construct URLs
const constructPublishedUrl = (siteInfo: any, page: any): string | null => {
  if (!siteInfo || !page) return null;
  
  // Default to site's domain if available
  const domain = siteInfo.domain || null;
  if (!domain) return null;
  
  // Construct URL based on page slug
  return `https://${domain}${page.slug === 'index' ? '' : `/${page.slug}`}`;
};

const constructPreviewUrl = (siteId: string, pageId: string): string => {
  return `https://webflow.com/design/${siteId}/edit/page/${pageId}`;
};

// Get all Webflow sites
webflowRouter.get('/sites', authenticate, async (req: Request, res: Response) => {
  try {
    const webflowToken = getEffectiveWebflowToken(req);
    
    if (!webflowToken) {
      return res.status(401).json({ message: 'No Webflow token found' });
    }

    // Make API call to Webflow
    const response = await axios.get(
      'https://api.webflow.com/v2/sites',
      {
        headers: {
          'Authorization': `Bearer ${webflowToken}`,
          'Accept-Version': '2.0.0'
        }
      }
    );

    return res.status(200).json(response.data);
    
  } catch (error: any) {
    console.error('Error fetching sites:', error);
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Failed to fetch sites';
    
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message
    });
  }
});

// Get all pages from all sites
webflowRouter.get('/pages', authenticate, async (req: Request, res: Response) => {
  try {
    const webflowToken = getEffectiveWebflowToken(req);
    
    if (!webflowToken) {
      return res.status(401).json({ message: 'No Webflow token found' });
    }

    // Create API client
    const client = createWebflowAPIClient(webflowToken);
    
    // 1. First get all sites
    const sitesResponse = await client.get('/v2/sites');
    const sites: any[] = sitesResponse.data.sites || [];
    
    console.log(`Found ${sites.length} sites`);
    
    if (sites.length === 0) {
      return res.status(200).json({ 
        pages: [],
        message: 'No sites found for this token'
      });
    }
    
    // 2. Get pages for each site using v2 API
    let allPages: any[] = [];
    
    for (const site of sites) {
      try {
        // Use the v2 endpoint format
        const pagesResponse = await client.get(`/v2/sites/${site.id}/pages`);
        const pages: any[] = pagesResponse.data?.pages || [];
        
        console.log(`Found ${pages.length} pages for site ${site.id}`);
        
        // Get site info to add domain information
        const siteInfoResponse = await client.get(`/v2/sites/${site.id}`);
        const siteInfo: any = siteInfoResponse.data;
        
        // Enhance page objects with site info
        const enhancedPages: any[] = pages.map((page: any) => ({
          ...page,
          siteName: site.displayName || site.shortName,
          siteId: site.id,
          // Add URLs for convenience
          url: constructPublishedUrl(siteInfo, page),
          previewUrl: constructPreviewUrl(site.id, page.id)
        }));
        
        allPages = [...allPages, ...enhancedPages];
      } catch (error: any) {
        console.error(`Error fetching pages for site ${site.id}:`, error.message);
        // Continue to next site
      }
    }
    
    // Return all pages found
    return res.status(200).json({ pages: allPages });
    
  } catch (error: any) {
    console.error('Error fetching pages:', error);
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Failed to fetch pages';
    
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message
    });
  }
});

// Get details about a specific page
webflowRouter.get('/pages/:pageId', authenticate, async (req: Request, res: Response) => {
  try {
    const webflowToken = getEffectiveWebflowToken(req);
    const { pageId } = req.params;
    const { siteId } = req.query;

    if (!webflowToken) {
      return res.status(400).json({ message: 'No Webflow token available' });
    }

    if (!pageId) {
      return res.status(400).json({ message: 'Page ID is required' });
    }

    if (!siteId) {
      return res.status(400).json({ message: 'Site ID is required as a query parameter' });
    }

    // Create API client
    const client = createWebflowAPIClient(webflowToken);
    
    // First, get the site info
    const siteResponse = await client.get(`/v2/sites/${siteId}`);
    const site = siteResponse.data;
    
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }
    
    // Then get all pages for this site
    const pagesResponse = await client.get(`/v2/sites/${siteId}/pages`);
    
    // Find the specific page in the response
    const pages = pagesResponse.data?.pages || [];
    const page = pages.find((p: any) => p.id === pageId);
    
    if (!page) {
      return res.status(404).json({ message: 'Page not found in this site' });
    }
    
    // Enhance the page data with additional information
    const enhancedPage = {
      ...page,
      siteName: site.displayName || site.shortName,
      siteId: site.id,
      url: constructPublishedUrl(site, page),
      previewUrl: constructPreviewUrl(siteId as string, pageId)
    };
    
    return res.status(200).json(enhancedPage);
    
  } catch (error: any) {
    console.error('Error getting page details:', error);
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Failed to get page details';
    
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message
    });
  }
});

// Get all collections
webflowRouter.get('/collections', authenticate, async (req: Request, res: Response) => {
  try {
    const webflowToken = getEffectiveWebflowToken(req);
    
    if (!webflowToken) {
      return res.status(401).json({ message: 'No Webflow token found' });
    }

    // Create API client
    const client = createWebflowAPIClient(webflowToken);
    
    // 1. First get all sites
    const sitesResponse = await client.get('/v2/sites');
    const sites: any[] = sitesResponse.data.sites || [];
    
    if (sites.length === 0) {
      return res.status(200).json({ 
        collections: [],
        message: 'No sites found for this token'
      });
    }
    
    // 2. Get collections for each site
    let allCollections: any[] = [];
    
    for (const site of sites) {
      try {
        const collectionsResponse = await client.get(`/v2/sites/${site.id}/collections`);
        const collections: any[] = collectionsResponse.data?.collections || [];
        
        // Enhance collection objects with site info
        const enhancedCollections = collections.map(collection => ({
          ...collection,
          siteName: site.displayName || site.shortName,
          siteId: site.id,
          // Include the Designer URL for convenience
          designerUrl: `https://webflow.com/design/${site.id}/collections/${collection.id}`
        }));
        
        allCollections = [...allCollections, ...enhancedCollections];
      } catch (error: any) {
        console.error(`Error fetching collections for site ${site.id}:`, error.message);
        // Continue to next site
      }
    }
    
    // Return all collections found
    return res.status(200).json({ collections: allCollections });
    
  } catch (error: any) {
    console.error('Error fetching collections:', error);
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Failed to fetch collections';
    
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message
    });
  }
});

// Get collection details
webflowRouter.get('/collections/:collectionId', authenticate, async (req: Request, res: Response) => {
  try {
    const webflowToken = getEffectiveWebflowToken(req);
    const { collectionId } = req.params;
    
    if (!webflowToken) {
      return res.status(401).json({ message: 'No Webflow token found' });
    }

    if (!collectionId) {
      return res.status(400).json({ message: 'Collection ID is required' });
    }

    // Create API client
    const client = createWebflowAPIClient(webflowToken);
    
    // Get collection details
    const response = await client.get(`/v2/collections/${collectionId}`);
    
    return res.status(200).json(response.data);
    
  } catch (error: any) {
    console.error('Error fetching collection details:', error);
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Failed to fetch collection details';
    
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message
    });
  }
});

// Get collection items
webflowRouter.get('/collections/:collectionId/items', authenticate, async (req: Request, res: Response) => {
  try {
    const webflowToken = getEffectiveWebflowToken(req);
    const { collectionId } = req.params;
    
    if (!webflowToken) {
      return res.status(401).json({ message: 'No Webflow token found' });
    }

    if (!collectionId) {
      return res.status(400).json({ message: 'Collection ID is required' });
    }

    // Create API client
    const client = createWebflowAPIClient(webflowToken);
    
    // Get collection items
    const response = await client.get(`/v2/collections/${collectionId}/items`);
    
    return res.status(200).json(response.data);
    
  } catch (error: any) {
    console.error('Error fetching collection items:', error);
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Failed to fetch collection items';
    
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message
    });
  }
});

// Get assets for a site
webflowRouter.get('/sites/:siteId/assets', authenticate, async (req: Request, res: Response) => {
  try {
    const webflowToken = getEffectiveWebflowToken(req);
    const { siteId } = req.params;
    
    console.log(`[ASSETS] Getting assets for site ID: ${siteId}`);
    
    if (!webflowToken) {
      console.log('[ASSETS] No Webflow token found');
      return res.status(401).json({ message: 'No Webflow token found' });
    }

    if (!siteId) {
      console.log('[ASSETS] No site ID provided');
      return res.status(400).json({ message: 'Site ID is required' });
    }

    // First, verify that the site exists
    try {
      const client = createWebflowAPIClient(webflowToken);
      console.log(`[ASSETS] Verifying site ${siteId} exists`);
      
      await client.get(`/v2/sites/${siteId}`);
      console.log(`[ASSETS] Site ${siteId} exists, proceeding to get assets`);
    } catch (siteError: any) {
      console.error(`[ASSETS] Error verifying site ${siteId}:`, siteError.message);
      if (siteError.response?.status === 404) {
        return res.status(404).json({ 
          message: 'Site not found',
          error: `Site with ID ${siteId} does not exist or you don't have access to it`
        });
      }
      throw siteError; // Re-throw to be caught by the outer catch
    }

    console.log(`[ASSETS] Making beta API call for assets`);
    // Assets are in the beta API
    const response = await axios.get(
      `https://api.webflow.com/beta/sites/${siteId}/assets`,
      {
        headers: {
          'Authorization': `Bearer ${webflowToken}`
        }
      }
    );

    console.log(`[ASSETS] Found ${response.data.assets?.length || 0} assets for site ${siteId}`);
    
    // Mock response for testing if needed
    // const mockAssets = {
    //   assets: [
    //     {
    //       id: 'mock-asset-1',
    //       displayName: 'Mock Asset 1',
    //       originalFileName: 'mock1.jpg',
    //       contentType: 'image/jpeg',
    //       size: 12345,
    //       hostedUrl: 'https://example.com/mock1.jpg',
    //       altText: 'Mock image 1',
    //       createdOn: new Date().toISOString(),
    //       lastUpdated: new Date().toISOString()
    //     }
    //   ]
    // };
    // return res.status(200).json(mockAssets);
    
    return res.status(200).json(response.data);
    
  } catch (error: any) {
    console.error('[ASSETS] Error fetching assets:', error.message);
    if (error.response) {
      console.error('[ASSETS] Response status:', error.response.status);
      console.error('[ASSETS] Response data:', JSON.stringify(error.response.data));
    }
    
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Failed to fetch assets';
    
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message
    });
  }
});

// Get asset by ID
webflowRouter.get('/assets/:assetId', authenticate, async (req: Request, res: Response) => {
  try {
    const webflowToken = getEffectiveWebflowToken(req);
    const { assetId } = req.params;
    
    if (!webflowToken) {
      return res.status(401).json({ message: 'No Webflow token found' });
    }

    if (!assetId) {
      return res.status(400).json({ message: 'Asset ID is required' });
    }

    // Assets are in the beta API
    const response = await axios.get(
      `https://api.webflow.com/beta/assets/${assetId}`,
      {
        headers: {
          'Authorization': `Bearer ${webflowToken}`
        }
      }
    );
    
    return res.status(200).json(response.data);
    
  } catch (error: any) {
    console.error('Error fetching asset details:', error);
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Failed to fetch asset details';
    
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message
    });
  }
});

// Create asset (get upload URL)
webflowRouter.post('/sites/:siteId/assets', authenticate, async (req: Request, res: Response) => {
  try {
    const webflowToken = getEffectiveWebflowToken(req);
    const { siteId } = req.params;
    const { fileName, fileHash } = req.body;
    
    if (!webflowToken) {
      return res.status(401).json({ message: 'No Webflow token found' });
    }

    if (!siteId) {
      return res.status(400).json({ message: 'Site ID is required' });
    }

    if (!fileName || !fileHash) {
      return res.status(400).json({ message: 'fileName and fileHash are required' });
    }

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
    
    // Return uploadUrl, uploadDetails, and asset id to frontend
    return res.status(200).json({
      uploadUrl: response.data.uploadUrl,
      uploadDetails: response.data.uploadDetails,
      id: response.data.id
    });
    
  } catch (error: any) {
    console.error('Error creating asset:', error);
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Failed to create asset';
    
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message
    });
  }
});

// Download assets CSV
webflowRouter.get('/sites/:siteId/assets/csv', authenticate, async (req: Request, res: Response) => {
  try {
    const webflowToken = getEffectiveWebflowToken(req);
    const { siteId } = req.params;
    
    if (!webflowToken) {
      return res.status(401).json({ message: 'No Webflow token found' });
    }

    if (!siteId) {
      return res.status(400).json({ message: 'Site ID is required' });
    }

    // Fetch assets
    const response = await axios.get(
      `https://api.webflow.com/beta/sites/${siteId}/assets`,
      {
        headers: {
          'Authorization': `Bearer ${webflowToken}`
        }
      }
    );

    const assets = response.data.assets || [];

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
    
    return res.send(csvContent);
    
  } catch (error: any) {
    console.error('Error generating CSV:', error);
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Failed to generate CSV';
    
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message
    });
  }
});

// Update asset properties (like alt text)
webflowRouter.patch('/assets/:assetId', authenticate, async (req: Request, res: Response) => {
  try {
    const webflowToken = getEffectiveWebflowToken(req);
    const { assetId } = req.params;
    const { altText, displayName } = req.body;
    
    if (!webflowToken) {
      return res.status(401).json({ message: 'No Webflow token found' });
    }

    if (!assetId) {
      return res.status(400).json({ message: 'Asset ID is required' });
    }

    if (typeof altText !== 'string' && typeof displayName !== 'string') {
      return res.status(400).json({ message: 'At least one of altText or displayName is required' });
    }

    // Prepare the request body with only the provided fields
    const requestBody: Record<string, string> = {};
    if (typeof altText === 'string') {
      requestBody.altText = altText;
    }
    if (typeof displayName === 'string') {
      requestBody.displayName = displayName;
    }

    // Update the asset
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
    
    return res.status(200).json(response.data);
    
  } catch (error: any) {
    console.error('Error updating asset:', error);
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Failed to update asset';
    
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message
    });
  }
});

// Register routes
app.use('/api/auth', authRouter);
app.use('/api/webflow', webflowRouter);

app.get('/api/health', (req: Request, res: Response) => {
  console.log('[API] /api/health called');
  res.status(200).json({ status: 'ok', message: 'Server is running (Vercel)' });
});

app.get('/api/debug', (req: Request, res: Response) => {
  console.log('[API] /api/debug called');
  const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PRODUCTION_MODE: process.env.PRODUCTION_MODE,
    PORT: process.env.PORT,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '***' + process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-6) : undefined,
    JWT_SECRET: process.env.JWT_SECRET ? '***' + process.env.JWT_SECRET.slice(-6) : 'using default secret'
  };
  res.status(200).json({
    config,
    message: 'Using real Webflow API v2 - no demo mode (Vercel)'
  });
});

// Export the app as a Vercel handler
export default app; 