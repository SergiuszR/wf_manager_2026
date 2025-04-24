// Test script for webflow-api
const { WebflowClient } = require('webflow-api');

// Replace with your token
const token = 'b3c465f967276c12fd42281c3ae35df91b35e6174f6fbf036d0da3c608152ba4';

async function testWebflowAPI() {
  console.log('Starting Webflow API test...');
  try {
    console.log('Initializing Webflow client...');
    const webflow = new WebflowClient({ accessToken: token });
    
    console.log('Client initialized, fetching sites...');
    const sites = await webflow.sites.list();
    
    console.log('Success! Found sites:', sites.length);
    if (sites.length > 0) {
      console.log('First site name:', sites[0].name);
    }
  } catch (error) {
    console.error('Error testing Webflow API:');
    console.error(error);
  }
}

testWebflowAPI(); 