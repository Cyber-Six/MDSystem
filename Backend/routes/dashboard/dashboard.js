const express = require('express');
const router = express.Router();
const db = require('../../config/query.js');
const { jwtProtect } = require('../../config/middleware/jwtProtect');
const logger = require('../../utils/logger');

// ── Dashboard Stats ──────────────────────────────────────────────────────────

/**
 * GET /dashboard/stats
 * Returns aggregated dashboard statistics for the staff portal.
 * All counts are scoped to the requesting user's branch.
 */
router.get('/stats', jwtProtect("medical"), async (req, res) => {
    try {
        const userBranch = await db.getUserBranch(req.user.id);

        // Run all stat queries in parallel for efficiency
        const [
            pendingEmrResult,
            pendingAppointmentsResult,
            pendingMedicineResult,
            activeConsultationsResult,
            lowStockResult,
            todayAppointmentsResult,
            tomorrowSlotsResult,
            recentPatientsResult,
            pendingRequestsResult,
        ] = await Promise.all([
            // 1. Pending EMR update tickets
            db.query(`
                SELECT COUNT(DISTINCT pul."patientId")::int AS count
                FROM "patientUpdateLog" pul
                JOIN "UsersPersonal" up ON up.id = pul."patientId"
                WHERE pul.status IN ('Pending', 'InProgress', 'Revision', 'RevisionSubmitted')
                  AND ($1 = 'Both' OR up.branch::text = $1 OR up.branch = 'Both')
            `, [userBranch]),

            // 2. Pending appointment requests
            db.query(`
                SELECT COUNT(*)::int AS count
                FROM "patientSlot" ps
                WHERE ps.status = 'Pending'
            `),

            // 3. Pending medicine requests
            db.query(`
                SELECT COUNT(*)::int AS count
                FROM "MedicineRequestLog" mrl
                WHERE mrl.status = 'Pending'
                  AND ($1 = 'Both' OR mrl.location::text = $1)
            `, [userBranch]),

            // 4. Active consultations (Open, ReOpen, Created)
            db.query(`
                SELECT COUNT(*)::int AS count
                FROM "Consultation" c
                JOIN "UsersPersonal" up ON up.id = c."patientId"
                WHERE c.status IN ('Open', 'ReOpen', 'Created')
                  AND ($1 = 'Both' OR up.branch::text = $1 OR up.branch = 'Both')
            `, [userBranch]),

            // 5. Low stock items — medicine batches with total available <= 10
            db.query(`
                SELECT COUNT(*)::int AS count FROM (
                    SELECT mi.id
                    FROM "MedicalItems" mi
                    LEFT JOIN "MedicineBatch" mb ON mb."medicalItemId" = mi.id
                        AND (mb."expiryDate" IS NULL OR mb."expiryDate" > NOW())
                    LEFT JOIN LATERAL (
                        SELECT COUNT(*)::int AS available
                        FROM "MedicineEntity" me
                        WHERE me."batchId" = mb.id AND me."transactionId" IS NULL
                    ) av ON true
                    WHERE mi.active = true AND mi.category = 'Medicine'
                    GROUP BY mi.id
                    HAVING COALESCE(SUM(av.available), 0) <= 10
                ) low_items
            `),

            // 6. Today's appointments — total and remaining (not yet arrived)
            db.query(`
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE ps.status IN ('Scheduled') AND ps.arrived_at IS NULL)::int AS remaining
                FROM "patientSlot" ps
                JOIN "ScheduleDateEntity" sde ON ps."slotEntityId" = sde.id
                WHERE sde."scheduledDate" = CURRENT_DATE
                  AND ps.status IN ('Scheduled', 'InProgress', 'Completed')
            `),

            // 7. Tomorrow's slot availability grouped by scheduler location/label
            db.query(`
                SELECT
                    ss.id AS "schedulerId",
                    ss.label,
                    ss.location,
                    COALESCE(sde."morningAllowed", ss."morningAllowed") AS "morningAllowed",
                    COALESCE(sde."afternoonAllowed", ss."afternoonAllowed") AS "afternoonAllowed",
                    COALESCE(SUM(CASE WHEN ps."session" = 'Morning' AND ps.status IN ('Scheduled','InProgress','Completed','Pending') THEN 1 ELSE 0 END), 0)::int AS "morningBooked",
                    COALESCE(SUM(CASE WHEN ps."session" = 'Afternoon' AND ps.status IN ('Scheduled','InProgress','Completed','Pending') THEN 1 ELSE 0 END), 0)::int AS "afternoonBooked"
                FROM "slotScheduler" ss
                LEFT JOIN "ScheduleDateEntity" sde ON sde."slotId" = ss.id AND sde."scheduledDate" = CURRENT_DATE + INTERVAL '1 day'
                LEFT JOIN "patientSlot" ps ON ps."slotEntityId" = sde.id
                WHERE ss."isActive" = true
                GROUP BY ss.id, ss.label, ss.location, sde."morningAllowed", sde."afternoonAllowed"
                ORDER BY ss.location, ss.label
            `),

            // 8. Recent patients (last 5 clinic visits via appointments completed/arrived today or recent consultations)
            db.query(`
                (
                    SELECT DISTINCT ON (up.id)
                        up.id,
                        CONCAT(up.first_name, ' ', up.last_name) AS name,
                        up.identifier,
                        p.program,
                        ps.arrived_at AS "lastVisit"
                    FROM "patientSlot" ps
                    JOIN "UsersPersonal" up ON up.id = ps."patientId"
                    LEFT JOIN "Patients" p ON p.id = up.id
                    WHERE ps.arrived_at IS NOT NULL
                      AND ($1 = 'Both' OR up.branch::text = $1 OR up.branch = 'Both')
                    ORDER BY up.id, ps.arrived_at DESC
                )
                ORDER BY "lastVisit" DESC
                LIMIT 5
            `, [userBranch]),

            // 9. Pending requests detail (latest 5 across EMR + appointments)
            db.query(`
                (
                    SELECT
                        pul.id::text AS id,
                        CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, '')) AS name,
                        'EMR Update' AS type,
                        pul.status::text AS status,
                        pul.created_at AS submitted
                    FROM "patientUpdateLog" pul
                    JOIN "UsersPersonal" up ON up.id = pul."patientId"
                    WHERE pul.status IN ('Pending', 'Revision', 'RevisionSubmitted')
                      AND ($1 = 'Both' OR up.branch::text = $1 OR up.branch = 'Both')
                    ORDER BY pul.created_at DESC
                    LIMIT 5
                )
                UNION ALL
                (
                    SELECT
                        ps.id::text AS id,
                        CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, '')) AS name,
                        'Appointment' AS type,
                        ps.status::text AS status,
                        ps.created_at AS submitted
                    FROM "patientSlot" ps
                    LEFT JOIN "UsersPersonal" up ON up.id = ps."patientId"
                    WHERE ps.status = 'Pending'
                    ORDER BY ps.created_at DESC
                    LIMIT 5
                )
                ORDER BY submitted DESC
                LIMIT 5
            `, [userBranch]),
        ]);

        // Aggregate pending request counts
        const pendingEmr = pendingEmrResult.rows[0]?.count || 0;
        const pendingAppointments = pendingAppointmentsResult.rows[0]?.count || 0;
        const pendingMedicine = pendingMedicineResult.rows[0]?.count || 0;
        const totalPending = pendingEmr + pendingAppointments + pendingMedicine;

        // Today's appointment stats
        const todayStats = todayAppointmentsResult.rows[0] || { total: 0, remaining: 0 };

        // Active consultations
        const activeConsultations = activeConsultationsResult.rows[0]?.count || 0;

        // Low stock
        const lowStockCount = lowStockResult.rows[0]?.count || 0;

        // Tomorrow's slots — group by location category (Medical vs Dental)
        const tomorrowSlots = tomorrowSlotsResult.rows;
        const tomorrowAvailability = {};
        for (const slot of tomorrowSlots) {
            const key = slot.label || slot.location || 'Other';
            const totalAllowed = (parseInt(slot.morningAllowed) || 0) + (parseInt(slot.afternoonAllowed) || 0);
            const totalBooked = (parseInt(slot.morningBooked) || 0) + (parseInt(slot.afternoonBooked) || 0);
            if (!tomorrowAvailability[key]) {
                tomorrowAvailability[key] = { open: 0, total: 0 };
            }
            tomorrowAvailability[key].total += totalAllowed;
            tomorrowAvailability[key].open += Math.max(0, totalAllowed - totalBooked);
        }

        res.json({
            stats: {
                pendingRequests: totalPending,
                pendingBreakdown: {
                    emr: pendingEmr,
                    appointments: pendingAppointments,
                    medicine: pendingMedicine,
                },
                todayAppointments: todayStats.total,
                todayRemaining: todayStats.remaining,
                activeConsultations,
                lowStockItems: lowStockCount,
            },
            tomorrowAvailability,
            recentPatients: recentPatientsResult.rows.map(r => ({
                id: r.id,
                name: r.name?.trim(),
                identifier: r.identifier,
                program: r.program || '—',
                lastVisit: r.lastVisit,
            })),
            pendingRequests: pendingRequestsResult.rows.map(r => ({
                id: r.id,
                name: r.name?.trim(),
                type: r.type,
                status: r.status,
                submitted: r.submitted,
            })),
        });
    } catch (error) {
        logger.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
});

module.exports = router;
