
const USER_STATUS = ["Student", "Employee", "Medical"];

function isUserStaff(status) {
  return status === "Medical";
}

module.exports = {
  USER_STATUS,
  isUserStaff,
};
