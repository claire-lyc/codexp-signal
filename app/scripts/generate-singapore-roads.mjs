import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const planningMap = JSON.parse(await readFile(resolve('src/data/singapore-planning-areas.json'), 'utf8'));
const bounds = {
  south: 1.1586987006322145,
  west: 103.60570070513404,
  north: 1.4707748320860872,
  east: 104.08848306516335,
};

const endpoints = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];
const sections = makeSections(bounds, 3, 2);
const elementsById = new Map();

for (const [index, section] of sections.entries()) {
  const payload = await fetchSection(section);
  for (const element of payload.elements) {
    if (element.type === 'way') elementsById.set(element.id, element);
  }
  console.log(`Downloaded road section ${index + 1}/${sections.length}.`);
}

const roads = [...elementsById.values()]
  .filter((element) => element.type === 'way' && Array.isArray(element.geometry) && element.geometry.length > 1)
  .map((element) => ({
    id: String(element.id),
    class: roadClass(element.tags?.highway),
    name: element.tags?.name ?? '',
    points: simplify(
      element.geometry.map(({ lat, lon }) => [
        round(lon),
        round(lat),
      ]),
      toleranceFor(element.tags?.highway),
    ),
  }))
  .filter((road) => road.points.length > 1 && roadTouchesSingapore(road));

const paths = {
  expressway: '',
  major: '',
  arterial: '',
  local: '',
};

for (const road of roads) {
  if (road.class === 'local' && !road.name) continue;
  const projected = road.points.map(([longitude, latitude]) => project(latitude, longitude));
  paths[road.class] += projected
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${compact(x)},${compact(y)}`)
    .join('');
}

const output = {
  generatedAt: new Date().toISOString(),
  source: 'OpenStreetMap contributors',
  license: 'ODbL',
  roadCount: roads.length,
  paths,
};

await writeFile(
  resolve('src/data/singapore-roads.json'),
  `${JSON.stringify(output)}\n`,
  'utf8',
);

console.log(`Saved ${roads.length} Singapore roads.`);

async function fetchSection(section) {
  const query = `
[out:json][timeout:60];
way
  ["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified)$"]
  (${section.south},${section.west},${section.north},${section.east});
out tags geom;
`;
  let lastError;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'SiGnal-Crisis-Map/1.0',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(75_000),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Road section download failed: ${lastError}`);
}

function makeSections(source, columns, rows) {
  const width = (source.east - source.west) / columns;
  const height = (source.north - source.south) / rows;
  const sections = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      sections.push({
        south: source.south + row * height,
        north: source.south + (row + 1) * height,
        west: source.west + column * width,
        east: source.west + (column + 1) * width,
      });
    }
  }

  return sections;
}

function roadClass(highway = '') {
  if (highway.startsWith('motorway') || highway.startsWith('trunk')) return 'expressway';
  if (highway.startsWith('primary') || highway.startsWith('secondary')) return 'major';
  if (highway.startsWith('tertiary')) return 'arterial';
  return 'local';
}

function roadTouchesSingapore(road) {
  return road.points.some(([longitude, latitude]) => {
    const projected = project(latitude, longitude);
    return planningMap.planningAreas.some((area) => pointInArea(projected, area.polygons));
  });
}

function project(latitude, longitude) {
  const { minLon, maxLon, minLat, maxLat, padding } = planningMap.geoBounds;
  return [
    padding + ((longitude - minLon) / (maxLon - minLon)) * (planningMap.width - padding * 2),
    padding + ((maxLat - latitude) / (maxLat - minLat)) * (planningMap.height - padding * 2),
  ];
}

function compact(value) {
  return Number(value.toFixed(1));
}

function pointInArea(point, polygons) {
  return polygons.some(([outerRing, ...holes]) => {
    if (!outerRing || !pointInRing(point, outerRing)) return false;
    return !holes.some((hole) => pointInRing(point, hole));
  });
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentX, currentY] = ring[index];
    const [previousX, previousY] = ring[previous];
    const crosses = currentY > y !== previousY > y
      && x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;
    if (crosses) inside = !inside;
  }
  return inside;
}

function toleranceFor(highway = '') {
  if (highway.startsWith('motorway') || highway.startsWith('trunk')) return 0.000025;
  if (highway.startsWith('primary') || highway.startsWith('secondary')) return 0.000035;
  if (highway.startsWith('tertiary')) return 0.000045;
  return 0.000065;
}

function round(value) {
  return Number(value.toFixed(6));
}

function simplify(points, tolerance) {
  if (points.length <= 2) return points;
  const squareTolerance = tolerance * tolerance;
  const simplified = [points[0]];
  simplifySection(points, 0, points.length - 1, squareTolerance, simplified);
  simplified.push(points[points.length - 1]);
  return simplified;
}

function simplifySection(points, first, last, squareTolerance, output) {
  let maxSquareDistance = squareTolerance;
  let index = 0;

  for (let current = first + 1; current < last; current += 1) {
    const squareDistance = segmentSquareDistance(points[current], points[first], points[last]);
    if (squareDistance > maxSquareDistance) {
      index = current;
      maxSquareDistance = squareDistance;
    }
  }

  if (maxSquareDistance <= squareTolerance) return;
  if (index - first > 1) simplifySection(points, first, index, squareTolerance, output);
  output.push(points[index]);
  if (last - index > 1) simplifySection(points, index, last, squareTolerance, output);
}

function segmentSquareDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;

  if (dx !== 0 || dy !== 0) {
    const ratio = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (ratio > 1) {
      x = end[0];
      y = end[1];
    } else if (ratio > 0) {
      x += dx * ratio;
      y += dy * ratio;
    }
  }

  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}
