const db  = require("../../config/query.js");
const { throwGraphQLError } = require("../../utils/graphql-helper.js");
const logger = require("../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
const { get } = require("http");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

// creating of updateTicket
// In-progress do expire after nth time
// Unless if the user is unverified where the first ticket never expires

const UPDATE_TICKET_EXPIRY_SEC = parseInt(process.env.UPDATE_TICKET_EXPIRY_SEC, 10) || 604800; // default 7 days

const Query = {
  getUpdateTicket: async (_, {}, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await db.query(
       `SELECT log.id, log.status, log.created_at
        FROM "patientUpdateLog" AS log
        JOIN "Patients" AS p ON p.id = log."patientId"
        WHERE p.id = $1
        ORDER BY log.created_at DESC
        LIMIT 1;
        `,
      [user.id]
      );
     
    const ticket = result.rows[0];

    if (ticket && ticket.status.toLowerCase() === "in-progress") {
      const cutoff = Date.now() - UPDATE_TICKET_EXPIRY_SEC * 1000;
      const createdAt = new Date(ticket.created_at).getTime();

      if (createdAt >= cutoff || !(await db.isPatientValidated(user.id))) {
        return {id: ticket.id, status: "In-progress"}; 
        } // still valid until nth days or the first ticket

      await db.setExpiredUpdateTickets(ticket.id); // mark expired
      return {id: ticket.id, status: "Expired"};
    }

    return {id: ticket?.id, status: ticket?.status}; // return scalar ID
  },

  getProfile: async (_, args, {user, logId}) => {
    if (!user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    await db.query("", [user.id, logId]);
    // Example: return a student profile
    return { id: "1", program: "BSCS", year: "FIRST" };
  },
};

const Mutation = {
  createUpdateTicket: async (_, { scope }, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    if (record.status === "In-progress" || record.status === "Pending") {
      throwGraphQLError(res).message("An update ticket is already in progress.").status(400).throw();  
      }
    if (scope !== "Both"){
      const isverified = await db.isPatientValidated(user.id);
      if (!isverified){
        throwGraphQLError(res).message(
        "Creating update tickets for partial scopes is not allowed without an existing ticket.").status(400).throw();
        }
      }
    const result = await db.query(
    `INSERT INTO "patientUpdateLog" ("patientId", "status", "scope")
     VALUES ($1, 'In-progress', $2)
     RETURNING "id";
    `,
    [user.id, scope]
    );
    return result.rows[0].id;
  },

  createStudentProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);
    //console.log(args.input);

    let identity = await db.getUserIdentity(user.id);
    if (identity !== "Student") {
      throwGraphQLError(res)
        .status(400)
        .message("User identity mismatch. Only students can create student profiles.")
        .throw();
      }
    
    await db.query(
      `INSERT INTO "profileRecord" (id, profile_type) VALUES ($1, $2)
        ON CONFLICT (id) DO UPDATE SET profile_type = EXCLUDED.profile_type;`,
      [record.id, identity]
    );

    const result = await db.query(
      `INSERT INTO "student_profile" 
        (id, program, year, guardian_name, guardian_relation, guardian_contact)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE
         SET program = EXCLUDED.program,
             year = EXCLUDED.year,
             guardian_name = EXCLUDED.guardian_name,
             guardian_relation = EXCLUDED.guardian_relation,
             guardian_contact = EXCLUDED.guardian_contact
             RETURNING *;`,
      [
        record.id,
        args.input.program,
        args.input.year,
        args.input.guardian_name,
        args.input.guardian_relation,
        args.input.guardian_contact
      ]
    );

    //return result.rows[0];
    return {...(args.input), id: record.id, archived_at: null};
  },

  createEmployeeProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);
    //console.log(args.input);

    let identity = await db.getUserIdentity(user.id);
    if (identity !== "Employee") {
      throwGraphQLError(res)
        .status(400)
        .message("User identity mismatch. Only employees can create employee profiles.")
        .throw();
      }
    
    await db.query(
      `INSERT INTO "profileRecord" (id, profile_type) VALUES ($1, $2)
        ON CONFLICT (id) DO UPDATE SET profile_type = EXCLUDED.profile_type;`,
      [record.id, identity]
    );

    const result = await db.query(
      `INSERT INTO "employee_profile" 
        (id, department, role, position)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET department = EXCLUDED.department,
             role = EXCLUDED.role,
             position = EXCLUDED.position
             RETURNING *;`,
      [
        record.id,
        args.input.department,
        args.input.role,
        args.input.position
      ]
    );

    //return result.rows[0];
    return {...(args.input), id: record.id, archived_at: null};
  },

  createDentalHistory: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);
    console.log(args.input);

    const result = await db.query(
      `INSERT INTO "DentalHistory" 
        ("id","seenByDentist", "lastDentalCleaning", "purpose", "lastVisitDate")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
         SET "seenByDentist" = EXCLUDED."seenByDentist",
             "lastDentalCleaning" = EXCLUDED."lastDentalCleaning",
             "purpose" = EXCLUDED."purpose",
             "lastVisitDate" = EXCLUDED."lastVisitDate"
             RETURNING *;`,
      [
        record.id,
        args.input.seenByDentist,
        args.input.lastDentalCleaning,
        args.input.purpose,
        args.input.lastVisitDate
      ]
    );

    return {...(args.input), id: record.id, archived_at: null};
  }
};

const UserProfile = {
  __resolveType(obj) {
    if (obj.program) return "StudentProfile";
    if (obj.department) return "EmployeeProfile";
    return null;
  },
};

function assertActiveUpdateTicket(record, res) {
  if (record.status !== "In-progress") {
    if (record.status === "Pending") {
      throwGraphQLError(res)
        .status(400)
        .message("Your update ticket is still being processed. Please wait until it is completed.")
        .throw();
    }
    if (record.status === "Expired") {
      throwGraphQLError(res)
        .status(400)
        .message("Your update ticket has expired. Please create a new one.")
        .throw();
    }

    throwGraphQLError(res)
      .status(400)
      .message("No active update ticket found.")
      .throw();
  }
}


module.exports = { Query, Mutation, UserProfile };
