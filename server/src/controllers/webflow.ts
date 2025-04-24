import { Request, Response } from 'express';
import axios, { AxiosError } from 'axios';
import { Request as ExpressRequest } from 'express';
import FormData from 'form-data';

// In-memory user store since MongoDB is disabled
const users = new Map<string, any>();

// Get or set a user in the in-memory store
const getUser = (id: string) => users.get(id);
const setUser = (id: string, data: any) => users.set(id, data);

// Export the users map for use in other modules
export const getUsersMap = () => users;

// Share the users store between auth and webflow controllers
export const shareUser = (userId: string, userData: any) => {
  console.log(`Sharing user data for ID: ${userId}`);
  users.set(userId, userData);
};

// Create Axios instance configured for Webflow API v2
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

// Get Webflow token from user ID
const getWebflowToken = (userId?: string): string | null => {
  if (!userId) {
    console.log('No user ID provided');
    return null;
  }
  
  console.log(`Getting token for user ID: ${userId}`);
  const user = users.get(userId);
  if (!user) {
    console.log(`User not found in memory store for ID: ${userId}`);
    return null;
  }
  console.log(`Found user: ${JSON.stringify({
    id: user.id,
    hasToken: !!user.webflowToken,
    tokenLength: user.webflowToken ? user.webflowToken.length : 0
  })}`);
  return user.webflowToken || null;
};

// Helper to get the Webflow token from header or user session
const getEffectiveWebflowToken = (req: Request): string | null => {
  console.log('--- getEffectiveWebflowToken ---');
  console.log(`User ID: ${req.user || 'undefined'}`);
  console.log(`Headers: ${JSON.stringify(req.headers)}`);
  
  const headerToken = req.headers['x-webflow-token'] as string | undefined;
  console.log(`x-webflow-token header present: ${!!headerToken}`);
  
  if (headerToken && headerToken.length > 0) {
    console.log(`Using header token (length: ${headerToken.length})`);
    console.log(`Token preview: ${headerToken.substring(0, 5)}...${headerToken.substring(headerToken.length - 5)}`);
    return headerToken;
  }
  
  console.log('No header token found, trying user token');
  const userToken = getWebflowToken(req.user);
  console.log(`User token found: ${!!userToken}`);
  
  if (userToken) {
    console.log(`Using user token (length: ${userToken.length})`);
    console.log(`Token preview: ${userToken.substring(0, 5)}...${userToken.substring(userToken.length - 5)}`);
  } else {
    console.log('No user token found. Authentication will fail.');
  }
  
  return userToken;
};

// Save Webflow token to user account
const saveToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const userId = req.user;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    if (token.length < 30) {
      return res.status(400).json({ 
        message: 'Invalid token format. Webflow API tokens are longer than 30 characters.' 
      });
    }

    // Validate token with direct Webflow API v2 call
    try {
      console.log(`Validating token by calling /v2/sites endpoint`);
      const client = createWebflowAPIClient(token);
      const response = await client.get('/v2/sites');
      console.log(`Response status: ${response.status}`);
      
      // Store token in memory
      const userData = users.get(userId) || {};
      userData.webflowToken = token;
      users.set(userId, userData);
      
      // Success response with site count
      res.status(200).json({ 
        message: 'Webflow token saved successfully',
        siteCount: response.data.sites?.length || 0
      });
    } catch (error: any) {
      console.error('Webflow API validation error:', error.message);
      
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
      }
      
      return res.status(400).json({ 
        message: 'Invalid Webflow token. The API returned an error.',
        error: error.response?.data?.message || error.message
      });
    }
  } catch (error) {
    console.error('Save token error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Validate if the saved token is still valid
const validateToken = async (req: Request, res: Response) => {
  try {
    // Get the Webflow token from the user object
    const webflowToken = getEffectiveWebflowToken(req);
    
    if (!webflowToken) {
      return res.status(400).json({ message: 'No Webflow token available' });
    }

    // Validate token with direct API v2 call
    try {
      console.log(`Validating token by calling /v2/sites endpoint`);
      const client = createWebflowAPIClient(webflowToken);
      const response = await client.get('/v2/sites');
      console.log(`Response status: ${response.status}`);
      
      // Response with site count
      res.status(200).json({ 
        valid: true, 
        message: 'Webflow token is valid',
        siteCount: response.data.sites?.length || 0
      });
    } catch (error: any) {
      console.error('Token validation error:', error.message);
      
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
      }
      
      // Return detailed error for debugging
      res.status(400).json({ 
        valid: false, 
        message: error.response?.data?.message || 'Invalid Webflow token',
        error: error.response?.status || error.message
      });
    }
  } catch (error: any) {
    console.error('Token validation error:', error);
    
    // General error
    res.status(400).json({ 
      valid: false, 
      message: error.message || 'Error validating token'
    });
  }
};

// Get all pages from Webflow sites
const getPages = async (req: Request, res: Response) => {
  try {
    const webflowToken = getEffectiveWebflowToken(req);

    if (!webflowToken) {
      return res.status(400).json({ message: 'No Webflow token available' });
    }

    try {
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
          // Use the proper v2 endpoint format
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
      
      res.status(200).json({ pages: allPages });
    } catch (error: any) {
      console.error('Error fetching pages:', error.message);
      return res.status(400).json({ 
        message: 'Error fetching pages',
        error: error.response?.data?.message || error.message
      });
    }
  } catch (error) {
    console.error('Error in getPages:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper to construct the published URL for a page
const constructPublishedUrl = (siteInfo: any, page: any) => {
  // Check if we have domains in site info
  if (!siteInfo || !page) return null;
  
  let domain = '';
  
  // Try to use custom domain first if available
  if (siteInfo.customDomains && siteInfo.customDomains.length > 0) {
    domain = `https://${siteInfo.customDomains[0].url}`;
  } else if (siteInfo.shortName) {
    // Fall back to Webflow subdomain
    domain = `https://${siteInfo.shortName}.webflow.io`;
  }
  
  if (!domain) return null;
  
  // Construct URL from domain and slug
  return `${domain}${page.slug === 'index' ? '' : '/' + page.slug}`;
};

// Helper to construct preview URL for a page
const constructPreviewUrl = (siteId: string, pageId: string) => {
  if (!siteId || !pageId) return null;
  return `https://webflow.com/design/${siteId}/page/${pageId}`;
};

// Get all collections from the Webflow sites
const getCollections = async (req: Request, res: Response) => {
  try {
    const webflowToken = getEffectiveWebflowToken(req);

    if (!webflowToken) {
      return res.status(400).json({ message: 'No Webflow token available' });
    }

    try {
      console.log(`Getting sites list for user token: ${webflowToken.substring(0, 5)}...`);
      
      // Create API client
      const client = createWebflowAPIClient(webflowToken);
      
      // Get all sites first
      const sitesResponse = await client.get('/v2/sites');
      const sites = sitesResponse.data?.sites || [];
      
      console.log(`Found ${sites.length} sites`);
      
      if (sites.length === 0) {
        return res.status(200).json({ collections: [] });
      }
      
      // Collect all collections across sites
      let allCollections: any[] = [];
      
      for (const site of sites) {
        try {
          console.log(`Getting collections for site: ${site.id}`);
          
          const siteCollectionsResponse = await client.get(`/v2/sites/${site.id}/collections`);
          const collections = siteCollectionsResponse.data?.collections || [];
          
          console.log(`Found ${collections.length} collections for site ${site.id}`);
          
          if (collections.length > 0) {
            // Log first collection structure to see available fields
            console.log(`First collection structure: ${JSON.stringify(collections[0], null, 2)}`);
          }
          
          // Enhance collection objects with site info
          const enhancedCollections = collections.map((collection: any) => ({
            ...collection,
            name: collection.displayName || collection.name || 'Unnamed Collection',
            siteName: site.displayName || site.shortName,
            siteId: site.id,
            // Add designer URL for convenience
            designerUrl: `https://webflow.com/design/${site.id}/collection/${collection.id}`,
            // Add default item counts
            stagedItemCount: collection.itemCount || 0,
            liveItemCount: 0 // Default to 0, we'll fetch the actual counts when details are requested
          }));
          
          allCollections = [...allCollections, ...enhancedCollections];
        } catch (error: any) {
          console.error(`Error fetching collections for site ${site.id}:`, error.message);
          // Continue to next site
        }
      }
      
      res.status(200).json({ collections: allCollections });
    } catch (error: any) {
      console.error('Error fetching collections:', error.message);
      return res.status(400).json({ 
        message: 'Error fetching collections',
        error: error.response?.data?.message || error.message
      });
    }
  } catch (error) {
    console.error('Error in getCollections:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get details of a specific collection
const getCollectionDetails = async (req: Request, res: Response) => {
  try {
    const { collectionId } = req.params;
    
    console.log(`=== GET COLLECTION DETAILS START ===`);
    console.log(`Request params:`, req.params);
    console.log(`Collection ID: "${collectionId}"`);
    
    // Check for valid collection ID
    if (!collectionId || collectionId === 'undefined' || collectionId === 'null') {
      console.log(`Error: Invalid Collection ID: "${collectionId}"`);
      return res.status(400).json({ 
        message: 'Invalid Collection ID',
        details: `Received: "${collectionId}"`
      });
    }
    
    const webflowToken = getEffectiveWebflowToken(req);
    console.log(`User ID: ${req.user}, Has token: ${!!webflowToken}`);

    if (!webflowToken) {
      console.log(`Error: No token available for user ${req.user}`);
      return res.status(400).json({ message: 'No Webflow token available' });
    }

    // Create API client
    const client = createWebflowAPIClient(webflowToken);
    
    console.log(`Making request to Webflow API: /v2/collections/${collectionId}`);
    
    try {
      // First get sites to verify if the collection ID exists in any site
      console.log(`Getting sites list to verify collection existence`);
      const sitesResponse = await client.get('/v2/sites');
      const sites = sitesResponse.data.sites || [];
      console.log(`Found ${sites.length} sites`);
      
      // Now get the collection details
      console.log(`Requesting collection details from /v2/collections/${collectionId}`);
      
      const collectionResponse = await client.get(`/v2/collections/${collectionId}`);
      
      console.log(`Collection API response status: ${collectionResponse.status}`);
      console.log(`Collection data received: ${!!collectionResponse.data}`);
      
      if (!collectionResponse.data) {
        console.log(`Error: No data received from collection endpoint`);
        return res.status(404).json({ 
          message: 'Collection data not found'
        });
      }
      
      // Extract fields directly from the collection response
      const fields = collectionResponse.data.fields || [];
      console.log(`Fields found in collection response: ${fields.length}`);
      
      // Get the actual item counts from the items endpoints
      let stagedItemCount = collectionResponse.data.itemCount || 0;
      let liveItemCount = 0;
      
      try {
        console.log(`Fetching staged items count for collection: ${collectionId}`);
        // Request with higher limit to ensure we get all items
        const stagedItemsResponse = await client.get(`/v2/collections/${collectionId}/items?limit=100`);
        
        // For debugging - only log a small preview to avoid filling logs
        if (stagedItemsResponse.data && stagedItemsResponse.data.items) {
          console.log(`Total items in response: ${stagedItemsResponse.data.items.length}`);
          stagedItemCount = stagedItemsResponse.data.items.length;
        }
        
        // Get live items count 
        const liveItemsResponse = await client.get(`/v2/collections/${collectionId}/items/live?limit=100`);
        
        // Extract live items count
        if (liveItemsResponse.data && liveItemsResponse.data.items) {
          console.log(`Total live items in response: ${liveItemsResponse.data.items.length}`);
          liveItemCount = liveItemsResponse.data.items.length;
        }
      } catch (itemsError: any) {
        // Log the error but continue without updating the item count
        console.log(`Error fetching items (continuing with default count): ${itemsError.message}`);
      }
      
      // Combine the collection data with fields and updated item counts
      const collectionData = {
        ...collectionResponse.data,
        stagedItemCount,
        liveItemCount,
        itemCount: stagedItemCount // Maintain backward compatibility
      };
      
      console.log(`Sending collection data with ${fields.length} fields, ${stagedItemCount} staged items, and ${liveItemCount} live items`);
      console.log(`=== GET COLLECTION DETAILS END ===`);
      
      res.status(200).json({ collection: collectionData });
    } catch (error: any) {
      console.error('Error fetching collection details:', error.message);
      
      console.log(`=== ERROR DETAILS ===`);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      console.log(`=== GET COLLECTION DETAILS END WITH ERROR ===`);
      
      return res.status(error.response?.status || 400).json({ 
        message: 'Error fetching collection details',
        error: error.response?.data?.message || error.message
      });
    }
  } catch (error) {
    console.error('Error in getCollectionDetails:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get detailed information about a specific page
const getPageDetails = async (req: Request, res: Response) => {
  try {
    const webflowToken = getEffectiveWebflowToken(req);
    const { pageId } = req.params;
    const { siteId } = req.query;

    console.log(`Getting page details for pageId: ${pageId}, siteId: ${siteId}`);

    if (!webflowToken) {
      return res.status(400).json({ message: 'No Webflow token available' });
    }

    if (!pageId) {
      return res.status(400).json({ message: 'Page ID is required' });
    }

    if (!siteId) {
      return res.status(400).json({ message: 'Site ID is required as a query parameter' });
    }

    try {
      // Create API client
      const client = createWebflowAPIClient(webflowToken);
      
      // First, get the site info
      console.log(`Getting site details for: ${siteId}`);
      const siteResponse = await client.get(`/v2/sites/${siteId}`);
      console.log('Site API response status:', siteResponse.status);
      const site = siteResponse.data;
      
      if (!site) {
        return res.status(404).json({ message: 'Site not found' });
      }
      
      // Then get all pages for this site
      console.log(`Getting all pages for site: ${siteId}`);
      const pagesResponse = await client.get(`/v2/sites/${siteId}/pages`);
      console.log('Pages API response status:', pagesResponse.status);
      
      // Find the specific page in the response
      const pages = pagesResponse.data?.pages || [];
      console.log(`Found ${pages.length} pages, looking for page with ID: ${pageId}`);
      
      const page = pages.find((p: any) => p.id === pageId);
      
      if (!page) {
        console.error(`Page with ID ${pageId} not found in site ${siteId}`);
        return res.status(404).json({ message: 'Page not found in this site' });
      }
      
      console.log(`Found page: ${page.title}`);
      
      // Enhance page object with site info
      const enhancedPage = {
        ...page,
        siteName: site.displayName || site.shortName,
        siteId: site.id,
        url: constructPublishedUrl(site, page),
        previewUrl: constructPreviewUrl(site.id, page.id)
      };
      
      console.log('Sending enhanced page details');
      res.status(200).json({ page: enhancedPage });
    } catch (error: any) {
      console.error('Error fetching page details:', error.message);
      
      if (error.response) {
        console.error('API response status:', error.response.status);
        console.error('API response data:', JSON.stringify(error.response.data));
      }
      
      // Check for 404 (not found) 
      if (error.response?.status === 404) {
        return res.status(404).json({ message: 'Page not found' });
      }
      
      return res.status(400).json({ 
        message: 'Error fetching page details',
        error: error.response?.data?.message || error.message
      });
    }
  } catch (error) {
    console.error('Error in getPageDetails:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Publish a site
const publishSite = async (req: Request, res: Response) => {
  try {
    const webflowToken = getEffectiveWebflowToken(req);
    const { siteId, domains } = req.body;

    if (!webflowToken) {
      return res.status(400).json({ message: 'No Webflow token available' });
    }

    if (!siteId) {
      return res.status(400).json({ message: 'Site ID is required' });
    }

    try {
      // Create API client
      const client = createWebflowAPIClient(webflowToken);
      
      // Implementation with retry for rate limiting
      const makePublishRequest = async (retryCount = 0, delayMs = 1000) => {
        try {
          // Use v2 publish endpoint
          const publishResponse = await client.post(`/v2/sites/${siteId}/publish`, {
            domains: domains || [] // Empty array means publish to all domains
          });
          
          return { success: true, data: publishResponse.data };
        } catch (error: any) {
          // Check if we hit rate limits (429 Too Many Requests)
          if (error.response?.status === 429 && retryCount < 3) {
            console.log(`Rate limited, retrying in ${delayMs}ms (attempt ${retryCount + 1})`);
            
            // Wait for the specified delay
            await new Promise(resolve => setTimeout(resolve, delayMs));
            
            // Retry with exponential backoff
            return makePublishRequest(retryCount + 1, delayMs * 2);
          }
          
          // For other errors or too many retries, throw the error
          throw error;
        }
      };
      
      // Make the publish request with retry logic
      const result = await makePublishRequest();
      
      res.status(200).json({
        message: 'Site published successfully',
        publishDetails: result.data
      });
    } catch (error: any) {
      console.error('Error publishing site:', error.message);
      
      // Special handling for common errors
      if (error.response?.status === 401) {
        return res.status(401).json({ 
          message: 'Unauthorized to publish this site. Make sure your token has the sites:publish scope.'
        });
      }
      
      if (error.response?.status === 403) {
        return res.status(403).json({ 
          message: 'Forbidden. Your account does not have permission to publish this site.'
        });
      }
      
      return res.status(400).json({ 
        message: 'Error publishing site',
        error: error.response?.data?.message || error.message
      });
    }
  } catch (error) {
    console.error('Error in publishSite:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all Webflow sites for the user
const getSites = async (req: Request, res: Response) => {
  try {
    console.log('=== GET SITES START ===');
    
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
      return res.status(401).json({ message: 'No Webflow token available' });
    }

    // Create API client
    const client = createWebflowAPIClient(webflowToken);
    
    console.log(`Calling Webflow API with token: ${webflowToken.substring(0, 5)}...${webflowToken.substring(webflowToken.length - 5)}`);
    
    // Get all sites
    const response = await client.get('/v2/sites');
    const sites = response.data.sites || [];
    
    console.log(`Found ${sites.length} sites`);
    console.log('=== GET SITES END ===');
    
    res.status(200).json({ sites });
  } catch (error: any) {
    console.error('Error getting sites:', error.message);
    console.error('Error response:', error.response?.data);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ 
        message: 'Authentication failed with Webflow API. Token may be invalid.'
      });
    }
    
    res.status(400).json({ 
      message: 'Error fetching sites',
      error: error.response?.data?.message || error.message
    });
  }
};

// Get page DOM content
const getPageDom = async (req: Request, res: Response) => {
  try {
    const webflowToken = getEffectiveWebflowToken(req);
    const { pageId } = req.params;

    console.log(`Getting DOM content for pageId: ${pageId}`);

    if (!webflowToken) {
      return res.status(400).json({ message: 'No Webflow token available' });
    }

    if (!pageId) {
      return res.status(400).json({ message: 'Page ID is required' });
    }

    try {
      // Create API client
      const client = createWebflowAPIClient(webflowToken);
      
      // Call the DOM endpoint
      console.log(`Making API request to: /v2/pages/${pageId}/dom`);
      const domResponse = await client.get(`/v2/pages/${pageId}/dom`);
      console.log('DOM API response status:', domResponse.status);
      
      const domData = domResponse.data;
      
      console.log('Sending DOM data');
      res.status(200).json({ dom: domData });
    } catch (error: any) {
      console.error('Error fetching page DOM:', error.message);
      
      if (error.response) {
        console.error('API response status:', error.response.status);
        console.error('API response data:', JSON.stringify(error.response.data));
      }
      
      // Check for 404 (not found) 
      if (error.response?.status === 404) {
        return res.status(404).json({ message: 'Page DOM not found' });
      }
      
      return res.status(400).json({ 
        message: 'Error fetching page DOM',
        error: error.response?.data?.message || error.message
      });
    }
  } catch (error) {
    console.error('Error in getPageDom:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all items for a specific collection (for CMS pages tree view)
const getCollectionItems = async (req: Request, res: Response) => {
  try {
    const { collectionId } = req.params;
    if (!collectionId) {
      return res.status(400).json({ message: 'Collection ID is required' });
    }
    const webflowToken = getEffectiveWebflowToken(req);
    if (!webflowToken) {
      return res.status(400).json({ message: 'No Webflow token available' });
    }
    const client = createWebflowAPIClient(webflowToken);
    // Fetch all items (limit 100, can be paginated if needed)
    const itemsResponse = await client.get(`/v2/collections/${collectionId}/items?limit=100`);
    const items = itemsResponse.data.items || [];
    // Use fieldData for name and slug as per API v2
    const result = items.map((item: any) => ({
      id: item.id,
      name: item.fieldData?.name || item.fieldData?.title || item.fieldData?.slug,
      slug: item.fieldData?.slug,
      isDraft: item.isDraft === true,
    }));
    res.status(200).json({ items: result });
  } catch (error: any) {
    console.error('Error fetching collection items:', error.message);
    res.status(500).json({ message: 'Error fetching collection items', error: error.message });
  }
};

// Get custom code for a specific page
const getPageCustomCode = async (req: Request, res: Response) => {
  try {
    const { pageId } = req.params;
    if (!pageId) {
      return res.status(400).json({ message: 'Page ID is required' });
    }
    const webflowToken = getEffectiveWebflowToken(req);
    if (!webflowToken) {
      return res.status(400).json({ message: 'No Webflow token available' });
    }
    const client = createWebflowAPIClient(webflowToken);
    // Use the v2 beta endpoint for custom code
    const response = await client.get(`/beta/pages/${pageId}/custom_code`);
    res.status(200).json({ customCode: response.data });
  } catch (error: any) {
    console.error('Error fetching custom code:', error.message);
    res.status(500).json({ message: 'Error fetching custom code', error: error.message });
  }
};

// Export all functions used by routes
export {
  getUser,
  setUser,
  saveToken,
  validateToken,
  getPages,
  getPageDom,
  getCollections,
  getCollectionDetails,
  getPageDetails,
  publishSite,
  getSites,
  getCollectionItems,
  getPageCustomCode,
  users
}; 