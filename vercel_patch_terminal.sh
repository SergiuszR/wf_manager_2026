#!/bin/bash
# Vercel patching script to solve the serverless function limit

# Create a backup directory for original API files
echo "Creating backup directory for original API files..."
mkdir -p api_backup

# Backup the entire api directory
echo "Backing up all API files..."
cp -r api/* api_backup/

# Create a clean slate by removing all files from api directory
echo "Cleaning api directory..."
rm -rf api/*

# Create minimal directory structure
echo "Creating minimal directory structure..."
mkdir -p api/webflow/pages
mkdir -p api/webflow/pages/[pageId]
mkdir -p api/webflow/assets
mkdir -p api/webflow/collections
mkdir -p api/webflow/collections/[collectionId]/items
mkdir -p api/webflow/sites

# Copy only the essential files back
echo "Copying essential files..."

# Copy package.json and config files
cp api_backup/package.json api/
cp api_backup/package-lock.json api/ 2>/dev/null
cp api_backup/tsconfig.json api/ 2>/dev/null

# Copy the handlers needed for imports
cp api_backup/webflow/pages-api.ts api/webflow/
cp api_backup/webflow/pages.ts api/webflow/
cp api_backup/webflow/pages/[pageId].ts api/webflow/pages/
cp api_backup/webflow/pages/[pageId]/custom-code.ts api/webflow/pages/[pageId]/
cp api_backup/webflow/pages/[pageId]/dom.ts api/webflow/pages/[pageId]/

cp api_backup/webflow/assets-api.ts api/webflow/ 2>/dev/null
cp api_backup/webflow/assets/[assetId].ts api/webflow/assets/ 2>/dev/null
cp api_backup/webflow/sites/[siteId]/assets.ts api/webflow/sites/ 2>/dev/null
cp api_backup/webflow/sites/[siteId]/assets/csv.ts api/webflow/sites/ 2>/dev/null

cp api_backup/webflow/collections-api.ts api/webflow/ 2>/dev/null
cp api_backup/webflow/collections.ts api/webflow/ 2>/dev/null
cp api_backup/webflow/collections/[collectionId].ts api/webflow/collections/ 2>/dev/null
cp api_backup/webflow/collections/[collectionId]/items/index.ts api/webflow/collections/[collectionId]/items/ 2>/dev/null
cp api_backup/webflow/collections/[collectionId]/items/[itemId].ts api/webflow/collections/[collectionId]/items/ 2>/dev/null

cp api_backup/webflow/sites-api.ts api/webflow/ 2>/dev/null
cp api_backup/webflow/sites.ts api/webflow/ 2>/dev/null
cp api_backup/auth-api.ts api/ 2>/dev/null
cp api_backup/webflow/token-api.ts api/webflow/ 2>/dev/null

# Copy grouped handlers with debug logging
echo "Copying grouped handlers..."
cp api_backup/webflow/*-group.ts api/webflow/

# Add the corrected non-redirecting fallback handler
echo "Creating fixed API fallback handler..."
cat > api/webflow-api.js << 'EOL'
// This file handles fallback requests and OPTIONS requests
// to prevent redirect loops and ensure proper handling

module.exports = (req, res) => {
  console.log(`webflow-api.js handling: ${req.method} ${req.url}`);

  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    res.status(200).end();
    return;
  }
  
  const { url } = req;
  
  if (!url) return res.status(400).send('Missing URL');
  
  // Instead of redirecting, inform the client they should use the grouped endpoint
  // This prevents redirect loops
  return res.status(404).json({
    error: 'API endpoint not found',
    message: 'Please use the appropriate grouped API endpoints',
    requestedUrl: url,
    timestamp: new Date().toISOString()
  });
};
EOL

# Make sure node_modules is available
if [ -d "api_backup/node_modules" ]; then
  echo "Copying node_modules..."
  cp -r api_backup/node_modules api/
else
  echo "Installing dependencies..."
  cd api && npm install && cd ..
fi

# Set environment variables for debug logging
echo "Setting debug environment variables..."
export VERCEL_DEBUG=1

# Run Vercel production build and log output
echo "Running Vercel deployment..."
vercel --prod | tee vercel_build_output.log

echo "Patch completed. The app should now deploy with only the grouped serverless functions."
echo "To restore original files for local development, run:"
echo "cp -r api_backup/* api/"

echo "If you're still experiencing issues, you can check your Vercel logs at:"
echo "https://vercel.com/dashboard/project/[your-project-id]/logs" 