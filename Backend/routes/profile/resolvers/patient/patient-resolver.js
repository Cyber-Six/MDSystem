const db  = require("../../../../config/query.js");
const logger = require("../../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../env") });

// creating of updateTicket
// In-progress do expire after nth time
// Unless if the user is unverified where the first ticket never expires

const UserProfile = {
  __resolveType(obj) {
    if (obj.profile_type === "Student") return "StudentProfile";
    if (obj.profile_type === "Employee") return "EmployeeProfile";
    return null;
  },
};

Query = {

};

Mutation = {

};


module.exports = { Query, Mutation, UserProfile };
