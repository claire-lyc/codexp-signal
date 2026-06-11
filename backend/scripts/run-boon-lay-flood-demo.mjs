const baseUrl = (process.env.SIGNAL_API_BASE_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const username = process.env.SIGNAL_DEMO_GOV_USER ?? 'PUB';
const password = process.env.SIGNAL_DEMO_GOV_PASSWORD ?? 'PUB';
const reset = process.argv.includes('--append') ? false : true;
const clearOnly = process.argv.includes('--clear');

async function main() {
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: username, password }),
  });

  if (!loginResponse.ok) {
    const body = await safeJson(loginResponse);
    throw new Error(`Login failed (${loginResponse.status}): ${body?.error ?? loginResponse.statusText}`);
  }

  const login = await loginResponse.json();
  const token = login.tokens?.accessToken;
  if (!token) throw new Error('Login response did not include an access token.');

  const response = await fetch(`${baseUrl}/api/demo/boon-lay-flood/${clearOnly ? 'clear' : 'influx'}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: clearOnly ? undefined : JSON.stringify({ reset }),
  });

  const body = await safeJson(response);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Demo endpoint was not found on ${baseUrl}. Restart the backend so it loads the new /api/demo/boon-lay-flood/influx route, then run this command again.`,
      );
    }
    throw new Error(`Demo trigger failed (${response.status}): ${body?.error ?? response.statusText}`);
  }

  console.log(clearOnly ? 'Boon Lay flood demo data cleared.' : 'Boon Lay flood demo influx seeded.');
  console.log(`API: ${baseUrl}`);
  if (!clearOnly) {
    console.log(`Reports: ${(body.reportIds ?? []).join(', ') || 'none'}`);
    console.log(`Forum posts: ${(body.forumPostIds ?? []).join(', ') || 'none'}`);
  }
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
