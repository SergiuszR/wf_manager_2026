// Simple logging utility for Vercel API debugging
function logRequest(endpoint, method, params) {
  console.log(`[API] ${method} ${endpoint}`, params);
}

function logResponse(endpoint, status, data) {
  console.log(`[API] ${endpoint} response: ${status}`, data);
}

function logError(endpoint, error) {
  console.error(`[API] ${endpoint} error:`, error);
  
  if (error.response) {
    console.error(`[API] Status: ${error.response.status}`);
    console.error(`[API] Response data:`, error.response.data);
  } else if (error.request) {
    console.error(`[API] No response received:`, error.request);
  } else {
    console.error(`[API] Error setting up request:`, error.message);
  }
}

module.exports = {
  logRequest,
  logResponse,
  logError
}; 