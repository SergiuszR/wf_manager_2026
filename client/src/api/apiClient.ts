import axios from 'axios';

// Create a configured instance of axios
const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

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
  validateToken: () => apiClient.get('/webflow/token/validate'),
  saveToken: (token: string) => apiClient.post('/webflow/token', { token }),
  getPages: (webflowToken?: string) => apiClient.get('/webflow/pages', webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
  getPageDetails: (pageId: string, siteId: string, webflowToken?: string) => apiClient.get(`/webflow/pages/${pageId}`, { 
    params: { siteId }, ...(webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : {}) 
  }),
  getPageDom: (pageId: string, webflowToken?: string) => apiClient.get(`/webflow/pages/${pageId}/dom`, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
  getCollections: (webflowToken?: string) => apiClient.get('/webflow/collections', webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
  getCollectionDetails: (collectionId: string, webflowToken?: string) => apiClient.get(`/webflow/collections/${collectionId}`, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
  getSites: (webflowToken?: string) => apiClient.get('/webflow/sites', webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
  publishSite: (siteId: string, scheduledTime?: string, webflowToken?: string) => 
    apiClient.post('/webflow/sites/publish', { 
      siteId, 
      scheduledTime 
    }, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
  getAssets: (siteId: string, webflowToken?: string) => {
    return apiClient.get(`/webflow/sites/${siteId}/assets`, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined);
  },
  getAssetById: (assetId: string, webflowToken?: string) => {
    return apiClient.get(`/webflow/assets/${assetId}`, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined);
  },
  uploadAsset: (siteId: string, formData: FormData, webflowToken?: string) => {
    return apiClient.post(
      `/webflow/sites/${siteId}/assets`,
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
    return `${apiClient.defaults.baseURL}/webflow/sites/${siteId}/assets/csv`;
  },
  downloadAssetsCSVBlob: (siteId: string, webflowToken?: string) => {
    return apiClient.get(`/webflow/sites/${siteId}/assets/csv`, { responseType: 'blob', ...(webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : {}) });
  },
  getCollectionItems: (collectionId: string, webflowToken?: string) => apiClient.get(`/webflow/collections/${collectionId}/items`, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
  getCollectionItem: (collectionId: string, itemId: string, webflowToken?: string) => 
    apiClient.get(`/webflow/collections/${collectionId}/items/${itemId}`, 
    webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
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
    `/webflow/collections/${collectionId}/items/${itemId}`, 
    data, 
    webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined
  ),
  getPageCustomCode: (pageId: string, webflowToken?: string) => apiClient.get(`/webflow/pages/${pageId}/custom-code`, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined),
  updateAssetAltText: (assetId: string, altText: string, webflowToken?: string, displayName?: string) => {
    const requestBody: { altText?: string; displayName?: string } = {};
    if (altText !== undefined) requestBody.altText = altText;
    if (displayName !== undefined) requestBody.displayName = displayName;
    
    return apiClient.patch(`/webflow/assets/${assetId}`, requestBody, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined);
  },
  createAssetMetadata: (siteId: string, fileName: string, fileHash: string, webflowToken?: string) => {
    return apiClient.post(`/webflow/sites/${siteId}/assets`, { fileName, fileHash }, webflowToken ? { headers: { 'x-webflow-token': webflowToken } } : undefined);
  },
};

// Auth API endpoints
export const authAPI = {
  authenticate: (token: string, tokenName: string) => 
    apiClient.post('/auth/authenticate', { token, tokenName }),
  register: (username: string, password: string) => 
    apiClient.post('/auth/register', { username, password }),
  login: (username: string, password: string) => 
    apiClient.post('/auth/login', { username, password }),
  getProfile: () => apiClient.get('/auth/profile')
};

export default apiClient; 