let cachedToken = null; //"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYmYiOjE3NzE5OTg5MTcsImV4cCI6MTc3MjAwMjUxNywiaXNzIjoiaHR0cHM6Ly9pY2RhY2Nlc3NtYW5hZ2VtZW50Lndoby5pbnQiLCJhdWQiOlsiaHR0cHM6Ly9pY2RhY2Nlc3NtYW5hZ2VtZW50Lndoby5pbnQvcmVzb3VyY2VzIiwiaWNkYXBpIl0sImNsaWVudF9pZCI6IjFiYzhkODRkLTliYTYtNDc5OC04OTYyLWY1NjBhODM0N2Y5YV9iMWU0NTAwYi0yOGM2LTQ5NmMtOWU1Zi1jZjIxMTViMTdkMzMiLCJzY29wZSI6WyJpY2RhcGlfYWNjZXNzIl19.g1PT84sT7Cd0117aJEe-JTtDXawC1mm__ckOvdfs7fg3bGvuR3WR53IA3RSfBUKbwjU0zykqY3fqoiePKxdz6gSh7y-taOXSDWNycjyi9mcA9mw69WlUfHccpLBeJ9jT0aOxlTmaYBkfadNy8D4rXbVUnRi_xBNuz1jFaOx-yE0E53D1Lj4t84yscz40nVo8CHzeuwH-AyIwYcfV-8KQNLm6gbDz6RQxCj_pzHbye1UWRQs1GGAUPO4rKwUYJG_93uF25dVFq5HXLoH1sZYCMlkKKtr498wnXxcqB9IF_zgbNQt8tiVMD7kgi2NFL6XOfBNHjtiFPdeQQ_RLNAPDEQ";

async function fetchAccessToken() {
  const res = await fetch("https://icdaccessmanagement.who.int/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      scope: "icdapi_access"
    })
  });
  const data = await res.json();
  cachedToken = data.access_token;
  return cachedToken;
}

async function getAccessToken() {
  if (!cachedToken) {
    return await fetchAccessToken();
  }
  else console.log(`Using cached ICD API token`);
  return cachedToken;
}

module.exports = { getAccessToken, fetchAccessToken };