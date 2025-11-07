require('dotenv').config();
const Parse = require('parse/node');

// Initialize Parse with your Back4App credentials
Parse.initialize(
  process.env.PARSE_APP_ID,
  process.env.PARSE_JS_KEY,
  process.env.MASTER_KEY
);

// Set the server URL
Parse.serverURL = process.env.PARSE_SERVER_URL;

// Export the configured Parse instance
module.exports = Parse;