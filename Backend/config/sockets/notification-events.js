const logger = require('../../utils/logger');
const { registerHandlers } = require('./socket-events');
const db = require('../query');

/**
 * Maps a UsersPersonal.branch value to the slotScheduler.location values
 * that belong to that branch. This bridges the branch/location naming gap:
 *   UsersPersonal.branch  →  slotScheduler.location
 *   'Manila'              →  ['Arlegui', 'Casal']
 *   'QuezonCity'          →  ['QuezonCity']
 *   'Both'                →  ['Arlegui', 'Casal', 'QuezonCity']
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
   */
  'notification:join-branch': async (socket, _data, ack) => {
    try {
      const branch = await db.getUserBranch(socket.userId);

      if (!branch) {
        logger.warn(`[NOTIF-EVENTS] No branch found for user:${socket.userId}`);
        if (typeof ack === 'function') ack({ error: 'NO_BRANCH', message: 'No branch assigned' });
        return;
      }

      // Join location-based rooms that match this staff member's branch.
      // slotScheduler.location uses city names ('Arlegui', 'Casal', 'QuezonCity')
      // while UsersPersonal.branch uses region names ('Manila', 'QuezonCity', 'Both').
      // Appointments are emitted to branch:${location}, so staff must join those rooms.
      const locations = BRANCH_TO_LOCATIONS[branch] || [branch];
      for (const loc of locations) {
        socket.join(`branch:${loc}`);
      }

      // Medical staff also need the role-prefixed branch room used by EMR mutations
      if (socket.userRole === 'medical') {
        socket.join(`${branch}::staff`);
      }

      logger.debug(`[NOTIF-EVENTS] user:${socket.userId} joined branch:${branch} → rooms: ${locations.map(l => `branch:${l}`).join(', ')}`);
      if (typeof ack === 'function') ack({ success: true, branch });
    } catch (err) {
      logger.error(`[NOTIF-EVENTS] join-branch error for user:${socket.userId}:`, err.message);
      if (typeof ack === 'function') ack({ error: 'INTERNAL_ERROR', message: err.message });
    }
  },
};

registerHandlers(notificationHandlers);
logger.info('[NOTIF-EVENTS] Notification socket event handlers registered');
