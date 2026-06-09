import { pool } from './db.js';

const sources = {
  rainfall: 'https://api-open.data.gov.sg/v2/real-time/api/rainfall',
  temperature: 'https://api-open.data.gov.sg/v2/real-time/api/air-temperature',
  wind: 'https://api-open.data.gov.sg/v2/real-time/api/wind-speed',
  windDirection: 'https://api-open.data.gov.sg/v2/real-time/api/wind-direction',
  psi: 'https://api-open.data.gov.sg/v2/real-time/api/psi',
  trafficImages: 'https://api.data.gov.sg/v1/transport/traffic-images',
  dengueClusters: 'd_dbfabf16158d1b0e1c420627c0819168',
  infectiousDiseases: 'd_ca168b2cb763640d72c4600a68f9909e',
  importPrices: 'https://tablebuilder.singstat.gov.sg/api/table/tabledata/M213341',
  retailSales: 'https://tablebuilder.singstat.gov.sg/api/table/tabledata/M602121',
};

let refreshTimer: NodeJS.Timeout | null = null;
let refreshInFlight: Promise<void> | null = null;

export async function refreshExternalDashboardSnapshot() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const snapshot = await buildExternalDashboardSnapshot();
    const capturedAt = String(snapshot.generatedAt);
    const sourceId = await upsertSource();

    await pool.query(
      `
        INSERT INTO dashboard.data_snapshots (source_id, crisis_type, snapshot_key, captured_at, payload)
        VALUES ($1, 'general', 'dashboard_cached_external', $2, $3)
        ON CONFLICT (source_id, snapshot_key, captured_at)
        DO UPDATE SET payload = EXCLUDED.payload
      `,
      [sourceId, capturedAt, snapshot],
    );

    console.log(`[dashboard] External dashboard snapshot refreshed ${capturedAt}`);
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export function startExternalDashboardRefresh() {
  const refreshMs = Number(process.env.DASHBOARD_EXTERNAL_REFRESH_MS ?? 5 * 60 * 1000);
  if (!Number.isFinite(refreshMs) || refreshMs <= 0 || refreshTimer) return;

  void refreshExternalDashboardSnapshot().catch((error) => {
    console.error('[dashboard] Initial external dashboard refresh failed:', error);
  });

  refreshTimer = setInterval(() => {
    void refreshExternalDashboardSnapshot().catch((error) => {
      console.error('[dashboard] Scheduled external dashboard refresh failed:', error);
    });
  }, refreshMs);
}

export async function fetchLiveTrafficCameraSnapshot() {
  const trafficImages = await getJson<any>(sources.trafficImages, 0, true);
  return trafficCameraSnapshot(trafficImages);
}

export async function fetchNeaRainRadarFrames() {
  const timestamp = Math.floor(Date.now() / 300_000) * 300;
  const frames = await getJson<Array<{ Url: string; DateTime: string; SortingTime: string }>>(
    `https://www.nea.gov.sg/api/RainArea/GetRecentData/${timestamp}`,
  );

  return {
    frames: frames.map((frame) => ({
      url: new URL(frame.Url, 'https://www.nea.gov.sg').toString(),
      label: frame.DateTime,
      timestamp: frame.SortingTime,
    })),
    basemapUrl: 'https://www.nea.gov.sg/assets/images/map/base-853.png',
    legendUrl: 'https://www.nea.gov.sg/assets/images/temp/rain-legend.jpg',
    sourceUrl: 'https://www.nea.gov.sg/weather/rain-areas',
  };
}

export async function fetchNeaHazeLayers() {
  const pageUrl = 'https://www.nea.gov.sg/corporate-functions/weather/regional-haze-situation';
  const response = await fetch(pageUrl, {
    headers: { Accept: 'text/html', 'User-Agent': 'codexp-signal-data-refresh/1.0' },
  });
  if (!response.ok) throw new Error(`${pageUrl} returned ${response.status}`);
  const html = await response.text();
  const satellitePath = html.match(/\/docs\/default-source\/mtsat_ir_haze\/[^"'?]+\.png/i)?.[0];
  const windPath = html.match(/\/docs\/default-source\/haze_wind\/[^"'?]+\.png/i)?.[0];

  if (!satellitePath) throw new Error('NEA haze satellite image was not found');

  return {
    satelliteUrl: new URL(satellitePath, 'https://www.nea.gov.sg').toString(),
    windUrl: windPath ? new URL(windPath, 'https://www.nea.gov.sg').toString() : null,
    basemapUrl: 'https://www.nea.gov.sg/assets/images/canvas.png',
    sourceUrl: pageUrl,
  };
}

async function buildExternalDashboardSnapshot() {
  const sgtDate = singaporeDate();
  const [rainfall, rainfallDay, temperature, wind, windDirection, psi, psiDay, trafficImages, denguePoll, diseaseTable, importPrices, retailSales] =
    await Promise.all([
      getJson<any>(sources.rainfall),
      getJson<any>(`${sources.rainfall}?date=${sgtDate}`),
      getJson<any>(sources.temperature),
      getJson<any>(sources.wind),
      getJson<any>(sources.windDirection),
      getJson<any>(sources.psi),
      getJson<any>(`${sources.psi}?date=${sgtDate}`),
      getJson<any>(sources.trafficImages),
      getJson<any>(`https://api-open.data.gov.sg/v1/public/api/datasets/${sources.dengueClusters}/poll-download`),
      getJson<any>(`https://data.gov.sg/api/action/datastore_search?resource_id=${sources.infectiousDiseases}&limit=25000`),
      getJson<any>(sources.importPrices),
      getJson<any>(sources.retailSales),
    ]);

  const dengueGeoJson = await getJson<any>(denguePoll.data.url);
  const dengueClusters = dengueGeoJson.features.map((feature: any) => ({
    name: feature.properties.LOCALITY || feature.properties.NAME || 'Dengue cluster',
    cases: Number(feature.properties.CASE_SIZE || 0),
    homes: Number(feature.properties.HOMES || 0),
    publicPlaces: Number(feature.properties.PUBLIC_PLACES || 0),
    ...featureCentroid(feature),
  }));

  const dengueHistory = diseaseTable.result.records
    .filter((record: any) => record.disease === 'Dengue Fever')
    .sort((a: any, b: any) => a.epi_week.localeCompare(b.epi_week))
    .slice(-12)
    .map((record: any) => ({ period: record.epi_week, cases: Number(record['no._of_cases']) }));

  const psiItem = psi.data.items.at(-1);
  return {
    generatedAt: new Date().toISOString(),
    health: {
      dengue: {
        timestamp: dengueGeoJson.features[0]?.properties?.FMEL_UPD_D || new Date().toISOString(),
        clusters: dengueClusters,
        history: dengueHistory,
        source: {
          agency: 'National Environment Agency / Ministry of Health',
          label: 'NEA Dengue Clusters and MOH Weekly Infectious Disease Bulletin',
          url: 'https://data.gov.sg/datasets/d_dbfabf16158d1b0e1c420627c0819168/view',
        },
      },
    },
    weather: {
      rainfall: {
        ...latestReading(rainfall),
        trend: rainfallTrend(rainfallDay),
      },
      temperature: latestReading(temperature),
      wind: latestWindReading(wind, windDirection),
      psi: {
        timestamp: psiItem.timestamp,
        unit: 'PSI',
        regions: psi.data.regionMetadata.map((region: any) => ({
          ...region,
          value: psiItem.readings.psi_twenty_four_hourly[region.name],
        })),
        trend: psiTrend(psiDay),
      },
      source: {
        agency: 'National Environment Agency',
        label: 'data.gov.sg real-time weather readings',
        url: 'https://data.gov.sg/collections/1459/view',
      },
    },
    infrastructure: trafficCameraSnapshot(trafficImages),
    supply: {
      updatedAt: importPrices.Data.dataLastUpdated,
      importPrices: selectSeries(importPrices, ['1.0', '1.3', '1.5']),
      retailSales: selectSeries(retailSales, ['1.2', '1.7']),
      nodes: [
        { name: 'Tuas Port', latitude: 1.252, longitude: 103.625, role: 'Sea freight gateway' },
        { name: 'Jurong Logistics Hub', latitude: 1.332, longitude: 103.708, role: 'Industrial distribution' },
        { name: 'Woodlands Checkpoint', latitude: 1.445, longitude: 103.769, role: 'Land freight gateway' },
        { name: 'Changi Airfreight Centre', latitude: 1.352, longitude: 103.994, role: 'Air cargo gateway' },
        { name: 'Pasir Panjang Terminal', latitude: 1.276, longitude: 103.784, role: 'Container terminal' },
      ],
      source: {
        agency: 'Singapore Department of Statistics',
        label: 'SingStat import prices and retail sales indices',
        url: 'https://tablebuilder.singstat.gov.sg/',
      },
    },
  };
}

function latestWindReading(speedPayload: any, directionPayload: any) {
  const speed = latestReading(speedPayload);
  const directionReading = directionPayload.data.readings.at(-1);
  const directions = new Map(
    directionReading.data.map((item: any) => [item.stationId, Number(item.value)]),
  );

  return {
    ...speed,
    stations: speed.stations.map((station: any) => ({
      ...station,
      direction: directions.get(station.id) ?? null,
    })),
  };
}

function trafficCameraSnapshot(payload: any) {
  const item = payload.items?.at(-1);
  if (!item || !Array.isArray(item.cameras)) {
    throw new Error('Traffic camera feed returned no camera snapshots');
  }

  return {
    timestamp: item.timestamp,
    cameras: item.cameras.map((camera: any) => ({
      id: String(camera.camera_id),
      timestamp: camera.timestamp,
      latitude: camera.location.latitude,
      longitude: camera.location.longitude,
      image: camera.image,
      width: camera.image_metadata.width,
      height: camera.image_metadata.height,
    })),
    source: {
      agency: 'Land Transport Authority',
      label: 'data.gov.sg Traffic Images',
      url: sources.trafficImages,
    },
  };
}

async function getJson<T>(url: string, attempt = 0, bypassCache = false): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: bypassCache ? 'no-store' : 'default',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'codexp-signal-data-refresh/1.0',
        ...(bypassCache ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : {}),
      },
    });
  } catch (error) {
    if (attempt < 4) {
      await delay(1500 * 2 ** attempt);
      return getJson<T>(url, attempt + 1, bypassCache);
    }
    throw new Error(`${url} failed after retries`, { cause: error });
  }

  if (response.status === 429 && attempt < 4) {
    await delay(1500 * 2 ** attempt);
    return getJson<T>(url, attempt + 1, bypassCache);
  }
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json() as Promise<T>;
}

function latestReading(payload: any) {
  const reading = payload.data.readings.at(-1);
  const stations = new Map<string, Record<string, unknown>>(
    payload.data.stations.map((station: any) => [station.id, station]),
  );
  return {
    timestamp: reading.timestamp,
    unit: payload.data.readingUnit,
    stations: reading.data
      .map((item: any) => ({ ...(stations.get(item.stationId) ?? {}), value: item.value }))
      .filter((item: any) => item.location),
  };
}

function rainfallTrend(payload: any) {
  return payload.data.readings
    .map((reading: any) => {
      const values = reading.data.map((item: any) => Number(item.value)).filter(Number.isFinite);
      const peak = values.length ? Math.max(...values) : 0;

      return {
        time: reading.timestamp,
        value: Number(peak.toFixed(1)),
      };
    })
    .filter((point: any) => Number.isFinite(point.value));
}

function psiTrend(payload: any) {
  return payload.data.items
    .map((item: any) => {
      const readings = item.readings?.psi_twenty_four_hourly ?? {};
      const values = Object.values(readings).map(Number).filter(Number.isFinite);
      const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

      return {
        time: item.timestamp,
        value: Math.round(average),
      };
    })
    .filter((point: any) => Number.isFinite(point.value));
}

function singaporeDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function featureCentroid(feature: any) {
  const points = feature.geometry.coordinates.flat(Infinity).filter((value: unknown) => typeof value === 'number');
  const coordinates: number[][] = [];
  for (let index = 0; index < points.length; index += 2) coordinates.push([points[index], points[index + 1]]);
  return {
    longitude: coordinates.reduce((sum, point) => sum + point[0], 0) / coordinates.length,
    latitude: coordinates.reduce((sum, point) => sum + point[1], 0) / coordinates.length,
  };
}

function latestNumericColumn(row: any) {
  return [...row.columns].reverse().find((column: any) => Number.isFinite(Number(column.value)));
}

function selectSeries(table: any, seriesNumbers: string[]) {
  return table.Data.row
    .filter((row: any) => seriesNumbers.includes(row.seriesNo))
    .map((row: any) => {
      const latest = latestNumericColumn(row);
      return {
        id: row.seriesNo,
        name: row.rowText,
        unit: row.uoM,
        period: latest.key,
        value: Number(latest.value),
      };
    });
}

async function upsertSource() {
  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO dashboard.data_sources (code, name, agency, source_kind, url, refresh_interval_seconds)
      VALUES ('cached_external_dashboard_json', 'Cached external dashboard APIs', 'data.gov.sg / SingStat', 'official_api', NULL, $1)
      ON CONFLICT (code)
      DO UPDATE SET
        name = EXCLUDED.name,
        agency = EXCLUDED.agency,
        source_kind = EXCLUDED.source_kind,
        refresh_interval_seconds = EXCLUDED.refresh_interval_seconds
      RETURNING id
    `,
    [Math.round(Number(process.env.DASHBOARD_EXTERNAL_REFRESH_MS ?? 5 * 60 * 1000) / 1000)],
  );

  return result.rows[0].id;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
