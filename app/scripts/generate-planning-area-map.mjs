import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const datasetId = 'd_4765db0e87b9c86336792efe8a1f7a66';
const endpoint = `https://api-open.data.gov.sg/v1/public/api/datasets/${datasetId}/poll-download`;
const outputPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/data/singapore-planning-areas.json',
);

const pollResponse = await fetch(endpoint);
if (!pollResponse.ok) throw new Error(`Dataset request failed: ${pollResponse.status}`);

const pollResult = await pollResponse.json();
if (pollResult.code !== 0) throw new Error(pollResult.errMsg || 'Dataset request failed');

const dataResponse = await fetch(pollResult.data.url);
if (!dataResponse.ok) throw new Error(`Dataset download failed: ${dataResponse.status}`);

const geojson = await dataResponse.json();
const features = geojson.features.filter((feature) => feature.geometry);

const allPoints = features.flatMap((feature) => flattenCoordinates(feature.geometry.coordinates));
const minLon = Math.min(...allPoints.map(([lon]) => lon));
const maxLon = Math.max(...allPoints.map(([lon]) => lon));
const minLat = Math.min(...allPoints.map(([, lat]) => lat));
const maxLat = Math.max(...allPoints.map(([, lat]) => lat));

const width = 1000;
const height = 610;
const padding = 28;

function flattenCoordinates(value) {
  if (typeof value[0] === 'number') return [value];
  return value.flatMap(flattenCoordinates);
}

function project([lon, lat]) {
  const x = padding + ((lon - minLon) / (maxLon - minLon)) * (width - padding * 2);
  const y = padding + ((maxLat - lat) / (maxLat - minLat)) * (height - padding * 2);
  return [round(x), round(y)];
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function distanceToSegment(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);

  const t = Math.max(
    0,
    Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy));
}

function simplify(points, tolerance = 0.9) {
  if (points.length <= 4) return points;

  let maxDistance = 0;
  let splitIndex = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = distanceToSegment(points[index], points[0], points.at(-1));
    if (distance > maxDistance) {
      splitIndex = index;
      maxDistance = distance;
    }
  }

  if (maxDistance <= tolerance) return [points[0], points.at(-1)];

  const left = simplify(points.slice(0, splitIndex + 1), tolerance);
  const right = simplify(points.slice(splitIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

function ringArea(points) {
  return Math.abs(
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2,
  );
}

function polygonCentroid(points) {
  let signedArea = 0;
  let x = 0;
  let y = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const [x0, y0] = points[index];
    const [x1, y1] = points[index + 1];
    const cross = x0 * y1 - x1 * y0;
    signedArea += cross;
    x += (x0 + x1) * cross;
    y += (y0 + y1) * cross;
  }

  if (Math.abs(signedArea) < 0.001) return points[0];
  return [round(x / (3 * signedArea)), round(y / (3 * signedArea))];
}

function geometryToPolygons(geometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

const planningAreas = features
  .map((feature) => {
    const polygons = geometryToPolygons(feature.geometry).map((polygon) =>
      polygon.map((ring) => simplify(ring.map(project))),
    );
    const outerRings = polygons.map(([outerRing]) => outerRing);
    const labelRing = outerRings.reduce((largest, ring) =>
      ringArea(ring) > ringArea(largest) ? ring : largest,
    );

    return {
      id: feature.properties.PLN_AREA_C.toLowerCase(),
      name: titleCase(feature.properties.PLN_AREA_N),
      region: titleCase(feature.properties.REGION_N),
      polygons,
      label: polygonCentroid(labelRing),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

function titleCase(value) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace('North-east', 'North-East');
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ width, height, planningAreas })}\n`);
console.log(`Generated ${planningAreas.length} planning areas at ${outputPath}`);
