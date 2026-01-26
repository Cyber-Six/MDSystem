const path = require("path");
const dotenv = require("dotenv");
const Mutation = require("./mutation.js");
const Query = require("./query.js");

dotenv.config({ path: path.resolve(__dirname, "../../env") });

// creating of updateTicket
// In-progress do expire after nth time
// Unless if the user is unverified where the first ticket never expires


const UserProfile = {
  __resolveType(obj) {
    if (obj.program) return "StudentProfile";
    if (obj.department) return "EmployeeProfile";
    return null;
  },
};



module.exports = { Query, Mutation, UserProfile };
