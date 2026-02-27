const fetch = require("node-fetch");
const { getAccessToken, fetchAccessToken } = require("./tokenauth.js");
const logger = require("../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const release = process.env.ICD_RELEASE;

function _headerWithToken(token) {
  return {
      "Authorization": `Bearer ${token}`,
      "API-Version": "v2",
      "Accept": "application/json",
      "Accept-Language": "en"
    };
}

async function icdFetch(url) {
  let token = await getAccessToken();
  let res = await fetch(url, {headers: _headerWithToken(token)});

  if (res.status === 401) {
    logger.info("ICD API token expired or invalid, fetching new token...");
    token = await fetchAccessToken();
    res = await fetch(url, {
      headers: _headerWithToken(token)
    });
  }

  if (res.ok) { return res.json(); }
  if (res.status === 404) { return null; } // Not found is not an error for our use case
  logger.error(`ICD API request failed url=${url} status=${res.status} body=${await res.text()}`);
  throw new Error(`ICD API request failed with status ${res.status}`);
}


async function titleToicdCode(input) {
  const normalized = input.replace(/\.[A-Z]$/, ""); // strip suffixes for codes
  const searchUrl = `https://id.who.int/icd/release/11/${release}/mms/search?q=${encodeURIComponent(normalized)}&useFlexisearch=true&subtreeFilterUsesFoundationDescendants=true`;
  const data = await icdFetch(searchUrl);
  const entities = data.destinationEntities || [];

  // Normalize titles for comparison (strip HTML, trim, lowercase)
  const cleanInput = input.trim().toLowerCase();
  const exactMatch = entities.find(e => {
    const cleanTitle = e.title.replace(/<[^>]+>/g, "").trim().toLowerCase();
    return cleanTitle === cleanInput;
  });

  if (exactMatch) {
    const stemId = exactMatch.stemId.replace(/^http:\/\//, 'https://');
    return [{
      code: exactMatch.theCode,
      title: exactMatch.title.replace(/<[^>]+>/g, ""),
      stemId: stemId,
    }];
  }

  // Otherwise return all candidates
  return entities.map(e => ({
    code: e.theCode,
    title: e.title.replace(/<[^>]+>/g, ""),
    stemId: e.stemId ? e.stemId.replace(/^http:\/\//, 'https://') : null,
  }));
}

async function icdCodeToTitle(code) {
  const url = `https://id.who.int/icd/release/11/${release}/mms/codeinfo/${encodeURIComponent(code)}?flexiblemode=true`;

  const data = await icdFetch(url);

  if (!data) { return null; }

  if (data.stemId) {
    data.stemId = data.stemId.replace(/^http:\/\//, 'https://');
    const entityData = await icdFetch(data.stemId);
    return {
      code,
      title: entityData.title?.["@value"] || entityData.title || null,
      stemId: data.stemId,
    };
  }
  return null;
}

//8A61.41 - Progressive myoclonic epilepsy
module.exports = { icdFetch, titleToicdCode, icdCodeToTitle };