import axios from 'axios';

// Determine the base URL for API calls
// For Vercel deployment, we need to use relative paths
const API_BASE_URL = '';

// Create a configured instance of axios
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Add request interceptor to handle Vercel deployment
apiClient.interceptors.request.use(config => {
  // Log requests in development
  if (import.meta.env.DEV) {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
  }
  return config;
});

// Add response interceptor to handle errors
apiClient.interceptors.response.use(
  response => response,
  error => {
    // Log error details to help diagnose issues
    console.error('API Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    return Promise.reject(error);
  }
);

// Add authorization header with JWT token
export const setAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

// Webflow API endpoints
export const webflowAPI = {
  validateToken: () => apiClient.get('/api/webflow/token/validate'),
  saveToken: (token: string) => apiClient.post('/api/webflow/token', { token }),
  getPages: (webflowToken?: string) => apiClient.get('/api/webflow/pages', webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
  getPageDetails: (pageId: string, siteId: string, webflowToken?: string) => apiClient.get(`/api/webflow/pages/${pageId}`, { 
    params: { siteId }, ...(webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : {}) 
  }),
  getPageDom: (pageId: string, webflowToken?: string) => apiClient.get(`/api/webflow/pages/${pageId}/dom`, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
  getCollections: (webflowToken?: string) => apiClient.get('/api/webflow/collections', webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
  getCollectionDetails: (collectionId: string, webflowToken?: string) => apiClient.get(`/api/webflow/collections/${collectionId}`, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
  getSites: (webflowToken?: string) => apiClient.get('/api/webflow/sites', webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
  publishSite: (siteId: string, scheduledTime?: string, webflowToken?: string) => 
    apiClient.post('/api/webflow/sites/publish', { 
      siteId, 
      scheduledTime 
    }, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
  getAssets: (siteId: string, webflowToken?: string) => {
    return apiClient.get(`/api/webflow/sites/${siteId}/assets`, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined);
  },
  getAssetById: (assetId: string, webflowToken?: string) => {
    return apiClient.get(`/api/webflow/assets/${assetId}`, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined);
  },
  uploadAsset: (siteId: string, formData: FormData, webflowToken?: string) => {
    return apiClient.post(
      `/api/webflow/sites/${siteId}/assets`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json',
          ...(webflowToken ? { 'x-webflow-token': webflowToken } : {})
        },
      }
    );
  },
  downloadAssetsCSV: (siteId: string) => {
    return `${apiClient.defaults.baseURL}/api/webflow/sites/${siteId}/assets/csv`;
  },
  downloadAssetsCSVBlob: (siteId: string, webflowToken?: string) => {
    return apiClient.get(`/api/webflow/sites/${siteId}/assets/csv`, { responseType: 'blob', ...(webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : {}) });
  },
  getCollectionItems: (collectionId: string, webflowToken?: string) => apiClient.get(`/api/webflow/collections/${collectionId}/items`, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
  getCollectionItem: (collectionId: string, itemId: string, webflowToken?: string) => {
    const url = `/api/webflow/collections/${collectionId}/items/${itemId}`;
    const config = webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined;
    if (import.meta.env.DEV) {
      console.log('API Request: GET', url, config);
    }
    return apiClient.get(url, config);
  },
  updateCollectionItem: (
    collectionId: string, 
    itemId: string, 
    data: { 
      fieldData: any; 
      isDraft?: boolean; 
      isArchived?: boolean;
      cmsLocaleId?: string;
    }, 
    webflowToken?: string
  ) => apiClient.patch(
    `/api/webflow/collections/${collectionId}/items/${itemId}`, 
    data, 
    webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined
  ),
  getPageCustomCode: (pageId: string, webflowToken?: string) => apiClient.get(`/api/webflow/pages/${pageId}/custom-code`, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
  updateAssetAltText: (assetId: string, altText: string, webflowToken?: string, displayName?: string) => {
    const requestBody: { altText?: string; displayName?: string } = {};
    if (altText !== undefined) requestBody.altText = altText;
    if (displayName !== undefined) requestBody.displayName = displayName;
    
    return apiClient.patch(`/api/webflow/assets/${assetId}`, requestBody, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined);
  },
  createAssetMetadata: (siteId: string, fileName: string, fileHash: string, webflowToken?: string) => {
    return apiClient.post(`/api/webflow/sites/${siteId}/assets`, { fileName, fileHash }, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined);
  },
};

// Auth API endpoints
export const authAPI = {
  authenticate: (token: string, tokenName: string) => 
    apiClient.post('/api/auth/authenticate', { token, tokenName }),
  register: (username: string, password: string) => 
    apiClient.post('/api/auth/register', { username, password }),
  login: (username: string, password: string) => 
    apiClient.post('/api/auth/login', { username, password }),
  getProfile: () => apiClient.get('/api/auth/profile')
};

export default apiClient; 