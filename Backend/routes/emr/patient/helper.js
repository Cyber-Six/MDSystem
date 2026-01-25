const db  = require("../../../config/query.js");

const { throwGraphQLError } = require("../../../utils/graphql-helper.js");

function assertActiveUpdateTicket(record, res, allowedScope = "Both") {
  if (record.status !== "Inprogress") {
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

  // Check scope
  const scope = record.scope; // e.g. "Dental" or "Medical"
  const allowed = allowedScope;

  if (allowed === "Both") {
    // Both scopes are allowed, nothing to check
    return;
  }

  if (scope !== allowed) {
    throwGraphQLError(res)
      .status(403)
      .message(`This update ticket is for ${scope}, but ${allowed} scope is required.`)
      .throw();
  }
}



module.exports = { assertActiveUpdateTicket };