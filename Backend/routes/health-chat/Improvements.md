Backend Improvements:

Improvement: please make this self sufficient, non background process requirement.

on healthcaht/resolvers/wrapper/wrapper.js

expireOldTickets: async (, __, { user, res }) => {
if (!user) {
throwGraphQLError(res).message("Unauthorized").status(401).throw();
}

// Update all ongoing chats that have expired
const result = await db.query(
  `UPDATE "HealthChat"
   SET status = 'Expired', session_end = NOW()
   WHERE status = 'Ongoing'
   AND session_start IS NOT NULL
   AND session_start + INTERVAL '${CHAT_EXPIRY_DAYS} days' < NOW()
   RETURNING id`
);

// Add system message to each expired chat
for (const row of result.rows) {
  await db.query(
    `INSERT INTO "HealthChatPrompt"
     ("consultationVirtualId", "text", "promptType", "userId", "userType")
     VALUES ($1, 'This conversation has expired after ${CHAT_EXPIRY_DAYS} days.', 'system', $2, 'Medical')`,
    [row.id, user.id]
  );
}

return result.rowCount;
}

