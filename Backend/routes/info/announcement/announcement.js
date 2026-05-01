const express = require("express");
const logger = require("../../../utils/logger.js");
const { query, queryClient, getUserBranch, connect, setSystemAuditLog } = require("../../../config/query.js");
const { jwtProtect } = require("../../../config/middleware/jwtProtect.js");
const { isMedicalPermitted, isMedicalPermittedLocationBased, permissions, getStaffBranch } = require("../../../services/permit.js");
const { promoteFile, deleteFile } = require("../../../config/multer.js");
const { ValidateBranchbyUserBranch, ValidateLocationDesignation } = require("../../../utils/validator.js");
const router = express.Router();

// ✅ GET all active announcements (Patient accessible)
router.get("/", jwtProtect(""), async (req, res) => {
    try {

        const userBranch = await getUserBranch(req.user?.id);

        const sql = `
            SELECT id, title as label, content as description, pubmat, 
                "isActive", created_at, location, "viewableUntil"
            FROM "Announcement"
            WHERE "isActive" = true AND
            ("viewableUntil" IS NULL OR "viewableUntil" > NOW()) AND
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

        // Check if user has announcement permission at all
        const { permitted } = await isMedicalPermitted(userId, permissions.announcement_allow_crud);
        if (!permitted) {
            return res.status(403).json({ error: "FORBIDDEN", message: "Not authorized to manage announcements." });
        }

        // Use MedicalPersonnel.designation as the authoritative staff branch
        const staffBranch = await getStaffBranch(userId);

        // Use explicit location query param, or fall back to the staff's actual branch
        const requestedLocation = req.query.location;
        const location = requestedLocation || staffBranch || 'Both';

        if (!ValidateLocationDesignation(location)) {
            return res.status(400).json({ error: "INVALID_LOCATION", message: "Location must be 'Manila', 'QuezonCity', or 'Both'" });
        }

        // If a specific location was requested, verify the staff member's branch allows it
        if (requestedLocation && requestedLocation !== 'Both' && staffBranch !== 'Both' && requestedLocation !== staffBranch) {
            return res.status(403).json({ error: "FORBIDDEN", message: `Not authorized to view announcements for location: '${requestedLocation}'.` });
        }

        // Build query: staff can only see announcements for their branch (+ 'Both' announcements are always visible)
        // If their branch is 'Both', they see everything
        // If their branch is 'Manila', they see Manila + 'Both' announcements
        // If their branch is 'QuezonCity', they see QuezonCity + 'Both' announcements
        const sql = `
            SELECT id, title as label, content as description, 
                pubmat, "isActive", created_at, location, "viewableUntil"
            FROM "Announcement"
            WHERE (
              $1 = 'Both'
              OR location = 'Both'
              OR ($1 = 'Manila' AND location = 'Manila')
              OR ($1 = 'QuezonCity' AND location = 'QuezonCity')
            )
            ORDER BY created_at DESC;
        `;

        const result = await query(sql, [staffBranch || 'Both']);
        return res.status(200).json({ success: true, data: result.rows, branch: staffBranch });
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
            an.created_at, an.location, an."viewableUntil"
            FROM "Announcement" an
            WHERE id = $1 AND 
            ("viewableUntil" IS NULL OR "viewableUntil" > NOW()) AND
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
  const client = await connect();
  let promotedPubmat = null;
    try {
    await client.query("BEGIN");

        const userId = req.user.id;
        const { label, description, pubmat, isActive, location, viewableUntil } = req.body;

      if (!ValidateLocationDesignation(location)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "INVALID_LOCATION", message: "Location must be 'Manila', 'QuezonCity', or 'Both'" });
      }

        // Check permission
        const permitted = await isMedicalPermittedLocationBased(userId, permissions.announcement_allow_crud, location);
        if (!permitted) {
          await client.query("ROLLBACK");
            return res.status(403).json({ error: "FORBIDDEN", message: `Not authorized to create announcements for location: '${location}'.` });
        }

        // Promote pubmat file if provided
        if (pubmat) {
            try {
                promotedPubmat = await promoteFile(userId, pubmat, "announcement");
            } catch (err) {
                logger.warn("Failed to promote pubmat file:", err.message);
              await client.query("ROLLBACK");
                return res.status(400).json({ error: "INVALID_FILE", message: "Failed to process pubmat file" });
            }
        }

        const sql = `
        INSERT INTO "Announcement" (title, content, pubmat, "isActive", location, "viewableUntil")
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, title as label, content as description, pubmat, "isActive", created_at, location, "viewableUntil";
        `;

        const params = [
            label || null,
            description || null,
            promotedPubmat,
            isActive !== undefined ? isActive : true,
            location || 'Both',
            viewableUntil || null
        ];

        const result = await client.query(sql, params);

        await setSystemAuditLog({
          client,
          eventType: "ANNOUNCEMENT_MANAGEMENT",
          actorId: userId,
          actorType: "Staff",
          targetId: null,
          action: "CREATE_ANNOUNCEMENT",
          details: JSON.stringify({
            announcementId: result.rows[0]?.id,
            title: label || null,
            description: description || null,
            pubmat: promotedPubmat,
            isActive: isActive !== undefined ? isActive : true,
            location: location || "Both",
            viewableUntil: viewableUntil || null,
          }),
          changedBy: "Medical",
        });

        await client.query("COMMIT");

        logger.info(`Announcement created by userId=${userId}`, { id: result.rows[0]?.id });
        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        await client.query("ROLLBACK");
        if (promotedPubmat) {
          try {
            await deleteFile("announcement", promotedPubmat);
          } catch (cleanupErr) {
            logger.error("Failed to cleanup promoted pubmat after create error:", cleanupErr);
          }
        }
        logger.error("Failed to create announcement:", err);
        return res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to create announcement" });
    } finally {
        client.release();
    }
});

// ✅ UPDATE announcement (Staff only)
router.put("/:id", jwtProtect("medical"), async (req, res) => {
  const client = await connect();
  let oldPubmat = null;
  let promotedPubmat = null;
  try {
    await client.query("BEGIN");

    const userId = req.user.id;
    const { id } = req.params;
    let { label, description, pubmat, isActive, location, viewableUntil } = req.body;
    const hasViewableUntil = Object.prototype.hasOwnProperty.call(req.body, "viewableUntil");

    // Existence check - need to verify current location for permission checks
    const existsResult = await client.query(`SELECT id, title, content, pubmat, "isActive", location, "viewableUntil" FROM "Announcement" WHERE id = $1;`, [id]);
    if (existsResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "NOT_FOUND", message: "Announcement not found" });
    }

    oldPubmat = existsResult.rows[0].pubmat;
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

    promotedPubmat = oldPubmat;

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
        location = COALESCE($5, location),
        "viewableUntil" = CASE
          WHEN $6::boolean THEN $7
          ELSE "viewableUntil"
        END
      WHERE id = $8
      RETURNING id, title as label, content as description, pubmat, "isActive", location, created_at, "viewableUntil";
    `;
    const params = [
      label,
      description,
      promotedPubmat,
      isActive,
      location,
      hasViewableUntil,
      hasViewableUntil ? viewableUntil : null,
      id,
    ];
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

    await setSystemAuditLog({
      client,
      eventType: "ANNOUNCEMENT_MANAGEMENT",
      actorId: userId,
      actorType: "Staff",
      targetId: null,
      action: "UPDATE_ANNOUNCEMENT",
      details: JSON.stringify({
        announcementId: Number(id),
        title: label || result.rows[0].label || null,
        description: description || result.rows[0].description || null,
        pubmat: promotedPubmat,
        isActive: isActive !== undefined ? isActive : result.rows[0].isActive,
        location: location || result.rows[0].location || null,
        viewableUntil: hasViewableUntil ? viewableUntil : result.rows[0].viewableUntil || null,
      }),
      changedBy: "Medical",
    });
    
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

        const existingResult = await client.query(`
          SELECT id, title, content, pubmat, "isActive", location, "viewableUntil"
          FROM "Announcement"
          WHERE id = $1;
        `, [id]);

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

            await setSystemAuditLog({
              client,
              eventType: "ANNOUNCEMENT_MANAGEMENT",
              actorId: userId,
              actorType: "Staff",
              targetId: null,
              action: "DELETE_ANNOUNCEMENT",
              details: JSON.stringify({
                announcementId: Number(id),
                title: existingResult.rows[0]?.title || null,
                description: existingResult.rows[0]?.content || null,
                pubmat: existingResult.rows[0]?.pubmat || null,
                isActive: existingResult.rows[0]?.isActive ?? null,
                location: existingResult.rows[0]?.location || null,
                viewableUntil: existingResult.rows[0]?.viewableUntil || null,
              }),
              changedBy: "Medical",
            });

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