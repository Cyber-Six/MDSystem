const express = require("express");
const logger = require("../../../utils/logger.js");
const { query, queryClient, queryControlled, getUserBranch, connect } = require("../../../config/query.js");
const { jwtProtect } = require("../../../config/middleware/jwtProtect.js");
const { isMedicalPermitted, permissions } = require("../../../services/permit.js");
const { promoteFile, deleteFile } = require("../../../config/multer.js");
const { ValidateBranchbyUserBranch } = require("../../../utils/validator.js");
const router = express.Router();

// ✅ GET all active announcements (Patient accessible)
router.get("/", jwtProtect(""), async (req, res) => {
    try {

        const userBranch = await getUserBranch(req.user?.id);

        const sql = `
            SELECT id, title as label, content as description, pubmat, "isActive", created_at
            FROM "Announcement"
            WHERE "isActive" = true AND
            (
              $1 = 'Both'
              OR location = 'Both'
              OR ($1 = 'Manila' AND location = 'Manila')
              OR ($1 = 'QuezonCity' AND location = 'QuezonCity')
            )
            ORDER BY created_at DESC;
        `;

        const result = await query(sql, [userBranch || 'Both']);
        return res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
        logger.error("Failed to fetch announcements:", err);
        return res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to fetch announcements" });
    }
});

// ✅ GET all announcements including inactive (Staff only) - MUST be before /:id
router.get("/admin/all", jwtProtect("medical"), async (req, res) => {
    try {
        const userId = req.user.id;

        // Check permission
        const permitted = await isMedicalPermitted(userId, permissions.announcement_allow_crud, null);
        if (!permitted) {
            return res.status(403).json({ error: "FORBIDDEN", message: "Not authorized to view all announcements" });
        }

        const userBranch = await getUserBranch(userId);

        const sql = `
            SELECT id, title as label, content as description, pubmat, "isActive", created_at
            FROM "Announcement"
            WHERE (
              $1 = 'Both'
              OR location = 'Both'
              OR ($1 = 'Manila' AND location = 'Manila')
              OR ($1 = 'QuezonCity' AND location = 'QuezonCity')
            )
            ORDER BY created_at DESC;
        `;

        const result = await query(sql, [userBranch || 'Both']);
        return res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
        logger.error("Failed to fetch all announcements:", err);
        return res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to fetch announcements" });
    }
});

// ✅ GET single announcement by ID (Patient accessible)
router.get("/:id", jwtProtect(""), async (req, res) => {
    try {
        const { id } = req.params;

        const userBranch = await getUserBranch(req.user?.id);
        const sql = `
            SELECT an.id, an.title as label, 
            an.content as description, 
            an.pubmat, "isActive", 
            an.created_at
            FROM "Announcement" an
            WHERE id = $1 AND 
            (
              $2 = 'Both'
              OR an.location = 'Both'
              OR ($2 = 'Manila' AND an.location = 'Manila')
              OR ($2 = 'QuezonCity' AND an.location = 'QuezonCity')
            );
        `;

        const result = await query(sql, [id, userBranch || 'Both']);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "NOT_FOUND", message: "Announcement not found" });
        }

        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (err) {
        logger.error("Failed to fetch announcement:", err);
        return res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to fetch announcement" });
    }
});

// ✅ CREATE announcement (Staff only)
router.post("/", jwtProtect("medical"), async (req, res) => {
    try {
        const userId = req.user.id;
        const { label, description, pubmat, isActive, location } = req.body;

        // Check permission
        const permitted = await isMedicalPermitted(userId, permissions.announcement_allow_crud, null);
        if (!permitted) {
            return res.status(403).json({ error: "FORBIDDEN", message: "Not authorized to create announcements" });
        }

        // Promote pubmat file if provided
        let promotedPubmat = null;
        if (pubmat) {
            try {
                promotedPubmat = await promoteFile(userId, pubmat, "announcement");
            } catch (err) {
                logger.warn("Failed to promote pubmat file:", err.message);
                return res.status(400).json({ error: "INVALID_FILE", message: "Failed to process pubmat file" });
            }
        }

        if (location && !['Manila', 'QuezonCity', 'Both'].includes(location)) {
            return res.status(400).json({ error: "INVALID_LOCATION", message: "Location must be 'Manila', 'QuezonCity', or 'Both'" });
        }

        const userBranch = await getUserBranch(userId);

        const valid = ValidateBranchbyUserBranch(userBranch, location);
        if (!valid) {
            return res.status(400).json({ error: "INVALID_LOCATION", message: `Invalid location outside your scope "${location}".` });
        }
        
        const sql = `
        INSERT INTO "Announcement" (title, content, pubmat, "isActive", location)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, title as label, content as description, pubmat, "isActive", created_at;
        `;

        const params = [
            label || null,
            description || null,
            promotedPubmat,
            isActive !== undefined ? isActive : true,
            location || 'Both'
        ];

        const result = await queryControlled(sql, params);

        logger.info(`Announcement created by userId=${userId}`, { id: result.rows[0]?.id });
        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        logger.error("Failed to create announcement:", err);
        return res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to create announcement" });
    }
});

// ✅ UPDATE announcement (Staff only)
router.put("/:id", jwtProtect("medical"), async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { label, description, pubmat, isActive, location } = req.body;

        // Check permission
        const permitted = await isMedicalPermitted(userId, permissions.announcement_allow_crud, null);
        if (!permitted) {
            return res.status(403).json({ error: "FORBIDDEN", message: "Not authorized to update announcements" });
        }

        // Check if announcement exists
        const existsResult = await query(`SELECT id, pubmat FROM "Announcement" WHERE id = $1;`, [id]);
        if (existsResult.rows.length === 0) {
            return res.status(404).json({ error: "NOT_FOUND", message: "Announcement not found" });
        }

        if (location){
            const userBranch = await getUserBranch(userId);
            const valid = ValidateBranchbyUserBranch(userBranch, location);
            if (!valid) {
                return res.status(400).json({ error: "INVALID_LOCATION", message: `Invalid location outside your scope "${location}".` });
            }
        }

        // Promote new pubmat file if provided
        let promotedPubmat = existsResult.rows[0].pubmat;
        if (pubmat && pubmat !== promotedPubmat) {
            try {
                promotedPubmat = await promoteFile(userId, pubmat, "announcement");
            } catch (err) {
                logger.warn("Failed to promote pubmat file:", err.message);
                return res.status(400).json({ error: "INVALID_FILE", message: "Failed to process pubmat file" });
            }
        }

        const sql = `
            UPDATE "Announcement"
            SET
                title = COALESCE($1, title),
                content = COALESCE($2, content),
                pubmat = COALESCE($3, pubmat),
                "isActive" = COALESCE($4, "isActive"),
                location = COALESCE($5, location)
            WHERE id = $6
            RETURNING id, title as label, content as description, pubmat, "isActive", created_at;
        `;

        const params = [
            label,
            description,
            promotedPubmat,
            isActive,
            location,
            id
        ];

        const result = await queryControlled(sql, params);

        logger.info(`Announcement updated by userId=${userId}`, { id });
        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (err) {
        logger.error("Failed to update announcement:", err);
        return res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to update announcement" });
    }
});

// ✅ DELETE announcement (Staff only)
router.delete("/:id", jwtProtect("medical"), async (req, res) => {
    const client = await connect();
    try {
        await client.query("BEGIN");

        const userId = req.user.id;
        const { id } = req.params;

        // Check permission
        const permitted = await isMedicalPermitted(userId, permissions.announcement_allow_crud, null);
        if (!permitted) {
            return res.status(403).json({ error: "FORBIDDEN", message: "Not authorized to delete announcements" });
        }

        const userBranch = await getUserBranch(userId);

        const sql = `
            DELETE FROM "Announcement"
            WHERE id = $1 AND 
            (
                $2 = 'Both'
                OR location = 'Both'
                OR ($2 = 'Manila' AND location = 'Manila')
                OR ($2 = 'QuezonCity' AND location = 'QuezonCity')
            )
            RETURNING *;
        `;

        const result = await queryClient(client, sql, [id, userBranch]);


        if (result.rowCount === 0) {
            return res.status(404).json({ error: "NOT_FOUND", message: "Announcement not found" });
        }

        if (result.rows[0].pubmat) {
            await deleteFile("announcement", result.rows[0].pubmat);
            }

        await client.query("COMMIT");
        logger.info(`Announcement deleted by userId=${userId}`, { id });
        return res.status(200).json({ success: true, message: "Announcement deleted successfully" });
    } catch (err) {
        await client.query("ROLLBACK");
        logger.error("Failed to delete announcement:", err);
        return res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to delete announcement" });
    } finally {
        client.release();
    }
});

module.exports = router;