const express = require('express');
const router = express.Router();
const db = require('../../config/query.js');
const { jwtProtect } = require('../../config/middleware/jwtProtect');
const logger = require('../../utils/logger');

// Helper function to get user ID via identifier
async function getUserIDViaIdentifier(identifier, branch) {
    const query = `
        SELECT uc.id as "userId" 
        FROM "UserCredentials" uc
        INNER JOIN "UsersPersonal" up ON uc.id = up.id
        WHERE up.identifier = $1 AND 
        (up.branch = $2 OR up.branch = 'Both' OR $2 = 'Both')
    `;
    const result = await db.query(query, [identifier, branch]);
    return result.rows;
}

async function getUserIdViaName(name, branch) {
    const tags = name
        .split(/\s+/)
        .map(t => t.trim())
        .filter(Boolean);

    if (!tags.length) return [];

    const scoreClauses = [];
    const searchClauses = [];
    const params = [];

    tags.forEach((tag, i) => {
        const paramIndex = params.length + 1;
        params.push(`%${tag}%`);
        // Score weighting: first=3, middle=1, last=2
        scoreClauses.push(`(CASE WHEN up.first_name ILIKE $${paramIndex} THEN 3 ELSE 0 END +
                           CASE WHEN up.middle_name ILIKE $${paramIndex} THEN 1 ELSE 0 END +
                           CASE WHEN up.last_name ILIKE $${paramIndex} THEN 2 ELSE 0 END)`);
        searchClauses.push(`up.first_name ILIKE $${paramIndex}`);
        searchClauses.push(`up.middle_name ILIKE $${paramIndex}`);
        searchClauses.push(`up.last_name ILIKE $${paramIndex}`);
    });

    const branchIndex = params.length + 1;
    params.push(branch);

    const query = `
        SELECT DISTINCT uc.id AS "userId",
               (${scoreClauses.join(' + ')}) AS score
        FROM "UserCredentials" uc
        JOIN "UsersPersonal" up ON uc.id = up.id
        WHERE (${searchClauses.join(' OR ')})
          AND (up.branch = $${branchIndex} OR up.branch = 'Both' OR $${branchIndex} = 'Both')
        ORDER BY score DESC
        LIMIT 50
    `;

    const result = await db.query(query, params);
    return result.rows;
}

// Helper function to get user ID via email
async function getUserIdViaEmail(email, branch) {
    const query = `
        SELECT uc.id as "userId" 
        FROM "UserCredentials" uc
        LEFT JOIN "UsersPersonal" up ON uc.id = up.id
        WHERE LOWER(uc.email) = LOWER($1) AND 
        (up.branch = $2 OR up.branch = 'Both' OR $2 = 'Both' OR up.branch IS NULL)
    `;
    const result = await db.query(query, [email, branch]);
    return result.rows;
}

// Route: Get user ID by identifier
router.get('/id/identifier/:identifier/:branch', jwtProtect("medical"), async (req, res) => {
    try {
        const { identifier, branch } = req.params;

        const medicalBranch = await db.getUserBranch(req.user.id);
        if (medicalBranch !== 'Both' && medicalBranch !== branch) {
            return res.status(403).json({ error: `Forbidden: Access to this branch \`${branch}\` is denied` });
        }

        const users = await getUserIDViaIdentifier(parseInt(identifier), branch);
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        logger.info(`Retrieved user IDs by identifier: ${identifier}`);
        res.json({ users: users.map(u => u.userId) });
    } catch (error) {
        logger.error('Error getting user ID by identifier:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route: Get user ID by name
router.get('/id/name/:name/:branch', jwtProtect("medical"), async (req, res) => {
    try {
        const { name, branch } = req.params;

        const medicalBranch = await db.getUserBranch(req.user.id);
        if (medicalBranch !== 'Both' && medicalBranch !== branch) {
            return res.status(403).json({ error: `Forbidden: Access to this branch \`${branch}\` is denied` });
        }

        const users = await getUserIdViaName(name, branch);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        logger.info(`Retrieved user IDs by name: ${name}`);
        res.json({ users: users.map(u => u.userId) });
    } catch (error) {
        logger.error('Error getting user ID by name:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route: Get user ID by email
router.get('/id/email/:email/:branch', jwtProtect("patient"), async (req, res) => {
    try {
        const { email, branch } = req.params;

        const medicalBranch = await db.getUserBranch(req.user.id);
        if (medicalBranch !== 'Both' && medicalBranch !== branch) {
            console.log(req.user.id, branch);
            return res.status(403).json({ error: `Forbidden: Access to this branch \`${branch}\` is denied` });
        }
        const users = await getUserIdViaEmail(email, branch);

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        logger.info(`Retrieved user IDs by email: ${email}`);
        res.json({ userId: users[0].userId });
    } catch (error) {
        logger.error('Error getting user ID by email:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;


