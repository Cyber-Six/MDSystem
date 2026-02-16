function decodeSchedulingFlags(flags) {
  const daysMap = {
    1: "Monday",
    2: "Tuesday",
    4: "Wednesday",
    8: "Thursday",
    16: "Friday",
    32: "Saturday",
    64: "Sunday"
  };

  const result = [];
  for (const [bit, day] of Object.entries(daysMap)) {
    if (flags & bit) {
      result.push(day);
    }
  }
  return result;
}

function encodeSchedulingFlags(days) {
  const daysMap = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 4,
    Thursday: 8,
    Friday: 16,
    Saturday: 32,
    Sunday: 64
  };

  // Deduplicate and validate
  const uniqueDays = [...new Set(days)];
  const invalidDays = uniqueDays.filter(day => !daysMap[day]);

  if (invalidDays.length > 0) {
    return -1; // Invalid input
  }

  return uniqueDays.reduce((acc, day) => acc | daysMap[day], 0);
}

module.exports = {
  decodeSchedulingFlags,
  encodeSchedulingFlags
};