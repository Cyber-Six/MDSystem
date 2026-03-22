const express = require("express");
const logger = require("../../../utils/logger.js");
const { query, queryControlled } = require("../../../config/query.js");
const { jwtProtect } = require("../../../config/middleware/jwtProtect.js");
const { isMedicalPermitted, permissions } = require("../../../services/permit.js");
const { promoteFile, checkFileByUuid } = require("../../../config/multer.js");

const router = express.Router();

// ✅ GET all active announcements (Patient accessible)
router.get("/", jwtProtect(""), async (req, res) => {
    try {
        const sql = `
            SELECT id, title as label, content as description, pubmat, "isActive", created_at
            FROM "Announcement"
            WHERE "isActive" = true
            ORDER BY created_at DESC;
        `;

        const result = await query(sql);
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

        const sql = `
            SELECT id, title as label, content as description, pubmat, "isActive", created_at
            FROM "Announcement"
            ORDER BY created_at DESC;
        `;

        const result = await query(sql);
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

        const sql = `
            SELECT id, title as label, content as description, pubmat, "isActive", created_at
            FROM "Announcement"
            WHERE id = $1;
        `;

        const result = await query(sql, [id]);

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
        const { label, description, pubmat, isActive } = req.body;

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

        const sql = `

        INSERT INTO "Announcement" (title, content, pubmat, "isActive")
            VALUES ($1, $2, $3, $4)
            RETURNING id, title as label, content as description, pubmat, "isActive", created_at;
        `;

        const params = [
            label || null,
            description || null,
            promotedPubmat,
            isActive !== undefined ? isActive : true
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
        const { label, description, pubmat, isActive } = req.body;

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
                "isActive" = COALESCE($4, "isActive")
            WHERE id = $5
            RETURNING id, title as label, content as description, pubmat, "isActive", created_at;
        `;

        const params = [
            label,
            description,
            promotedPubmat,
            isActive,
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
    try {
        const userId = req.user.id;
        const { id } = req.params;

        // Check permission
        const permitted = await isMedicalPermitted(userId, permissions.announcement_allow_crud, null);
        if (!permitted) {
            return res.status(403).json({ error: "FORBIDDEN", message: "Not authorized to delete announcements" });
        }

        const sql = `
            DELETE FROM "Announcement"
            WHERE id = $1
            RETURNING *;
        `;

        const result = await query(sql, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "NOT_FOUND", message: "Announcement not found" });
        }

        logger.info(`Announcement deleted by userId=${userId}`, { id });
        return res.status(200).json({ success: true, message: "Announcement deleted successfully" });
    } catch (err) {
        logger.error("Failed to delete announcement:", err);
        return res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to delete announcement" });
    }
});

module.exports = router;