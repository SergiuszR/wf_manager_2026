// Standalone script to validate a Webflow token
const { WebflowClient } = require('webflow-api');

// Replace with the token to validate
const token = process.argv[2] || 'YOUR_TOKEN_HERE';

async function validateToken() {
  console.log('=== Webflow Token Validation ===');
  console.log(`Validating token: ${token.substring(0, 5)}...${token.substring(token.length - 5)}`);
  
  try {
    console.log('Initializing Webflow client...');
    const webflow = new WebflowClient({ accessToken: token });
    
    console.log('Client initialized, fetching sites...');
    const sites = await webflow.sites.list();
    
    console.log('\n✅ SUCCESS! Token is valid.');
    console.log('Sites response type:', typeof sites);
    console.log('Is array?', Array.isArray(sites));
    
    // Print any available data to help with debugging
    console.log('\nResponse details:');
    console.log(JSON.stringify(sites, null, 2));
    
    // Try to get one site by ID if it exists
    if (sites && Array.isArray(sites) && sites.length > 0) {
      console.log('\nTrying to get first site details...');
      try {
        const siteId = sites[0]._id;
        const siteDetails = await webflow.sites.get(siteId);
        console.log('Site details retrieved successfully:');
        console.log(JSON.stringify(siteDetails, null, 2));
      } catch (siteError) {
        console.error('Error getting site details:', siteError);
      }
    }
  } catch (error) {
    console.error('\n❌ ERROR: Token validation failed');
    console.error('Error details:');
    
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Message: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(error);
    }
    
    console.log('\nPossible issues:');
    console.log('  1. The token may be invalid or expired');
    console.log('  2. The token may not have sufficient permissions');
    console.log('  3. There might be network connectivity issues');
    console.log('  4. The Webflow API might be experiencing downtime');
  }
}

// Run the validation
validateToken(); 