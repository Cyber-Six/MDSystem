const express = require("express");
const logger = require("../../../utils/logger.js");
const { query, queryClient, queryControlled, getUserBranch, connect } = require("../../../config/query.js");
const { jwtProtect } = require("../../../config/middleware/jwtProtect.js");
const { isMedicalPermitted, isMedicalPermittedLocationBased, getMedicalPermissionBranch, permissions } = require("../../../services/permit.js");
const { promoteFile, deleteFile } = require("../../../config/multer.js");
const { ValidateBranchbyUserBranch, ValidateLocationDesignation } = require("../../../utils/validator.js");
const router = express.Router();

// ✅ GET all active announcements (Patient accessible)
router.get("/", jwtProtect(""), async (req, res) => {
    try {

        const userBranch = await getUserBranch(req.user?.id);

        const sql = `
            SELECT id, title as label, content as description, pubmat, 
                "isActive", created_at, location
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
        
        // Get the staff's announcement permission branch (what they're permitted to access)
        const permissionBranch = await getMedicalPermissionBranch(userId, permissions.announcement_allow_crud);
        
        // If no permission, return 403
        if (!permissionBranch) {
            return res.status(403).json({ error: "FORBIDDEN", message: "You do not have announcement management permissions." });
        }

        // Build query: staff can only see announcements in locations where they have permission
        // If their permission is 'Both', they see everything
        // If their permission is 'Manila' or 'QuezonCity', they only see that location + 'Both' announcements
        const sql = `
            SELECT id, title as label, content as description, 
                pubmat, "isActive", created_at, location
            FROM "Announcement"
            WHERE (
              $1 = 'Both'
              OR location = 'Both'
              OR ($1 = 'Manila' AND location = 'Manila')
              OR ($1 = 'QuezonCity' AND location = 'QuezonCity')
            )
            ORDER BY created_at DESC;
        `;

        const result = await query(sql, [permissionBranch]);
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
            an.created_at, an.location
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

        if (!ValidateLocationDesignation(location)) {
            return res.status(400).json({ error: "INVALID_LOCATION", message: "Location must be 'Manila', 'QuezonCity', or 'Both'" });
        }

        // Check permission
        const permitted = await isMedicalPermittedLocationBased(userId, permissions.announcement_allow_crud, location);
        if (!permitted) {
            return res.status(403).json({ error: "FORBIDDEN", message: `Not authorized to create announcements for location: '${location}'.` });
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
        INSERT INTO "Announcement" (title, content, pubmat, "isActive", location)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, title as label, content as description, pubmat, "isActive", created_at, location;
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
  const client = await connect();
  try {
    await client.query("BEGIN");

    const userId = req.user.id;
    const { id } = req.params;
    let { label, description, pubmat, isActive, location } = req.body;

    // Existence check - need to verify current location for permission checks
    const existsResult = await client.query(`SELECT id, pubmat, location FROM "Announcement" WHERE id = $1;`, [id]);
    if (existsResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "NOT_FOUND", message: "Announcement not found" });
    }

    const oldPubmat = existsResult.rows[0].pubmat;
    const currentLocation = existsResult.rows[0].location;

    // Validate new location if provided
    if (location && !ValidateLocationDesignation(location)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "INVALID_LOCATION", message: "Location must be 'Manila', 'QuezonCity', or 'Both'" });
    }

    // Check permission for BOTH current and new location
    const locationToCheck = location || currentLocation;
    const permitted = await isMedicalPermittedLocationBased(userId, permissions.announcement_allow_crud, locationToCheck);
    if (!permitted) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "FORBIDDEN", message: `Not authorized to update announcements for location: '${locationToCheck}'.` });
    }

    // Also verify permission for current location if changing location
    if (location && location !== currentLocation) {
      const currentPermitted = await isMedicalPermittedLocationBased(userId, permissions.announcement_allow_crud, currentLocation);
      if (!currentPermitted) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "FORBIDDEN", message: `Not authorized to modify announcements at current location: '${currentLocation}'.` });
      }
    }

    let promotedPubmat = oldPubmat;

    // Promote new pubmat if provided
    if (pubmat && pubmat !== oldPubmat) {
      try {
        promotedPubmat = await promoteFile(userId, pubmat, "announcement");
      } catch (err) {
        await client.query("ROLLBACK");
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
      RETURNING id, title as label, content as description, pubmat, "isActive", location, created_at;
    `;
    const params = [label, description, promotedPubmat, isActive, location, id];
    const result = await client.query(sql, params);

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      // cleanup new pubmat if promoted
      if (promotedPubmat && promotedPubmat !== oldPubmat) {
        await deleteFile("announcement", promotedPubmat);
      }
      return res.status(404).json({ error: "NOT_FOUND", message: "Announcement not found" });
    }

    // Delete old pubmat only after SQL succeeds
    if (oldPubmat && promotedPubmat !== oldPubmat) {
      try {
        await deleteFile("announcement", oldPubmat);
      } catch (err) {
        await client.query("ROLLBACK");
        logger.error("Failed to delete old pubmat file:", err);
        // cleanup new pubmat too
        if (promotedPubmat && promotedPubmat !== oldPubmat) {
          await deleteFile("announcement", promotedPubmat);
        }
        return res.status(500).json({ error: "FILE_DELETE_ERROR", message: "Failed to delete old pubmat file" });
      }
    }

    await client.query("COMMIT");
    logger.info(`Announcement updated by userId=${userId}`, { id });
    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (promotedPubmat && promotedPubmat !== oldPubmat) {
        try {
            await deleteFile("announcement", promotedPubmat);
        } catch (cleanupErr) {
            logger.error("Failed to cleanup promoted pubmat after error:", cleanupErr);
        }
    }

    await client.query("ROLLBACK");
    logger.error(`Failed to update announcement id=${req.params.id} by userId=${req.user.id}:`, err);
    return res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to update announcement" });
  } finally {
    client.release();
  }
});


// ✅ DELETE announcement (Staff only)
router.delete("/:id", jwtProtect("medical"), async (req, res) => {
    const client = await connect();
    try {
        await client.query("BEGIN");

        const userId = req.user.id;
        const { id } = req.params;

        const qResult = await client.query(`SELECT location FROM "Announcement" WHERE id = $1;`, [id]);
        if (qResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "NOT_FOUND", message: "Announcement not found" });
        }
        const location = qResult.rows[0].location;

        // Check permission
        const permitted = await isMedicalPermittedLocationBased(userId, permissions.announcement_allow_crud, location);
        if (!permitted) {
            await client.query("ROLLBACK");
            return res.status(403).json({ error: "FORBIDDEN", message: "Not authorized to delete announcements" });
        }

        const sql = `
            DELETE FROM "Announcement"
            WHERE id = $1
            RETURNING *;
        `;

        const result = await queryClient(client, sql, [id]);


        if (result.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "NOT_FOUND", message: "Announcement not found" });
        }

        if (result.rows[0].pubmat) {
            try {
                await deleteFile("announcement", result.rows[0].pubmat);
            } catch (err) {
                await client.query("ROLLBACK");
                logger.error("Failed to delete pubmat file during announcement deletion:", err);
                return res.status(500).json({ error: "FILE_DELETE_ERROR", message: "Failed to delete associated pubmat file" });
            }
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