// graphql.js - Dashboard GraphQL Entry Point

const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const fs = require('fs');
const path = require('path');
const db = require('../../config/query.js');
const { ipRateLimiter } = require('../../config/middleware/ratelimiter.js');
const { jwtProtect } = require('../../config/middleware/jwtProtect.js');
const logger = require('../../utils/logger.js');
const dashboardResolver = require('./resolvers/dashboard-resolver.js');

const schemaPath = path.join(__dirname, './schema.graphql');
const typeDefs = fs.readFileSync(schemaPath, 'utf8');

// Build schema with resolvers
const dashboardSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: dashboardResolver.Query,
  },
});

const ACTIVE_APPOINTMENT_STATUSES = new Set(['Pending', 'Scheduled', 'InProgress']);
const ACTIVE_MED_REQUEST_STATUSES = new Set(['Pending', 'InProgress', 'Revision', 'RevisionSubmitted']);
const ACTIVE_HEALTH_CHAT_STATUSES = new Set(['Open', 'Ongoing']);
const ACTIVE_UPDATE_TICKET_STATUSES = new Set(['Pending', 'InProgress', 'Revision', 'RevisionSubmitted']);

function buildPatientDashboardRestPayload(dashboardData = {}, options = {}) {
  const appointment = dashboardData?.appointment || null;
  const medicineReqs = Array.isArray(dashboardData?.medicineReqs) ? dashboardData.medicineReqs : [];
  const updateTicket = dashboardData?.updateTicket || null;
  const chatData = dashboardData?.chatData && typeof dashboardData.chatData === 'object'
    ? dashboardData.chatData
    : { chats: [], total: 0 };
  const chatItems = Array.isArray(chatData.chats) ? chatData.chats : [];

  const activeAppointments = appointment && ACTIVE_APPOINTMENT_STATUSES.has(appointment.status) ? 1 : 0;
  const activeMedRequests = medicineReqs.filter((item) => ACTIVE_MED_REQUEST_STATUSES.has(item?.status)).length;
  const activeHealthChats = chatItems.filter((item) => ACTIVE_HEALTH_CHAT_STATUSES.has(item?.status)).length;
  const pendingDocuments = Number(options.pendingDocuments) || 0;

  const recentDocuments = Array.isArray(options.documents) ? options.documents : [];
  const totalDocuments = Number(options.documentsTotal) || recentDocuments.length;
  const chatTotal = Number(chatData.total);

  return {
    success: true,
    pending: {
      total: activeAppointments + activeMedRequests + activeHealthChats + pendingDocuments,
      appointments: activeAppointments,
      medRequests: activeMedRequests,
      healthChats: activeHealthChats,
      documents: pendingDocuments,
    },
    appointments: {
      latest: appointment,
      total: appointment ? 1 : 0,
      active: activeAppointments,
    },
    medRequests: {
      items: medicineReqs,
      total: medicineReqs.length,
      active: activeMedRequests,
    },
    healthChats: {
      items: chatItems,
      total: Number.isFinite(chatTotal) ? chatTotal : chatItems.length,
      active: activeHealthChats,
    },
    documents: {
      total: totalDocuments,
      recent: recentDocuments,
    },
    patientStatus: {
      credentials: options.credentialsStatus || 'Unknown',
      hasPendingUpdate: Boolean(updateTicket && ACTIVE_UPDATE_TICKET_STATUSES.has(updateTicket.status)),
    },
    // GraphQL compatibility payload for existing frontend callers.
    appointment,
    medicineReqs,
    updateTicket,
    chatData: {
      chats: chatItems,
      total: Number.isFinite(chatTotal) ? chatTotal : chatItems.length,
    },
  };
}

/**
 * Initialize the Dashboard GraphQL endpoint for medical staff
 * @param {Express.Application} app - Express application instance
 */
function initDashboardGraphQL(app) {
  app.use(
    '/dashboard',
    ipRateLimiter("genericLimiter", "staff"),
    jwtProtect('medical'),
    graphqlHTTP((req) => {
      if (!req.body || !req.body.query) {
        throw new Error('Empty GraphQL request');
      }
      return {
        schema: dashboardSchema,
        graphiql: process.env.NODE_ENV !== 'production',
        context: {
          user: req.user || null,
          res: req.res,
        },
      };
    })
  );
}

/**
 * Initialize the Dashboard GraphQL endpoint for patients
 * @param {Express.Application} app - Express application instance
 */
function initPatientDashboardGraphQL(app) {
  const patientDashboardRouter = express.Router();

  patientDashboardRouter.use(
    ipRateLimiter("genericLimiter", "patient"),
    jwtProtect('patient')
  );

  patientDashboardRouter.post('/', async (req, res, next) => {
    const hasGraphQLQuery = typeof req.body?.query === 'string' && req.body.query.trim().length > 0;
    if (hasGraphQLQuery) {
      return next();
    }

    try {
      const dashboardData = await dashboardResolver.Query.getPatientDashboardData(
        null,
        {},
        {
          user: req.user || null,
          res,
        }
      );

      const [
        credentialsResult,
        documentListResult,
        documentCountResult,
        pendingDocumentCountResult,
      ] = await Promise.all([
        db.query(
          `SELECT credentials_status
           FROM "UserCredentials"
           WHERE id = $1
           LIMIT 1`,
          [req.user.id]
        ),
        db.query(
          `SELECT pd.id::text AS id,
                  REPLACE(LOWER(dt.template), ' ', '-') AS "templateType",
                  pd."created_at"
           FROM "PatientDocuments" pd
           JOIN "documentTemplate" dt ON dt.id = pd."templateId"
           WHERE pd."patientId" = $1
           ORDER BY pd."created_at" DESC
           LIMIT 10`,
          [req.user.id]
        ),
        db.query(
          `SELECT COUNT(*)::int AS total
           FROM "PatientDocuments"
           WHERE "patientId" = $1`,
          [req.user.id]
        ),
        db.query(
          `SELECT COUNT(*)::int AS total
           FROM "patientRawDocument"
           WHERE "patientId" = $1
             AND status::text = 'Pending'`,
          [req.user.id]
        ),
      ]);

      const payload = buildPatientDashboardRestPayload(dashboardData, {
        credentialsStatus: credentialsResult.rows[0]?.credentials_status || 'Unknown',
        documents: documentListResult.rows || [],
        documentsTotal: documentCountResult.rows[0]?.total || 0,
        pendingDocuments: pendingDocumentCountResult.rows[0]?.total || 0,
      });

      return res.status(200).json(payload);
    } catch (error) {
      logger.error('Patient dashboard REST fallback failed', {
        userId: req.user?.id || null,
        error: error.message,
      });

      const statusCode = res.statusCode >= 400 ? res.statusCode : 500;
      return res.status(statusCode).json({
        success: false,
        error: 'DASHBOARD_FETCH_FAILED',
        message: error.message || 'Failed to fetch patient dashboard data.',
      });
    }
  });

  patientDashboardRouter.use(
    '/',
    graphqlHTTP((req) => {
      if (!req.body || !req.body.query) {
        throw new Error('Empty GraphQL request');
      }
      return {
        schema: dashboardSchema,
        graphiql: process.env.NODE_ENV !== 'production',
        context: {
          user: req.user || null,
          res: req.res,
        },
      };
    })
  );

  app.use('/dashboard/patient', patientDashboardRouter);
}

module.exports = { initDashboardGraphQL, initPatientDashboardGraphQL };
