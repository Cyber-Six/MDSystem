const fetch = require("node-fetch");
const { getAccessToken, fetchAccessToken } = require("./tokenauth.js");
const logger = require("../../../utils/logger.js");

async function icdFetch(url) {
  let token = await getAccessToken();

  let res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "API-Version": "v2",
      "Accept": "application/json",
      "Accept-Language": "en"
    }
  });

  if (res.status === 401) {
    logger.info("ICD API token expired or invalid, fetching new token...");
    token = await fetchAccessToken();
    res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "API-Version": "v2",
        "Accept": "application/json",
        "Accept-Language": "en"
      }
    });
  }

  if (!res.ok) {
    throw new Error(`ICD API failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
/**
 * Lookup ICD title/label by exact ICD code.
 */
async function getICDByCode(icdCode) {
  const normalized = icdCode.trim().replace(/\./g, ""); // remove dots for URL
  const codeUrl = `https://id.who.int/icd/release/11/2026-01/mms/codeinfo/${encodeURIComponent(normalized)}?flexiblemode=true`;
  
  try {
    const data = await icdFetch(codeUrl);
    
    if (data.stemId) {
      // Fetch the full entity details using the stem URI
      const entityData = await icdFetch(data.stemId);
      return {
        code: icdCode.trim(),
        title: entityData.title?.["@value"] || entityData.title || null,
        definition: entityData.definition?.["@value"] || null,
        uri: data.stemId
      };
    }
    
    return null;
  } catch (err) {
    logger.error(`Failed to lookup ICD code ${icdCode}: ${err.message}`);
    return null;
  }
}
/**
 * Lookup ICD entity by code directly from release endpoint.
 */

async function lookupICD(input) {
  const normalized = input.replace(/\.[A-Z]$/, ""); // strip suffixes for codes
  const searchUrl = `https://id.who.int/icd/release/11/2026-01/mms/search?q=${encodeURIComponent(normalized)}&useFlexisearch=true&subtreeFilterUsesFoundationDescendants=true`;
  const data = await icdFetch(searchUrl);

  const entities = data.destinationEntities || [];

  // If input looks like a code (letters/numbers with optional dot)
  const isCodeLike = /^[A-Z0-9]+(\.[A-Z0-9]+)?$/.test(input.trim());

  if (isCodeLike) {
    // Try exact match
    const exactMatch = entities.find(e => e.theCode === input.trim());
    if (exactMatch) {
      return { code: exactMatch.theCode, title: exactMatch.title };
    }
    // Fallback: return all entities whose code starts with normalized input
    return entities.map(e => ({ code: e.theCode, title: e.title }));
  } else {
    // Title/keyword search → return all matches
    return entities.map(e => ({
      code: e.theCode,
      title: e.title.replace(/<[^>]+>/g, ""), // strip HTML tags
      synonyms: e.matchingPVs?.map(pv => pv.label)
    }));
  }
}



(async () => {
  try {
    const result = await lookupICD(`Progressive myoclonic epilepsy`);
    console.log("Lookup result:", result);

    //const result2 = await lookupICDByCode("EC23.1");
    //console.log("Lookup result for EC23.1:", result2);
  } catch (err) {
    console.error("Error testing ICD API:", err);
  }
})();
//8A61.41 - Progressive myoclonic epilepsy
module.exports = { lookupICD };