import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputPaths = [
  path.resolve(scriptDir, '../../backend/data/dashboard-data.json'),
  path.resolve(scriptDir, '../src/data/dashboard-data.json'),
];

const sources = {
  rainfall: 'https://api-open.data.gov.sg/v2/real-time/api/rainfall',
  temperature: 'https://api-open.data.gov.sg/v2/real-time/api/air-temperature',
  wind: 'https://api-open.data.gov.sg/v2/real-time/api/wind-speed',
  psi: 'https://api-open.data.gov.sg/v2/real-time/api/psi',
  trafficImages: 'https://api.data.gov.sg/v1/transport/traffic-images',
  dengueClusters: 'd_dbfabf16158d1b0e1c420627c0819168',
  infectiousDiseases: 'd_ca168b2cb763640d72c4600a68f9909e',
  importPrices: 'https://tablebuilder.singstat.gov.sg/api/table/tabledata/M213341',
  retailSales: 'https://tablebuilder.singstat.gov.sg/api/table/tabledata/M602121',
};

async function getJson(url, attempt = 0) {
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'codexp-signal-data-refresh/1.0' },
    });
  } catch (error) {
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * 2 ** attempt));
      return getJson(url, attempt + 1);
    }
    throw new Error(`${url} failed after retries`, { cause: error });
  }
  if (response.status === 429 && attempt < 4) {
    await new Promise((resolve) => setTimeout(resolve, 1500 * 2 ** attempt));
    return getJson(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function latestReading(payload) {
  const reading = payload.data.readings.at(-1);
  const stations = new Map(payload.data.stations.map((station) => [station.id, station]));
  return {
    timestamp: reading.timestamp,
    unit: payload.data.readingUnit,
    stations: reading.data
      .map((item) => ({ ...stations.get(item.stationId), value: item.value }))
      .filter((item) => item.location),
  };
}

function rainfallTrend(payload) {
  return payload.data.readings
    .map((reading) => {
      const values = reading.data.map((item) => Number(item.value)).filter(Number.isFinite);
      const peak = values.length ? Math.max(...values) : 0;

      return {
        time: reading.timestamp,
        value: Number(peak.toFixed(1)),
      };
    })
    .filter((point) => Number.isFinite(point.value));
}

function psiTrend(payload) {
  return payload.data.items
    .map((item) => {
      const readings = item.readings?.psi_twenty_four_hourly ?? {};
      const values = Object.values(readings).map(Number).filter(Number.isFinite);
      const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

      return {
        time: item.timestamp,
        value: Math.round(average),
      };
    })
    .filter((point) => Number.isFinite(point.value));
}

function singaporeDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function featureCentroid(feature) {
  const points = feature.geometry.coordinates.flat(Infinity).filter((value) => typeof value === 'number');
  const coordinates = [];
  for (let index = 0; index < points.length; index += 2) coordinates.push([points[index], points[index + 1]]);
  return {
    longitude: coordinates.reduce((sum, point) => sum + point[0], 0) / coordinates.length,
    latitude: coordinates.reduce((sum, point) => sum + point[1], 0) / coordinates.length,
  };
}

function latestNumericColumn(row) {
  return [...row.columns].reverse().find((column) => Number.isFinite(Number(column.value)));
}

function selectSeries(table, seriesNumbers) {
  return table.Data.row
    .filter((row) => seriesNumbers.includes(row.seriesNo))
    .map((row) => {
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

const sgtDate = singaporeDate();
const [rainfall, rainfallDay, temperature, wind, psi, psiDay, trafficImages, denguePoll, diseaseTable, importPrices, retailSales] =
  await Promise.all([
    getJson(sources.rainfall),
    getJson(`${sources.rainfall}?date=${sgtDate}`),
    getJson(sources.temperature),
    getJson(sources.wind),
    getJson(sources.psi),
    getJson(`${sources.psi}?date=${sgtDate}`),
    getJson(sources.trafficImages),
    getJson(`https://api-open.data.gov.sg/v1/public/api/datasets/${sources.dengueClusters}/poll-download`),
    getJson(`https://data.gov.sg/api/action/datastore_search?resource_id=${sources.infectiousDiseases}&limit=25000`),
    getJson(sources.importPrices),
    getJson(sources.retailSales),
  ]);

const dengueGeoJson = await getJson(denguePoll.data.url);
const dengueClusters = dengueGeoJson.features.map((feature) => ({
  name: feature.properties.LOCALITY || feature.properties.NAME || 'Dengue cluster',
  cases: Number(feature.properties.CASE_SIZE || 0),
  homes: Number(feature.properties.HOMES || 0),
  publicPlaces: Number(feature.properties.PUBLIC_PLACES || 0),
  ...featureCentroid(feature),
}));

const dengueHistory = diseaseTable.result.records
  .filter((record) => record.disease === 'Dengue Fever')
  .sort((a, b) => a.epi_week.localeCompare(b.epi_week))
  .slice(-12)
  .map((record) => ({ period: record.epi_week, cases: Number(record['no._of_cases']) }));

const psiItem = psi.data.items.at(-1);
const trafficItem = trafficImages.items.at(-1);
const database = {
  generatedAt: new Date().toISOString(),
  health: {
    dengue: {
      timestamp: dengueGeoJson.features[0]?.properties?.FMEL_UPD_D || '2026-06-02',
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
    wind: latestReading(wind),
    psi: {
      timestamp: psiItem.timestamp,
      unit: 'PSI',
      regions: psi.data.regionMetadata.map((region) => ({
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
  infrastructure: {
    timestamp: trafficItem.timestamp,
    cameras: trafficItem.cameras.map((camera) => ({
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
  },
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

await Promise.all(
  outputPaths.map(async (outputPath) => {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(database)}\n`);
    console.log(`Wrote dashboard snapshot to ${outputPath}`);
  }),
);
