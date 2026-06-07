import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import {
  getLatestMapLayer,
  getLatestSnapshot,
  listAlerts,
  listCrises,
} from './dashboardRepository.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }));
app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.get(['/api/gov/crises', '/api/crises'], async (request, response, next) => {
  try {
    const items = await listCrises({
      status: stringParam(request.query.status),
      crisisType: stringParam(request.query.crisisType),
    });
    response.json({ items });
  } catch (error) {
    next(error);
  }
});

app.get(['/api/gov/alerts', '/api/alerts', '/api/citizen/alerts'], async (request, response, next) => {
  try {
    const items = await listAlerts({
      status: stringParam(request.query.status) ?? 'active',
      crisisType: stringParam(request.query.type) ?? stringParam(request.query.crisisType),
      region: stringParam(request.query.region),
    });
    response.json({ items });
  } catch (error) {
    next(error);
  }
});

app.get('/api/gov/overview', async (_request, response, next) => {
  try {
    const [crises, alerts, overview] = await Promise.all([
      listCrises({ status: 'active' }),
      listAlerts({ status: 'active' }),
      getLatestSnapshot('dashboard_overview'),
    ]);

    response.json({ crises, alerts, overview });
  } catch (error) {
    next(error);
  }
});

app.get(['/api/gov/cybersecurity', '/api/cybersecurity'], async (_request, response, next) => {
  try {
    response.json(await getSnapshotResponse('dashboard_cybersecurity'));
  } catch (error) {
    next(error);
  }
});

app.get(['/api/citizen/home', '/api/public/home'], async (_request, response, next) => {
  try {
    response.json(await getSnapshotResponse('dashboard_public_home'));
  } catch (error) {
    next(error);
  }
});

app.get(['/api/citizen/incidents', '/api/public/incidents'], async (_request, response, next) => {
  try {
    response.json(await getSnapshotResponse('dashboard_public_incidents'));
  } catch (error) {
    next(error);
  }
});

app.get('/api/dashboard/cached-external', async (_request, response, next) => {
  try {
    response.json(await getSnapshotResponse('dashboard_cached_external'));
  } catch (error) {
    next(error);
  }
});

app.get(['/api/gov/recommendations', '/api/recommendations'], async (request, response, next) => {
  try {
    const payload = await getLatestSnapshot<{ items: Record<string, unknown>[] }>('dashboard_recommendations');
    const crisisType = stringParam(request.query.crisisType);
    const items = payload?.items ?? [];
    response.json({
      items: crisisType
        ? items.filter((item) => String(item.category ?? '').toLowerCase() === crisisType.toLowerCase())
        : items,
    });
  } catch (error) {
    next(error);
  }
});

app.get(['/api/gov/sentiment', '/api/sentiment'], async (_request, response, next) => {
  try {
    response.json(await getSnapshotResponse('dashboard_sentiment'));
  } catch (error) {
    next(error);
  }
});

app.get(['/api/gov/historical', '/api/historical'], async (_request, response, next) => {
  try {
    response.json(await getSnapshotResponse('dashboard_historical'));
  } catch (error) {
    next(error);
  }
});

app.get(['/api/gov/heatmap', '/api/heatmap'], async (request, response, next) => {
  try {
    const layer = stringParam(request.query.layer) ?? 'crises';
    const mapLayer = await getLatestMapLayer(layer);
    response.json(
      mapLayer
        ? { layer: mapLayer.layer_key, title: mapLayer.title, ...asObject(mapLayer.payload), generatedAt: mapLayer.generated_at }
        : { layer, markers: [], generatedAt: new Date().toISOString() },
    );
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`SiGnal backend listening on http://localhost:${port}`);
});

function stringParam(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

async function getSnapshotResponse(snapshotKey: string) {
  const payload = await getLatestSnapshot(snapshotKey);
  return payload ?? { items: [] };
}

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
