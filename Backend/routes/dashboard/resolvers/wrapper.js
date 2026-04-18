const db = require('../../../config/query.js');
const { isMedicalPermitted } = require('../../../services/permit.js');
const logger = require('../../../utils/logger.js');
const { throwGraphQLError } = require('../../../utils/graphql-helper.js');
const emrWrapperQuery = require('../../emr/wrapper/query.js');
const { autoExpireTickets } = require('../../health-chat/resolvers/wrapper/helper.js');

const Query = {
  _getDashboardStats: async (_, args, { user, res }) => {
    const userId = user.id;

    try {
      // Get user's branch designation for data filtering
      const userBranchResult = await db.query(
        `SELECT designation FROM "MedicalPersonnel" WHERE id = $1`,
        [userId]
      );

      const userBranch = userBranchResult.rows[0]?.designation || 'Both';

      // Check what permissions the user has
      // These will determine which stats to include
      const permissions = await Promise.all([
        isMedicalPermitted(userId, 'ALLOW_TO_APPROVE_EMR'),
        isMedicalPermitted(userId, 'ALLOW_TO_APPROVE_APPOINTMENT'),
        isMedicalPermitted(userId, 'ALLOW_TO_APPROVE_MEDICINE_REQUEST'),
        isMedicalPermitted(userId, 'ALLOW_TO_VIEW_APPOINTMENT'),
        isMedicalPermitted(userId, 'ALLOW_TO_VIEW_CONSULTATION'),
        isMedicalPermitted(userId, 'ALLOW_TO_VIEW_INVENTORY'),
        isMedicalPermitted(userId, 'ALLOW_TO_VIEW_APPOINTMENT_CONFIGURATION'),
        isMedicalPermitted(userId, 'ALLOW_TO_VIEW_PROFILE'),
      ]);

      const [
        canApproveEMR,
        canApproveAppointment,
        canApproveMedicine,
        canViewAppointments,
        canViewConsultations,
        canViewInventory,
        canViewAppointmentConfig,
        canViewProfiles,
      ] = permissions.map(p => p.permitted);

      // If user has no permissions, log warning and return empty stats
      if (!canApproveEMR && !canApproveAppointment && !canApproveMedicine &&
          !canViewAppointments && !canViewConsultations && !canViewInventory &&
          !canViewAppointmentConfig && !canViewProfiles) {
        logger.warn(`User ${userId} has no dashboard permissions`);
        return {
          pendingRequests: null,
          pendingBreakdown: null,
          todayAppointments: null,
          todayRemaining: null,
          activeConsultations: null,
          lowStockItems: null,
          tomorrowAvailability: null,
          recentPatients: null,
          recentRequests: null,
        };
      }

      // Build queries only for permitted features
      // This reduces database load for restricted users
      const queriesToRun = [];
      const queryIndices = {};
      let queryIndex = 0;

      // Query 0: Pending EMR updates (if canApproveEMR)
      if (canApproveEMR) {
        queryIndices.pendingEmr = queryIndex++;
        queriesToRun.push(
          db.query(`
            SELECT COUNT(DISTINCT pul."patientId")::int AS count
            FROM "patientUpdateLog" pul
            JOIN "UsersPersonal" up ON up.id = pul."patientId"
            WHERE pul.status::text IN ('Pending', 'InProgress', 'Revision', 'RevisionSubmitted')
              AND ($1 = 'Both' OR up.branch::text = $1 OR up.branch = 'Both')
          `, [userBranch])
        );
      }

      // Query 1: Pending appointments (if canApproveAppointment)
      if (canApproveAppointment) {
        queryIndices.pendingAppointments = queryIndex++;
        queriesToRun.push(
          db.query(`
            SELECT COUNT(*)::int AS count
            FROM "patientSlot" ps
            WHERE ps.status::text = 'Pending'
          `)
        );
      }

      // Query 2: Pending medicine (if canApproveMedicine)
      if (canApproveMedicine) {
        queryIndices.pendingMedicine = queryIndex++;
        queriesToRun.push(
          db.query(`
            SELECT COUNT(*)::int AS count
            FROM "MedicineRequestLog" mrl
            WHERE mrl.status::text = 'Pending'
              AND ($1 = 'Both' OR mrl.location::text = $1)
          `, [userBranch])
        );
      }

      // Query 3: Today's appointments (if canViewAppointments)
      if (canViewAppointments) {
        queryIndices.todayAppointments = queryIndex++;
        queriesToRun.push(
          db.query(`
            SELECT
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE ps.status::text = 'Scheduled' AND ps.arrived_at IS NULL)::int AS remaining
            FROM "patientSlot" ps
            JOIN "ScheduleDateEntity" sde ON ps."slotEntityId" = sde.id
            WHERE sde."scheduledDate" = CURRENT_DATE
              AND ps.status::text IN ('Scheduled', 'InProgress', 'Completed')
          `)
        );
      }

      // Query 4: Active consultations (if canViewConsultations)
      if (canViewConsultations) {
        queryIndices.activeConsultations = queryIndex++;
        queriesToRun.push(
          db.query(`
            SELECT COUNT(*)::int AS count
            FROM "Consultation" c
            JOIN "UsersPersonal" up ON up.id = c."patientId"
            WHERE c.status::text IN ('Open', 'ReOpen', 'Created')
              AND ($1 = 'Both' OR up.branch::text = $1 OR up.branch = 'Both')
          `, [userBranch])
        );
      }

      // Query 5: Low stock items (if canViewInventory)
      if (canViewInventory) {
        queryIndices.lowStock = queryIndex++;
        queriesToRun.push(
          db.query(`
            SELECT COUNT(*)::int AS count FROM (
              SELECT DISTINCT mi.id
              FROM "MedicalItems" mi
              WHERE mi.active = true AND mi.category::text = 'Medicine'
                AND EXISTS (
                  SELECT 1 FROM (
                    SELECT mb.location,
                      COALESCE(SUM(CASE WHEN me."transactionId" IS NULL THEN 1 ELSE 0 END), 0) AS branch_stock
                    FROM "MedicineBatch" mb
                    LEFT JOIN "MedicineEntity" me ON me."batchId" = mb.id
                    WHERE mb."medicalItemId" = mi.id
                      AND (mb."expiryDate" IS NULL OR mb."expiryDate" > NOW())
                    GROUP BY mb.location
                  ) bs WHERE bs.branch_stock <= 10
                )
              UNION
              SELECT DISTINCT mi.id
              FROM "MedicalItems" mi
              WHERE mi.active = true AND mi.category::text = 'Supply'
                AND EXISTS (
                  SELECT 1 FROM (
                    SELECT sb.location,
                      COALESCE(SUM(CASE WHEN se."transactionId" IS NULL THEN 1 ELSE 0 END), 0) AS branch_stock
                    FROM "SupplyBatch" sb
                    LEFT JOIN "SupplyEntity" se ON se."batchId" = sb.id
                    WHERE sb."supplyItemId" = mi.id
                      AND (sb."expiryDate" IS NULL OR sb."expiryDate" > NOW())
                    GROUP BY sb.location
                  ) bs WHERE bs.branch_stock <= 10
                )
            ) low_items
          `)
        );
      }

      // Query 6: Tomorrow's slots (if canViewAppointmentConfig)
      if (canViewAppointmentConfig) {
        queryIndices.tomorrowSlots = queryIndex++;
        queriesToRun.push(
          db.query(`
            SELECT
              ss.id AS "schedulerId",
              ss.label,
              ss.location,
              COALESCE(sde."morningAllowed", ss."morningAllowed") AS "morningAllowed",
              COALESCE(sde."afternoonAllowed", ss."afternoonAllowed") AS "afternoonAllowed",
              COALESCE(SUM(CASE WHEN ps."session" = 'Morning' AND ps.status::text IN ('Scheduled','InProgress','Completed','Pending') THEN 1 ELSE 0 END), 0)::int AS "morningBooked",
              COALESCE(SUM(CASE WHEN ps."session" = 'Afternoon' AND ps.status::text IN ('Scheduled','InProgress','Completed','Pending') THEN 1 ELSE 0 END), 0)::int AS "afternoonBooked"
            FROM "slotScheduler" ss
            LEFT JOIN "ScheduleDateEntity" sde ON sde."slotId" = ss.id AND sde."scheduledDate" = CURRENT_DATE + INTERVAL '1 day'
            LEFT JOIN "patientSlot" ps ON ps."slotEntityId" = sde.id
            WHERE ss."isActive" = true
            GROUP BY ss.id, ss.label, ss.location, sde."morningAllowed", sde."afternoonAllowed"
            ORDER BY ss.location, ss.label
          `)
        );
      }

      // Query 7: Recent patients (if canViewProfiles)
      if (canViewProfiles) {
        queryIndices.recentPatients = queryIndex++;
        queriesToRun.push(
          db.query(`
            SELECT * FROM (
              SELECT DISTINCT ON (up.id)
                up.id,
                CONCAT(up.first_name, ' ', up.last_name) AS name,
                up.identifier,
                p.profile,
                ps.arrived_at AS "lastVisit"
              FROM "patientSlot" ps
              JOIN "UsersPersonal" up ON up.id = ps."patientId"
              LEFT JOIN "Patients" p ON p.id = up.id
              WHERE ps.arrived_at IS NOT NULL
                AND ($1 = 'Both' OR up.branch::text = $1 OR up.branch = 'Both')
              ORDER BY up.id, ps.arrived_at DESC
            ) recent
            ORDER BY "lastVisit" DESC
            LIMIT 5
          `, [userBranch])
        );
      }

      // Query 8: Pending requests (if user has any approval permission)
      if (canApproveEMR || canApproveAppointment) {
        queryIndices.pendingRequests = queryIndex++;
        queriesToRun.push(
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
              WHERE pul.status::text IN ('Pending', 'Revision', 'RevisionSubmitted')
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
              WHERE ps.status::text = 'Pending'
              ORDER BY ps.created_at DESC
              LIMIT 5
            )
            ORDER BY submitted DESC
            LIMIT 5
          `, [userBranch])
        );
      }

      // Execute all queries in parallel
      const results = await Promise.all(queriesToRun);

      // Extract results based on what we queried for
      let pendingEmr = 0;
      let pendingAppointments = 0;
      let pendingMedicine = 0;
      let todayStats = { total: 0, remaining: 0 };
      let activeConsultations = 0;
      let lowStockCount = 0;
      let tomorrowSlots = [];
      let recentPatients = [];
      let pendingRequestsList = [];

      if (queryIndices.pendingEmr !== undefined) {
        pendingEmr = results[queryIndices.pendingEmr].rows[0]?.count || 0;
      }

      if (queryIndices.pendingAppointments !== undefined) {
        pendingAppointments = results[queryIndices.pendingAppointments].rows[0]?.count || 0;
      }

      if (queryIndices.pendingMedicine !== undefined) {
        pendingMedicine = results[queryIndices.pendingMedicine].rows[0]?.count || 0;
      }

      if (queryIndices.todayAppointments !== undefined) {
        todayStats = results[queryIndices.todayAppointments].rows[0] || { total: 0, remaining: 0 };
      }

      if (queryIndices.activeConsultations !== undefined) {
        activeConsultations = results[queryIndices.activeConsultations].rows[0]?.count || 0;
      }

      if (queryIndices.lowStock !== undefined) {
        lowStockCount = results[queryIndices.lowStock].rows[0]?.count || 0;
      }

      if (queryIndices.tomorrowSlots !== undefined) {
        tomorrowSlots = results[queryIndices.tomorrowSlots].rows;
      }

      if (queryIndices.recentPatients !== undefined) {
        recentPatients = results[queryIndices.recentPatients].rows.map(r => ({
          id: r.id,
          name: r.name?.trim() || '—',
          identifier: r.identifier,
          program: r.profile || '—',
          lastVisit: r.lastVisit,
        }));
      }

      if (queryIndices.pendingRequests !== undefined) {
        pendingRequestsList = results[queryIndices.pendingRequests].rows.map(r => ({
          id: r.id,
          name: r.name?.trim() || '—',
          type: r.type,
          status: r.status,
          submitted: r.submitted,
        }));
      }

      // Process tomorrow's availability
      const tomorrowAvailability = [];
      const availabilityMap = {};

      for (const slot of tomorrowSlots) {
        const key = slot.label || slot.location || 'Other';
        const totalAllowed = (parseInt(slot.morningAllowed) || 0) + (parseInt(slot.afternoonAllowed) || 0);
        const totalBooked = (parseInt(slot.morningBooked) || 0) + (parseInt(slot.afternoonBooked) || 0);

        if (!availabilityMap[key]) {
          availabilityMap[key] = { label: key, open: 0, total: 0 };
        }
        availabilityMap[key].total += totalAllowed;
        availabilityMap[key].open += Math.max(0, totalAllowed - totalBooked);
      }

      for (const key in availabilityMap) {
        tomorrowAvailability.push(availabilityMap[key]);
      }

      const totalPending = pendingEmr + pendingAppointments + pendingMedicine;

      logger.info(`Dashboard stats fetched for userId=${userId}, userBranch=${userBranch}`);

      return {
        pendingRequests: canApproveEMR || canApproveAppointment || canApproveMedicine ? totalPending : null,
        pendingBreakdown: canApproveEMR || canApproveAppointment || canApproveMedicine ? {
          emr: pendingEmr,
          appointments: pendingAppointments,
          medicine: pendingMedicine,
        } : null,
        todayAppointments: canViewAppointments ? todayStats.total : null,
        todayRemaining: canViewAppointments ? todayStats.remaining : null,
        activeConsultations: canViewConsultations ? activeConsultations : null,
        lowStockItems: canViewInventory ? lowStockCount : null,
        tomorrowAvailability: canViewAppointmentConfig ? tomorrowAvailability : null,
        recentPatients: canViewProfiles ? recentPatients : null,
        recentRequests: (canApproveEMR || canApproveAppointment) ? pendingRequestsList : null,
      };
    } catch (error) {
      logger.error(`Error fetching dashboard stats for userId=${user.id}: ${error.message}`);
      throwGraphQLError(res)
        .message('Failed to fetch dashboard statistics')
        .status(500)
        .throw();
    }
  },

  _getPatientDashboardData: async (_, args, { user, res }) => {
    const userId = user?.id;
    if (!userId) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }

    try {
      const [appointmentResult, medicineResult, updateTicketResult] = await Promise.allSettled([
        db.query(
          `
            SELECT
              ps.id::text AS id,
              ps.status::text AS status,
              ps.session::text AS session,
              ps.purpose,
              ss.label AS "schedulerLabel",
              sde."scheduledDate" AS "scheduledDate",
              ps.created_at
            FROM "patientSlot" ps
            LEFT JOIN "ScheduleDateEntity" sde ON sde.id = ps."slotEntityId"
            LEFT JOIN "slotScheduler" ss ON ss.id = sde."slotId"
            WHERE ps."patientId" = $1
            ORDER BY ps.id DESC
            LIMIT 1
          `,
          [userId]
        ),
        db.query(
          `
            SELECT
              mrl.id::text AS id,
              mrl.status::text AS status,
              mrl.purpose,
              mrl.created_at
            FROM "MedicineRequestLog" mrl
            WHERE mrl."patientId" = $1
            ORDER BY mrl.created_at DESC
            LIMIT 20
          `,
          [userId]
        ),
        emrWrapperQuery._getUserUpdateTicket(_, { userId }, { user, res }),
      ]);

      let chatRows = [];
      let chatTotal = 0;

      try {
        await autoExpireTickets(userId);

        const [chatResult, chatCountResult] = await Promise.all([
          db.query(
            `
              SELECT
                hc.id::text AS id,
                hc.status::text AS status,
                hc.purpose,
                hc.session_start
              FROM "HealthChat" hc
              WHERE hc."patientId" = $1
              ORDER BY hc.id DESC
              LIMIT 50
            `,
            [userId]
          ),
          db.query(
            `
              SELECT COUNT(*)::int AS total
              FROM "HealthChat" hc
              WHERE hc."patientId" = $1
            `,
            [userId]
          ),
        ]);

        chatRows = chatResult.rows;
        chatTotal = chatCountResult.rows[0]?.total || 0;
      } catch (chatError) {
        logger.warn(`Patient dashboard chat segment failed for userId=${userId}: ${chatError.message}`);
      }

      const appointment = appointmentResult.status === 'fulfilled'
        ? (appointmentResult.value.rows[0] || null)
        : null;
      const medicineReqs = medicineResult.status === 'fulfilled'
        ? medicineResult.value.rows
        : [];
      const updateTicketRaw = updateTicketResult.status === 'fulfilled'
        ? updateTicketResult.value
        : null;

      if (appointmentResult.status === 'rejected') {
        logger.warn(`Patient dashboard appointment segment failed for userId=${userId}: ${appointmentResult.reason?.message || appointmentResult.reason}`);
      }
      if (medicineResult.status === 'rejected') {
        logger.warn(`Patient dashboard medicine segment failed for userId=${userId}: ${medicineResult.reason?.message || medicineResult.reason}`);
      }
      if (updateTicketResult.status === 'rejected') {
        logger.warn(`Patient dashboard update-ticket segment failed for userId=${userId}: ${updateTicketResult.reason?.message || updateTicketResult.reason}`);
      }

      const updateTicket = updateTicketRaw?.id
        ? {
            id: String(updateTicketRaw.id),
            status: updateTicketRaw.status || null,
            scope: updateTicketRaw.scope || null,
            notes: updateTicketRaw.notes || null,
            created_at: updateTicketRaw.created_at || null,
          }
        : null;

      return {
        appointment,
        medicineReqs,
        updateTicket,
        chatData: {
          chats: chatRows,
          total: chatTotal,
        },
      };
    } catch (error) {
      logger.error(`Error fetching patient dashboard data for userId=${userId}: ${error.message}`);
      throwGraphQLError(res)
        .message('Failed to fetch patient dashboard data')
        .status(500)
        .throw();
    }
  },
};

module.exports = { Query };
