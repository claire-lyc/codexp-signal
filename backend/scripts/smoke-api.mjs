const baseUrl = (process.env.API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const citizenLogin = {
  email: process.env.SMOKE_CITIZEN_USER ?? 'user',
  password: process.env.SMOKE_CITIZEN_PASSWORD ?? 'user',
};
const adminLogin = {
  email: process.env.SMOKE_ADMIN_USER ?? process.env.DEMO_ADMIN_EMAIL ?? 'admin@signal.local',
  password: process.env.SMOKE_ADMIN_PASSWORD ?? process.env.DEMO_ADMIN_PASSWORD ?? 'ChangeMe123!',
};
const smokeRunId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const results = [];

async function main() {
  console.log(`Smoke testing API at ${baseUrl}`);

  await check('health', 'GET', '/health');
  await check('forum list', 'GET', '/api/forum/posts');
  await check('citizen alerts', 'GET', '/api/citizen/alerts');
  await check('citizen broadcasts', 'GET', '/api/citizen/broadcasts');
  await check('citizen home', 'GET', '/api/citizen/home');
  await check('citizen incidents', 'GET', '/api/citizen/incidents');

  const citizenToken = await login('citizen login', citizenLogin);
  const adminToken = await login('admin login', adminLogin);

  if (citizenToken) {
    await check('auth me citizen', 'GET', '/api/auth/me', { token: citizenToken });
    await check('auth profile citizen', 'GET', '/api/auth/profile', { token: citizenToken });
    await check('notifications citizen', 'GET', '/api/notifications', { token: citizenToken });
    await check('volunteer profile citizen', 'GET', '/api/volunteers/profile', { token: citizenToken });
    await check('report subject tags citizen', 'GET', '/api/report-subject-tags', { token: citizenToken });
    await check('citizen reports', 'GET', '/api/citizen/reports', { token: citizenToken });
    await check('assistant citizen', 'POST', '/api/citizen/assistant', {
      token: citizenToken,
      body: { messages: [{ role: 'user', content: 'How do I submit a report?' }] },
    });
  }

  const temporaryPostId = await createForumPost();
  if (temporaryPostId) {
    await check('forum like', 'POST', `/api/forum/posts/${temporaryPostId}/like`, { body: {} });
    await check('forum report', 'POST', `/api/forum/posts/${temporaryPostId}/report`, { body: {} });
    await check('forum reply', 'POST', `/api/forum/posts/${temporaryPostId}/replies`, {
      body: { author: 'Smoke Test', content: 'Smoke test reply.' },
    });
  }

  if (adminToken) {
    await check('auth me admin', 'GET', '/api/auth/me', { token: adminToken });
    await check('auth profile admin', 'GET', '/api/auth/profile', { token: adminToken });
    await check('notifications admin', 'GET', '/api/notifications', { token: adminToken });
    await check('gov crises', 'GET', '/api/gov/crises', { token: adminToken });
    await check('gov alerts', 'GET', '/api/gov/alerts', { token: adminToken });
    await check('broadcasts admin', 'GET', '/api/broadcasts', { token: adminToken });
    await check('gov overview', 'GET', '/api/gov/overview', { token: adminToken });
    await check('gov cybersecurity', 'GET', '/api/gov/cybersecurity', { token: adminToken });
    await check('dashboard cached external', 'GET', '/api/dashboard/cached-external', { token: adminToken });
    await check('gov cameras live', 'GET', '/api/gov/infrastructure/cameras/live', { token: adminToken });
    await check('gov rain radar', 'GET', '/api/gov/weather/rain-radar', { token: adminToken });
    await check('gov haze layers', 'GET', '/api/gov/weather/haze-layers', { token: adminToken });
    await check('gov recommendations', 'GET', '/api/gov/recommendations', { token: adminToken });
    await check('gov sentiment', 'GET', '/api/gov/sentiment', { token: adminToken });
    await check('gov historical', 'GET', '/api/gov/historical', { token: adminToken });
    await check('gov heatmap', 'GET', '/api/gov/heatmap', { token: adminToken });
    await check('tickets admin', 'GET', '/api/tickets', { token: adminToken });
    await check('forum moderation admin', 'GET', '/api/forum/posts/moderation', { token: adminToken });
    await check('gov volunteer profiles', 'GET', '/api/gov/volunteers/profiles', { token: adminToken });
  }

  printSummary();
}

async function login(name, credentials) {
  const result = await check(name, 'POST', '/api/auth/login', { body: credentials });
  return result?.json?.tokens?.accessToken ?? null;
}

async function createForumPost() {
  const result = await check('forum create temporary post', 'POST', '/api/forum/posts', {
    body: {
      author: `Smoke Test ${smokeRunId}`,
      category: 'Community',
      content: `Smoke test post ${new Date().toISOString()}`,
    },
  });
  return result?.json?.item?.id ?? null;
}

async function check(name, method, path, options = {}) {
  const started = Date.now();
  const headers = new Headers(options.headers ?? {});
  if (options.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    const json = parseJson(text);
    const ok = response.status >= 200 && response.status < 300;
    const result = {
      name,
      method,
      path,
      status: response.status,
      ok,
      ms: Date.now() - started,
      json,
      text: text.slice(0, 180),
    };
    results.push(result);
    logResult(result);
    return result;
  } catch (error) {
    const result = {
      name,
      method,
      path,
      status: 0,
      ok: false,
      ms: Date.now() - started,
      text: error instanceof Error ? error.message : String(error),
    };
    results.push(result);
    logResult(result);
    return result;
  }
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function logResult(result) {
  const marker = result.ok ? 'PASS' : 'FAIL';
  const status = result.status || 'ERR';
  console.log(`${marker.padEnd(4)} ${String(status).padEnd(3)} ${String(result.ms).padStart(5)}ms ${result.method.padEnd(6)} ${result.path} - ${result.name}`);
  if (!result.ok && result.text) console.log(`     ${result.text}`);
}

function printSummary() {
  const failed = results.filter((result) => !result.ok);
  const passed = results.length - failed.length;
  console.log('');
  console.log(`Summary: ${passed}/${results.length} passed`);
  if (failed.length) {
    console.log('Failed checks:');
    failed.forEach((result) => {
      console.log(`- ${result.method} ${result.path} (${result.status || 'ERR'}) ${result.name}`);
    });
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
