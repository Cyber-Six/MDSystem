const redis = require("../redis.js");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function fetchAccessToken() {
  const res = await fetch("https://icdaccessmanagement.who.int/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      scope: "icdapi_access"
    })
  });
  const data = await res.json();
  const cachedToken = data.access_token;
  await redis.setKey("icd_api_token", cachedToken);
  return cachedToken;
}

async function getAccessToken() {
  const cachedToken = await redis.getKey("icd_api_token");
  if (!cachedToken) { return await fetchAccessToken(); }
  return cachedToken;
}

module.exports = { getAccessToken, fetchAccessToken };