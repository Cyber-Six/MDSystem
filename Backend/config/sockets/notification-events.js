const logger = require('../../utils/logger');
const { registerHandlers } = require('./socket-events');
const { isMedicalPermitted, getStaffBranch, permissions: permKeys } = require('../../services/permit');

/**
 * Maps a MedicalPersonnel.designation value to the slotScheduler.location
 * values that belong to that branch. This bridges the branch/location naming gap:
 *   MedicalPersonnel.designation  →  slotScheduler.location
 *   'Manila'                      →  ['Arlegui', 'Casal']
 *   'QuezonCity'                  →  ['QuezonCity']
 *   'Both'                        →  ['Arlegui', 'Casal', 'QuezonCity']
 *
 * Note: For updateTicket, the EMR emitter uses branch names directly (Manila /
 * QuezonCity / Both) rather than location names, so we also track branch-level
 * rooms prefixed with 'role:' to match the emitToRole() convention.
 */
const BRANCH_TO_LOCATIONS = {
  Manila: ['Arlegui', 'Casal'],
  QuezonCity: ['QuezonCity'],
  Both: ['Arlegui', 'Casal', 'QuezonCity'],
};

/**
 * Notification Socket Events
 *
 * Client -> Server:
 *   notification:join-branch — Join the caller's branch room so they receive
 *                              branch-scoped events (appointment:submitted,
 *                              medicine:request:new, updateTicket, etc.)
 *
 * Server -> Client (emitted from route resolvers — patient events):
 *   appointment:responded          — appointment approved / rejected
 *   appointment:attendance-recorded — attendance marked
 *   healthchat:new-message         — new message from staff
 *   healthchat:ticket-approved     — chat approved
 *   healthchat:ticket-rejected     — chat rejected
 *   healthchat:ticket-closed       — chat closed
 *   medicine:request:approved      — medicine request approved
 *   medicine:request:rejected      — medicine request rejected
 *   medicine:request:pending       — medicine request pending
 *   medicine:prescription:issued   — prescription issued
 *   updateTicket:statusChanged     — record update ticket status changed
 *
 * Server -> Client (staff events):
 *   healthchat:ticket-created      — new chat request from patient
 *   healthchat:ticket-status-changed — ticket status changed
 *   appointment:submitted          — new appointment (branch room)
 *   medicine:request:new           — new medicine request (branch room)
 *   updateTicket                   — patient submitted record update (branch room)
 */

const notificationHandlers = {
  /**
   * Join the caller's assigned branch room.
   * Looks up the user's branch identifier in the DB and calls socket.join().
   * Safe to call multiple times — socket.io deduplicates room membership.
   *
   * Rooms joined depend on the staff member's branch AND module permissions:
   *   notif:healthchat              — health chat events (requires health_chat_allow_access)
   *   branch:{loc}:appointments     — appointment submissions (requires appointment_allow_view_records)
   *   branch:{loc}:inventory        — medicine/inventory requests (requires inventory_allow_view)
   *   {branch}::staff               — record update tickets (requires emr_allow_approval)
   */
  'notification:join-branch': async (socket, _data, ack) => {
    try {
      // Use MedicalPersonnel.designation — the authoritative branch field for staff.
      // getUserBranch() queries UsersPersonal.branch (a patient-centric table that may
      // not be set for staff, causing them to default to 'Both' and receive all branches).
      const branch = await getStaffBranch(socket.userId);

      if (!branch) {
        logger.warn(`[NOTIF-EVENTS] No branch found for user:${socket.userId}`);
        if (typeof ack === 'function') ack({ error: 'NO_BRANCH', message: 'No branch assigned' });
        return;
      }

      const locations = BRANCH_TO_LOCATIONS[branch] || [branch];

      // Check module permissions in parallel (isMedicalPermitted already bypasses for admins)
      const [appointmentPerm, inventoryPerm, healthChatPerm, pendingPerm] = await Promise.all([
        isMedicalPermitted(socket.userId, permKeys.appointment_allow_view_records),
        isMedicalPermitted(socket.userId, permKeys.inventory_allow_view),
        isMedicalPermitted(socket.userId, permKeys.health_chat_allow_access),
        isMedicalPermitted(socket.userId, permKeys.emr_allow_approval),
      ]);

      const joinedRooms = [];

      for (const loc of locations) {
        // Join appointment notification room only if staff has appointment permission for this branch
        // isMedicalPermitted already validates the branch scope within the permission
        if (appointmentPerm.permitted) {
          socket.join(`branch:${loc}:appointments`);
          joinedRooms.push(`branch:${loc}:appointments`);
        }

        // Join inventory/medicine request room only if staff has inventory view permission
        if (inventoryPerm.permitted) {
          socket.join(`branch:${loc}:inventory`);
          joinedRooms.push(`branch:${loc}:inventory`);
        }

        // Join records room for pending/update-ticket events
        if (pendingPerm.permitted) {
          socket.join(`branch:${loc}:records`);
          joinedRooms.push(`branch:${loc}:records`);
        }
      }

      // Join health chat notification room (not branch-scoped — tickets are global)
      if (healthChatPerm.permitted) {
        socket.join('notif:healthchat');
        joinedRooms.push('notif:healthchat');
      }

      // EMR mutations emit updateTicket to role:${patientBranch}::staff rooms.
      // Patient branch can be 'Manila', 'QuezonCity', or 'Both'. Staff must join
      // the rooms corresponding to their own branch scope plus 'Both' so that
      // patients assigned to 'Both' always reach an authorized staff member.
      if (socket.userRole === 'medical' && pendingPerm.permitted) {
        // Build the set of branch-level rooms this staff member should monitor.
        const staffBranchRooms =
          branch === 'Both'
            ? ['Manila', 'QuezonCity', 'Both']
            : [branch, 'Both'];

        for (const b of staffBranchRooms) {
          socket.join(`role:${b}::staff`);
          joinedRooms.push(`role:${b}::staff`);
        }
      }

      logger.debug(`[NOTIF-EVENTS] user:${socket.userId} joined branch:${branch} → rooms: ${joinedRooms.join(', ')}`);
      if (typeof ack === 'function') ack({ success: true, branch, rooms: joinedRooms });
    } catch (err) {
      logger.error(`[NOTIF-EVENTS] join-branch error for user:${socket.userId}:`, err.message);
      if (typeof ack === 'function') ack({ error: 'INTERNAL_ERROR', message: err.message });
    }
  },

};

registerHandlers(notificationHandlers);
logger.info('[NOTIF-EVENTS] Notification socket event handlers registered');
