const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const fetch = require("node-fetch"); // node-fetch@2 for CommonJS
const { setKey, getKey } = require("../../redis.js");

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

  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  // store token in Redis with expiry
  await setKey("icd_access_token", data.access_token, data.expires_in);
  return data.access_token;
}

async function getAccessToken() {
  let token = await getKey("icd_access_token");
  if (!token) {
    // Redis record expired or missing → fetch new token
    token = await fetchAccessToken();
  }
  return token;
}

module.exports = { getAccessToken, fetchAccessToken };
