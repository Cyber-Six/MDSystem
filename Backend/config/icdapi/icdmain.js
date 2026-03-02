const { getIcdToTitle, getTitleToIcd, createICDLookup,
    updateICDLookup, getICDLookupById } = require('./icddb.js');
const { icdFetch, titleToicdCode, icdCodeToTitle } = require('./icdapi.js');
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const release = process.env.ICD_RELEASE;

async function GetIcd(title) {
    try {
        let results = [];
        // Check database
        let dbRecord = await getTitleToIcd(title);

        if (!dbRecord || dbRecord.length === 0) {
            console.log('DB record found:', dbRecord);
            // Query API and store
            const Icdresults = await titleToicdCode(title);
            if (!Icdresults || Icdresults.length === 0) return [{}];
            //console.log('API result:', results);

            for (const result of Icdresults) {
                const dbResult = await createICDLookup(result.code, result.title, result.stemId, release);
                results.push({ id: dbResult.id, code: result.code, title: result.title });
            }
            return results;
        }
        for (let rec of dbRecord) {
            if (new Date(rec.updated_at) >= new Date(release)) {
                results.push({id: rec.id, code: rec.code, title: rec.title});
            }
            else {
                const apiResult = await icdFetch(rec.title);
                if (apiResult) {
                    await updateICDLookup(rec.id, apiResult.code, apiResult.title, apiResult.stemId, release);
                    results.push({id: rec.id, code: apiResult.code, title: apiResult.title });
                }
            }
        }
        // Record is fresh
        return results;
    } catch (error) {
        console.error('GetIcd error:', error);
        return [{}];
    }
}

async function GetTitle(icdCode) {
    try {
        // Check database
        let dbRecord = await getIcdToTitle(icdCode);
        
        if (!dbRecord || dbRecord.length === 0) {
            // Query API and store
            const result = await icdCodeToTitle(icdCode);
            if (!result) return [{}];
            
            const dbResult = await createICDLookup(result.code, result.title, result.stemId, release);
            return [{ id: dbResult.id, code: result.code, title: result.title }];
        }
        
        const results = [];
        for (let rec of dbRecord) {
            if (new Date(rec.updated_at) >= new Date(release)) {
                results.push({id: rec.id, code: rec.code, title: rec.title});
            }
            else {
                const apiResult = await icdFetch(rec.stemData);
                if (apiResult) {
                    await updateICDLookup(rec.id, apiResult.code, apiResult.title, apiResult.stemId, release);
                    results.push({id: rec.id, code: apiResult.code, title: apiResult.title });
                }
            }
        }
        
        // Record is fresh
        return results;
    } catch (error) {
        console.error('GetTitle error:', error);
        return [{}];
    }
}

async function getIcdDetails(id) {
    try {
        const dbRecord = await getICDLookupById(id);
        if (!dbRecord) {
            console.log(`No record found in DB for ID: ${id}`);
            return null;
        }

        return await icdFetch(dbRecord.stemData);
    } catch (error) {
        console.error('getIcdDetails error:', error);
        return null;
    }
}

module.exports = { GetIcd, GetTitle, getIcdDetails };