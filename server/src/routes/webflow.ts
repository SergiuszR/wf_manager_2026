import express, { RequestHandler } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { 
  getPages, 
  getCollections,
  validateToken,
  getPageDetails,
  publishSite,
  getSites,
  saveToken,
  getPageDom,
  getCollectionDetails,
  getCollectionItems,
  getPageCustomCode
} from '../controllers/webflow';

// Import asset controllers from the new file we created
import {
  getAssets,
  getAssetById,
  uploadAsset,
  downloadAssetsCSV,
  updateAssetAltText
} from '../controllers/asset';

const router = express.Router();

// Configure multer for in-memory file storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB (Webflow's limit)
  }
});

// All Webflow routes require authentication
router.use(authenticate as unknown as RequestHandler);

// Webflow token routes
router.get('/token/validate', validateToken as unknown as RequestHandler);
router.post('/token', saveToken as unknown as RequestHandler);

// Webflow data routes
router.get('/pages', getPages as unknown as RequestHandler);
router.get('/pages/:pageId', getPageDetails as unknown as RequestHandler);
router.get('/pages/:pageId/dom', getPageDom as unknown as RequestHandler);
router.get('/pages/:pageId/custom-code', getPageCustomCode as unknown as RequestHandler);
router.get('/collections', getCollections as unknown as RequestHandler);
router.get('/collections/:collectionId', getCollectionDetails as unknown as RequestHandler);
router.get('/collections/:collectionId/items', getCollectionItems as unknown as RequestHandler);
router.get('/sites', getSites as unknown as RequestHandler);

// Webflow action routes
router.post('/sites/publish', publishSite as unknown as RequestHandler);

// Assets
router.get('/sites/:siteId/assets', getAssets as unknown as RequestHandler);
router.get('/assets/:assetId', getAssetById as unknown as RequestHandler);
router.post('/sites/:siteId/assets', upload.single('file'), uploadAsset as unknown as RequestHandler);
router.get('/sites/:siteId/assets/csv', downloadAssetsCSV as unknown as RequestHandler);
router.patch('/assets/:assetId', updateAssetAltText as unknown as RequestHandler);

export default router; 