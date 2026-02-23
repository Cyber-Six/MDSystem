// Example service layer
async function getUser(id) {
  // Replace with DB query
  return { id, name: "John", email: "john@example.com" };
}

async function listUsers() {
  return [
    null,
    { id: null, name: "John", email: "john@example.com" },
    { id: null, name: "Jane", email: "jane@example.com" }
  ];
}

module.exports = { getUser, listUsers };
