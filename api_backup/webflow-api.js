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
