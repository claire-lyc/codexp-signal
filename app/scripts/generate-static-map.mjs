import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const planningMap = JSON.parse(
  await readFile(resolve('src/data/singapore-planning-areas.json'), 'utf8'),
);
const roadMap = JSON.parse(
  await readFile(resolve('src/data/singapore-roads.json'), 'utf8'),
);
const outputDirectory = resolve('public/maps');

const regionFills = {
  'Central Region': '#fffdf4',
  'East Region': '#fffbea',
  'North Region': '#fdf8e5',
  'North-East Region': '#fff9e8',
  'West Region': '#fffbed',
};

function polygonPath(polygons) {
  return polygons
    .flatMap((polygon) =>
      polygon.map(
        (ring) =>
          `${ring.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join('')}Z`,
      ),
    )
    .join('');
}

function svgDocument(content, background = 'none') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${planningMap.width} ${planningMap.height}">
<rect width="${planningMap.width}" height="${planningMap.height}" fill="${background}"/>
${content}
</svg>
`;
}

const landPaths = planningMap.planningAreas
  .map(
    (area) =>
      `<path d="${polygonPath(area.polygons)}" fill="${regionFills[area.region] ?? '#fffdf4'}" fill-rule="evenodd" clip-rule="evenodd" stroke="#93a4b8" stroke-width="1.1" stroke-linejoin="round"/>`,
  )
  .join('\n');
const landClip = `<clipPath id="singapore-land">${planningMap.planningAreas
  .map(
    (area) =>
      `<path d="${polygonPath(area.polygons)}" fill-rule="evenodd" clip-rule="evenodd"/>`,
  )
  .join('')}</clipPath>`;

function roadLayer(paths) {
  return svgDocument(`${landClip}
<g clip-path="url(#singapore-land)">
${paths.join('\n')}
</g>`);
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(
    resolve(outputDirectory, 'singapore-base.svg'),
    svgDocument(landPaths, '#8bd5e8'),
    'utf8',
  ),
  writeFile(
    resolve(outputDirectory, 'singapore-roads-main.svg'),
    roadLayer([
      `<path d="${roadMap.paths.major}" fill="none" stroke="#899dbd" stroke-width="4.2"/>`,
      `<path d="${roadMap.paths.major}" fill="none" stroke="#f8fafc" stroke-width="2.35"/>`,
      `<path d="${roadMap.paths.expressway}" fill="none" stroke="#718aae" stroke-width="5.4"/>`,
      `<path d="${roadMap.paths.expressway}" fill="none" stroke="#f8d66d" stroke-width="3.1"/>`,
    ]),
    'utf8',
  ),
  writeFile(
    resolve(outputDirectory, 'singapore-roads-arterial.svg'),
    roadLayer([
      `<path d="${roadMap.paths.arterial}" fill="none" stroke="#9eacc4" stroke-width="3.2"/>`,
      `<path d="${roadMap.paths.arterial}" fill="none" stroke="#ffffff" stroke-width="1.8"/>`,
    ]),
    'utf8',
  ),
  writeFile(
    resolve(outputDirectory, 'singapore-roads-local.svg'),
    roadLayer([
      `<path d="${roadMap.paths.local}" fill="none" stroke="#c6d0df" stroke-width="2.2" opacity="0.9"/>`,
      `<path d="${roadMap.paths.local}" fill="none" stroke="#ffffff" stroke-width="1.15"/>`,
    ]),
    'utf8',
  ),
]);

console.log(`Generated static map layers in ${outputDirectory}`);
