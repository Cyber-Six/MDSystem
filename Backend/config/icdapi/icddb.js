const db = require('../query.js');
const logger = require('../../utils/logger');

// Create - Add new ICD lookup record
const createICDLookup = async (code, title, stemData, release) => {
    try {
        const query = `
            INSERT INTO "ICDLookup" (code, title, "stemData", release)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const values = [code, title, stemData, release];
        const result = await db.query(query, values);
        logger.info(`ICD Lookup created: ${code}`);
        return result.rows[0];
    } catch (error) {
        logger.error(`Error creating ICD Lookup: ${error.message}`);
        throw error;
    }
};

// Read - Get ICD code by title (LIKE search)
const getTitleToIcd = async (titleLike, limit=10) => {
    try {
        const query = `SELECT * FROM "ICDLookup" WHERE title ILIKE $1 LIMIT $2;`;
        const result = await db.query(query, [`%${titleLike}%`, limit]);
        return result.rows;
    } catch (error) {
        logger.error(`Error retrieving ICD by title: ${error.message}`);
        throw error;
    }
};

// Read - Get ICD title by code (LIKE search)
const getIcdToTitle = async (codeLike, limit=10) => {
    try {
        const query = `SELECT * FROM "ICDLookup" WHERE code ILIKE $1 LIMIT $2;`;
        const result = await db.query(query, [`%${codeLike}%`, limit]);
        return result.rows;
    } catch (error) {
        logger.error(`Error retrieving title by ICD code: ${error.message}`);
        throw error;
    }
};

// Read - Get ICD lookup by ID
const getICDLookupById = async (id) => {
    try {
        const query = `SELECT * FROM "ICDLookup" WHERE id = $1;`;
        const result = await db.query(query, [id]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error(`Error retrieving ICD Lookup: ${error.message}`);
        throw error;
    }
};

// Read - Get all ICD lookups with pagination
const getAllICDLookups = async (limit = 20, offset = 0) => {
    try {
        const query = `
            SELECT * FROM "ICDLookup"
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2;
        `;
        const result = await db.query(query, [limit, offset]);
        return result.rows;
    } catch (error) {
        logger.error(`Error retrieving ICD Lookups: ${error.message}`);
        throw error;
    }
};

// Update - Update ICD lookup record
const updateICDLookup = async (id, code, title, stemData, release) => {
    try {
        const query = `
            UPDATE "ICDLookup"
            SET code = $1, title = $2, "stemData" = $3, release = $4, updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING *;
        `;
        const values = [code, title, stemData, release, id];
        const result = await db.query(query, values);
        if (result.rows.length === 0) {
            logger.warn(`ICD Lookup not found: ${id}`);
            return null;
        }
        logger.info(`ICD Lookup updated: ${id}`);
        return result.rows[0];
    } catch (error) {
        logger.error(`Error updating ICD Lookup: ${error.message}`);
        throw error;
    }
};

// Delete - Delete ICD lookup record
const deleteICDLookup = async (id) => {
    try {
        const query = `DELETE FROM "ICDLookup" WHERE id = $1 RETURNING id;`;
        const result = await db.query(query, [id]);
        if (result.rows.length === 0) {
            logger.warn(`ICD Lookup not found: ${id}`);
            return null;
        }
        logger.info(`ICD Lookup deleted: ${id}`);
        return result.rows[0];
    } catch (error) {
        logger.error(`Error deleting ICD Lookup: ${error.message}`);
        throw error;
    }
};

module.exports = {
    createICDLookup,
    getICDLookupById,
    getIcdToTitle,
    getTitleToIcd,
    getAllICDLookups,
    updateICDLookup,
    deleteICDLookup
};