import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import mapData from '../../data/singapore-planning-areas.json';

type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
type Point = [number, number];

export type HeatmapPalette = 'temperature' | 'rainfall' | 'wind' | 'psi';

export type MapHeatPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  value: number;
  direction?: number | null;
};

export type MapHeatmapLayer = {
  label: string;
  unit: string;
  palette: HeatmapPalette;
  points: MapHeatPoint[];
  min?: number;
  max?: number;
  radius?: number;
  opacity?: number;
  cellSize?: number;
  legendLabel?: string;
  currentValue?: number;
};

export type WeatherOverlayLayer = {
  kind: 'rainfall' | 'temperature' | 'wind' | 'psi';
  points: MapHeatPoint[];
};

export type MapMarker = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  value: string;
  detail: string;
  severity: RiskLevel | string;
};

type SingaporeRegionMapProps = {
  markers?: MapMarker[];
  showAreaLabels?: boolean;
  emptyTitle?: string;
  emptyDetail?: string;
  problemLabel?: string;
  heatmapLayer?: MapHeatmapLayer;
  weatherOverlay?: WeatherOverlayLayer;
  showMarkers?: boolean;
};

type PlanningArea = {
  id: string;
  name: string;
  region: string;
  polygons: Point[][][];
  label: Point;
};

type Viewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ProjectedMarker = MapMarker & {
  coordinates: Point;
};

type MarkerCluster = {
  id: string;
  coordinates: Point;
  markers: ProjectedMarker[];
  severity: RiskLevel | null;
};

type MapBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

const planningAreas = mapData.planningAreas as PlanningArea[];
const planningAreaBounds = new Map(
  planningAreas.map((area) => {
    const points = area.polygons.flat(2);
    return [
      area.id,
      {
        minX: Math.min(...points.map(([x]) => x)),
        maxX: Math.max(...points.map(([x]) => x)),
        minY: Math.min(...points.map(([, y]) => y)),
        maxY: Math.max(...points.map(([, y]) => y)),
      },
    ] as const;
  }),
);
const initialViewport: Viewport = {
  x: 0,
  y: 0,
  width: mapData.width,
  height: mapData.height,
};
const maxZoom = 16;

const labelOffsets: Record<string, Point> = {
  'Bukit Merah': [-18, 18],
  'Downtown Core': [48, 31],
  'Marina East': [54, 10],
  'Marina South': [52, 30],
  Museum: [-22, 25],
  Newton: [-30, -22],
  Orchard: [-49, 3],
  Outram: [-38, 33],
  'River Valley': [-68, -18],
  Rochor: [45, -15],
  'Singapore River': [-70, 15],
  'Straits View': [58, 34],
};

const riskStyles: Record<RiskLevel, { dot: string; label: string; hover: string }> = {
  critical: { dot: '#dc2626', label: 'Critical severity', hover: '#7f1d1d' },
  high: { dot: '#ef4444', label: 'High severity', hover: '#991b1b' },
  medium: { dot: '#eab308', label: 'Moderate severity', hover: '#854d0e' },
  low: { dot: '#3b82f6', label: 'Low severity', hover: '#1e40af' },
};

const neutralStyle = { dot: '#71717a', label: 'No reported data', hover: '#3f3f46' };
const severityRank: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const heatmapPalettes: Record<HeatmapPalette, string[]> = {
  temperature: ['#38bdf8', '#22c55e', '#facc15', '#f97316', '#ef4444'],
  rainfall: ['#1e3a8a', '#2563eb', '#06b6d4', '#facc15', '#ef4444'],
  wind: ['#14b8a6', '#22c55e', '#a3e635', '#f59e0b', '#ef4444'],
  psi: ['#22c55e', '#a3e635', '#facc15', '#f97316', '#ef4444'],
};

function polygonPath(polygons: Point[][][]) {
  return polygons
    .flatMap((polygon) =>
      polygon.map(
        (ring) =>
          `${ring.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join('')}Z`,
      ),
    )
    .join('');
}

function clusterMarkers(markers: ProjectedMarker[], zoom: number): MarkerCluster[] {
  if (zoom >= 6) {
    return markers.map((marker) => ({
      id: marker.id,
      coordinates: marker.coordinates,
      markers: [marker],
      severity: normalizeRiskLevel(marker.severity),
    }));
  }

  const clusterDistance = 46 / Math.max(zoom, 1);
  const remaining = new Set(markers.map((marker) => marker.id));
  const markerById = new Map(markers.map((marker) => [marker.id, marker]));
  const clusters: MarkerCluster[] = [];

  for (const marker of markers) {
    if (!remaining.has(marker.id)) continue;

    const memberIds = [marker.id];
    remaining.delete(marker.id);

    for (let index = 0; index < memberIds.length; index += 1) {
      const member = markerById.get(memberIds[index]);
      if (!member) continue;

      for (const candidateId of [...remaining]) {
        const candidate = markerById.get(candidateId);
        if (!candidate) continue;
        if (Math.hypot(
          member.coordinates[0] - candidate.coordinates[0],
          member.coordinates[1] - candidate.coordinates[1],
        ) <= clusterDistance) {
          memberIds.push(candidateId);
          remaining.delete(candidateId);
        }
      }
    }

    const members = memberIds.map((id) => markerById.get(id)).filter((item): item is ProjectedMarker => Boolean(item));
    const coordinates: Point = [
      members.reduce((sum, item) => sum + item.coordinates[0], 0) / members.length,
      members.reduce((sum, item) => sum + item.coordinates[1], 0) / members.length,
    ];
    const severity = members.reduce<RiskLevel | null>((highest, item) => {
      const current = normalizeRiskLevel(item.severity);
      if (!current) return highest;
      return !highest || severityRank[current] > severityRank[highest] ? current : highest;
    }, null);

    clusters.push({
      id: members.map((item) => item.id).sort().join('|'),
      coordinates,
      markers: members,
      severity,
    });
  }

  return clusters;
}

function labelFontSize(name: string) {
  if (name.length > 20) return 7;
  if (name.length > 14) return 8;
  return 9;
}

function pointInRing([x, y]: Point, ring: Point[]) {
  let inside = false;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentX, currentY] = ring[index];
    const [previousX, previousY] = ring[previous];
    const crosses =
      currentY > y !== previousY > y &&
      x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;
    if (crosses) inside = !inside;
  }

  return inside;
}

function pointInArea(point: Point, polygons: Point[][][]) {
  return polygons.some(([outerRing, ...holes]) => {
    if (!outerRing || !pointInRing(point, outerRing)) return false;
    return !holes.some((hole) => pointInRing(point, hole));
  });
}

function projectCoordinates(latitude: number, longitude: number): Point {
  const { minLon, maxLon, minLat, maxLat, padding } = mapData.geoBounds;
  const x = padding + ((longitude - minLon) / (maxLon - minLon)) * (mapData.width - padding * 2);
  const y = padding + ((maxLat - latitude) / (maxLat - minLat)) * (mapData.height - padding * 2);
  return [x, y];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function boundsIntersectViewport(bounds: MapBounds, viewport: Viewport, margin = 0) {
  return (
    bounds.maxX >= viewport.x - margin &&
    bounds.minX <= viewport.x + viewport.width + margin &&
    bounds.maxY >= viewport.y - margin &&
    bounds.minY <= viewport.y + viewport.height + margin
  );
}

function pointIsInViewport([x, y]: Point, viewport: Viewport, margin = 0) {
  return (
    x >= viewport.x - margin &&
    x <= viewport.x + viewport.width + margin &&
    y >= viewport.y - margin &&
    y <= viewport.y + viewport.height + margin
  );
}

function normalizeRiskLevel(value: string | null | undefined): RiskLevel | null {
  if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low') return value;
  return null;
}

function riskStyleFor(value: string | null | undefined) {
  const severity = normalizeRiskLevel(value);
  return severity ? riskStyles[severity] : neutralStyle;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

function interpolateColor(from: string, to: string, amount: number) {
  const start = hexToRgb(from);
  const end = hexToRgb(to);

  return rgbToHex({
    r: start.r + (end.r - start.r) * amount,
    g: start.g + (end.g - start.g) * amount,
    b: start.b + (end.b - start.b) * amount,
  });
}

function heatColor(palette: HeatmapPalette, value: number, min: number, max: number) {
  const stops = heatmapPalettes[palette];
  const range = max - min || 1;
  const normalized = clamp((value - min) / range, 0, 1);
  const scaled = normalized * (stops.length - 1);
  const index = Math.min(Math.floor(scaled), stops.length - 2);
  const localAmount = scaled - index;

  return interpolateColor(stops[index], stops[index + 1], localAmount);
}

function interpolatedHeatValue(
  point: Point,
  heatPoints: Array<MapHeatPoint & { coordinates: Point }>,
  fallbackValue: number,
) {
  if (heatPoints.length === 0) return fallbackValue;

  let weightedTotal = 0;
  let weightTotal = 0;

  for (const heatPoint of heatPoints) {
    const [x, y] = heatPoint.coordinates;
    const distanceSquared = (point[0] - x) ** 2 + (point[1] - y) ** 2;
    const weight = 1 / Math.max(distanceSquared, 900);

    weightedTotal += heatPoint.value * weight;
    weightTotal += weight;
  }

  return weightTotal ? weightedTotal / weightTotal : fallbackValue;
}

function formatHeatValue(value: number, unit: string) {
  const precision = unit === 'PSI' || unit === 'km/h' ? 0 : 1;
  return `${value.toFixed(precision)} ${unit}`;
}

function heatmapGradient(palette: HeatmapPalette, direction: 'vertical' | 'horizontal' = 'vertical') {
  const angle = direction === 'vertical' ? 'to top' : 'to right';
  return `linear-gradient(${angle}, ${heatmapPalettes[palette].join(', ')})`;
}

export default function SingaporeRegionMap({
  markers = [],
  showAreaLabels = true,
  emptyTitle = 'Singapore planning areas',
  emptyDetail = 'Hover or focus any outlined area',
  problemLabel = 'reported readings',
  heatmapLayer,
  weatherOverlay,
  showMarkers = true,
}: SingaporeRegionMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapSvgRef = useRef<SVGSVGElement>(null);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [viewport, setViewport] = useState(initialViewport);
  const [isPanning, setIsPanning] = useState(false);
  const dragStart = useRef<{ pointer: Point; viewport: Viewport } | null>(null);
  const liveViewport = useRef(initialViewport);
  const viewportCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoom = mapData.width / viewport.width;
  const areaStatuses = useMemo(
    () =>
      new Map(
        planningAreas.map((area) => {
          const areaMarkers = markers.filter((marker) =>
            pointInArea(projectCoordinates(marker.latitude, marker.longitude), area.polygons),
          );
          const severity = areaMarkers.reduce<RiskLevel | null>((highest, marker) => {
            const markerSeverity = normalizeRiskLevel(marker.severity);
            if (!markerSeverity) return highest;
            return !highest || severityRank[markerSeverity] > severityRank[highest] ? markerSeverity : highest;
          }, null);

          return [area.id, { markers: areaMarkers, severity }] as const;
        }),
      ),
    [markers],
  );
  const activeArea = planningAreas.find((area) => area.id === activeAreaId);
  const isTemperatureHeatmap = heatmapLayer?.palette === 'temperature';
  const isNeutralMap = !heatmapLayer && !weatherOverlay;
  const useLightMapChrome = false;
  const activeStatus = activeArea ? areaStatuses.get(activeArea.id) : null;
  const activeMarker = markers.find((marker) => marker.id === activeMarkerId);
  const projectedMarkers = useMemo<ProjectedMarker[]>(
    () => markers.map((marker) => ({
      ...marker,
      coordinates: projectCoordinates(marker.latitude, marker.longitude),
    })),
    [markers],
  );
  const markerClusters = useMemo(
    () => clusterMarkers(projectedMarkers, zoom),
    [projectedMarkers, zoom],
  );
  const visiblePlanningAreas = useMemo(
    () =>
      planningAreas.filter((area) => {
        const bounds = planningAreaBounds.get(area.id);
        return bounds ? boundsIntersectViewport(bounds, viewport, 18 / zoom) : true;
      }),
    [viewport, zoom],
  );
  const visibleMarkerClusters = useMemo(
    () => markerClusters.filter((cluster) => pointIsInViewport(cluster.coordinates, viewport, 30 / zoom)),
    [markerClusters, viewport, zoom],
  );
  const activeCluster = markerClusters.find((cluster) => cluster.id === activeClusterId);
  const projectedHeatPoints = useMemo(() => {
    if (!heatmapLayer) return [];

    return heatmapLayer.points.map((point) => ({
      ...point,
      coordinates: projectCoordinates(point.latitude, point.longitude),
    }));
  }, [heatmapLayer]);
  const projectedWeatherPoints = useMemo(() => {
    if (!weatherOverlay) return [];

    return weatherOverlay.points
      .map((point) => ({
        ...point,
        coordinates: projectCoordinates(point.latitude, point.longitude),
      }))
      .sort((a, b) => b.value - a.value);
  }, [weatherOverlay]);
  const windFieldPoints = useMemo(() => {
    if (weatherOverlay?.kind !== 'wind' || projectedWeatherPoints.length === 0) return [];

    const points: Array<(typeof projectedWeatherPoints)[number] & { fieldId: string }> = [];
    const spacingX = 96;
    const spacingY = 76;

    for (let y = 42; y < mapData.height - 30; y += spacingY) {
      for (let x = 42; x < mapData.width - 30; x += spacingX) {
        const coordinates: Point = [x + ((Math.floor(y / spacingY) % 2) * spacingX) / 2, y];
        const onLand = planningAreas.some((area) => pointInArea(coordinates, area.polygons));
        if (!onLand) continue;

        const nearest = projectedWeatherPoints.reduce((closest, point) => {
          const closestDistance = Math.hypot(
            closest.coordinates[0] - coordinates[0],
            closest.coordinates[1] - coordinates[1],
          );
          const pointDistance = Math.hypot(
            point.coordinates[0] - coordinates[0],
            point.coordinates[1] - coordinates[1],
          );
          return pointDistance < closestDistance ? point : closest;
        });

        points.push({
          ...nearest,
          fieldId: `${x}-${y}`,
          coordinates,
        });
      }
    }

    return points;
  }, [projectedWeatherPoints, weatherOverlay?.kind]);
  const heatBounds = useMemo(() => {
    if (!heatmapLayer || projectedHeatPoints.length === 0) return null;
    const values = projectedHeatPoints.map((point) => point.value);

    return {
      min: heatmapLayer.min ?? Math.min(...values),
      max: heatmapLayer.max ?? Math.max(...values),
    };
  }, [heatmapLayer, projectedHeatPoints]);
  const heatCells = useMemo(() => {
    if (!heatmapLayer || !heatBounds || projectedHeatPoints.length === 0) return [];

    const cellSize = heatmapLayer.cellSize ?? 7;
    const fallbackValue =
      projectedHeatPoints.reduce((sum, point) => sum + point.value, 0) / projectedHeatPoints.length;
    const cells: Array<{ id: string; x: number; y: number; size: number; value: number; color: string }> = [];

    for (let y = 0; y < mapData.height; y += cellSize) {
      for (let x = 0; x < mapData.width; x += cellSize) {
        const center: Point = [x + cellSize / 2, y + cellSize / 2];
        const value = interpolatedHeatValue(center, projectedHeatPoints, fallbackValue);

        cells.push({
          id: `${x}-${y}`,
          x,
          y,
          size: cellSize + 0.8,
          value,
          color: heatColor(heatmapLayer.palette, value, heatBounds.min, heatBounds.max),
        });
      }
    }

    return cells;
  }, [heatmapLayer, heatBounds, projectedHeatPoints]);
  const visibleHeatCells = useMemo(
    () =>
      heatCells.filter((cell) =>
        boundsIntersectViewport(
          {
            minX: cell.x,
            maxX: cell.x + cell.size,
            minY: cell.y,
            maxY: cell.y + cell.size,
          },
          viewport,
          cell.size,
        ),
      ),
    [heatCells, viewport],
  );
  const visibleHeatPoints = useMemo(
    () => projectedHeatPoints.filter((point) => pointIsInViewport(point.coordinates, viewport, 80 / zoom)),
    [projectedHeatPoints, viewport, zoom],
  );
  const visibleWeatherPoints = useMemo(
    () => projectedWeatherPoints.filter((point) => pointIsInViewport(point.coordinates, viewport, 70 / zoom)),
    [projectedWeatherPoints, viewport, zoom],
  );
  const visibleWindFieldPoints = useMemo(
    () => windFieldPoints.filter((point) => pointIsInViewport(point.coordinates, viewport, 30 / zoom)),
    [windFieldPoints, viewport, zoom],
  );
  const activeHeatStats = useMemo(() => {
    if (!activeArea || !heatmapLayer || projectedHeatPoints.length === 0) return null;
    const areaPoints = heatmapLayer.points.filter((point) =>
      pointInArea(projectCoordinates(point.latitude, point.longitude), activeArea.polygons),
    );
    if (areaPoints.length === 0) {
      const estimatedValue = interpolatedHeatValue(activeArea.label, projectedHeatPoints, 0);

      return { count: 0, average: estimatedValue, peak: null, estimated: true };
    }

    const average = areaPoints.reduce((sum, point) => sum + point.value, 0) / areaPoints.length;
    const peak = areaPoints.reduce((highest, point) => (point.value > highest.value ? point : highest), areaPoints[0]);

    return { count: areaPoints.length, average, peak, estimated: false };
  }, [activeArea, heatmapLayer, projectedHeatPoints]);
  const clampViewport = (next: Viewport): Viewport => ({
    ...next,
    x: Math.min(Math.max(next.x, 0), mapData.width - next.width),
    y: Math.min(Math.max(next.y, 0), mapData.height - next.height),
  });

  const showViewportImmediately = (next: Viewport) => {
    liveViewport.current = next;
    mapSvgRef.current?.setAttribute(
      'viewBox',
      `${next.x} ${next.y} ${next.width} ${next.height}`,
    );
  };

  const commitLiveViewport = () => {
    if (viewportCommitTimer.current) {
      clearTimeout(viewportCommitTimer.current);
      viewportCommitTimer.current = null;
    }
    setViewport(liveViewport.current);
  };

  useEffect(() => {
    liveViewport.current = viewport;
  }, [viewport]);

  const zoomAt = (nextZoom: number, anchorX = 0.5, anchorY = 0.5) => {
    const clampedZoom = Math.min(Math.max(nextZoom, 1), maxZoom);
    const current = liveViewport.current;
    const nextWidth = mapData.width / clampedZoom;
    const nextHeight = mapData.height / clampedZoom;
    const mapAnchorX = current.x + current.width * anchorX;
    const mapAnchorY = current.y + current.height * anchorY;
    const nextViewport = clampViewport({
      x: mapAnchorX - nextWidth * anchorX,
      y: mapAnchorY - nextHeight * anchorY,
      width: nextWidth,
      height: nextHeight,
    });

    liveViewport.current = nextViewport;
    setViewport(nextViewport);
  };

  const zoomToCluster = (cluster: MarkerCluster) => {
    const [x, y] = cluster.coordinates;
    const current = liveViewport.current;
    const anchorX = clamp((x - current.x) / current.width, 0, 1);
    const anchorY = clamp((y - current.y) / current.height, 0, 1);
    setActiveClusterId(null);
    zoomAt(Math.min(maxZoom, Math.max(zoom * 2, 2)), anchorX, anchorY);
  };

  useEffect(() => {
    const mapContainer = mapContainerRef.current;
    if (!mapContainer) return;

    const handleTrackpadPinch = (event: globalThis.WheelEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || !mapContainer.contains(event.target as Node)) return;

      event.preventDefault();
      event.stopPropagation();

      const bounds = mapContainer.getBoundingClientRect();
      const anchorX = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1);
      const anchorY = Math.min(Math.max((event.clientY - bounds.top) / bounds.height, 0), 1);
      const zoomFactor = Math.exp(-event.deltaY * 0.01);

      const current = liveViewport.current;
      const currentZoom = mapData.width / current.width;
      const nextZoom = Math.min(Math.max(currentZoom * zoomFactor, 1), maxZoom);
      const nextWidth = mapData.width / nextZoom;
      const nextHeight = mapData.height / nextZoom;
      const mapAnchorX = current.x + current.width * anchorX;
      const mapAnchorY = current.y + current.height * anchorY;
      const nextViewport = clampViewport({
        x: mapAnchorX - nextWidth * anchorX,
        y: mapAnchorY - nextHeight * anchorY,
        width: nextWidth,
        height: nextHeight,
      });

      showViewportImmediately(nextViewport);
      if (viewportCommitTimer.current) clearTimeout(viewportCommitTimer.current);
      viewportCommitTimer.current = setTimeout(commitLiveViewport, 90);
    };

    const preventBrowserGesture = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('wheel', handleTrackpadPinch, { passive: false, capture: true });
    mapContainer.addEventListener('gesturestart', preventBrowserGesture, { passive: false });
    mapContainer.addEventListener('gesturechange', preventBrowserGesture, { passive: false });
    mapContainer.addEventListener('gestureend', preventBrowserGesture, { passive: false });

    return () => {
      document.removeEventListener('wheel', handleTrackpadPinch, { capture: true });
      mapContainer.removeEventListener('gesturestart', preventBrowserGesture);
      mapContainer.removeEventListener('gesturechange', preventBrowserGesture);
      mapContainer.removeEventListener('gestureend', preventBrowserGesture);
      if (viewportCommitTimer.current) clearTimeout(viewportCommitTimer.current);
    };
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = {
      pointer: [event.clientX, event.clientY],
      viewport: liveViewport.current,
    };
    setIsPanning(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragStart.current) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const deltaX =
      ((event.clientX - dragStart.current.pointer[0]) / bounds.width) *
      dragStart.current.viewport.width;
    const deltaY =
      ((event.clientY - dragStart.current.pointer[1]) / bounds.height) *
      dragStart.current.viewport.height;

    showViewportImmediately(clampViewport({
      ...dragStart.current.viewport,
      x: dragStart.current.viewport.x - deltaX,
      y: dragStart.current.viewport.y - deltaY,
    }));
  };

  const stopPanning = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStart.current = null;
    commitLiveViewport();
    setIsPanning(false);
  };

  return (
    <div
      ref={mapContainerRef}
      className="relative h-full min-h-[280px] overflow-hidden rounded-lg bg-zinc-800"
    >
      <div className="pointer-events-none absolute inset-0 bg-zinc-800" />

      <svg
        ref={mapSvgRef}
        viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
        className={`relative h-full w-full select-none ${
          isPanning ? 'cursor-grabbing [&_*]:pointer-events-none' : 'cursor-grab'
        }`}
        style={{ touchAction: 'none' }}
        role="img"
        aria-label="Interactive map of Singapore's 55 planning areas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopPanning}
        onPointerCancel={stopPanning}
      >
        <defs>
          <clipPath id="singapore-map-land-clip">
            {planningAreas.map((area) => (
              <path
                key={`${area.id}-clip`}
                d={polygonPath(area.polygons)}
                fillRule="evenodd"
                clipRule="evenodd"
              />
            ))}
          </clipPath>
          <filter id="singapore-map-surface-blur" x="-8%" y="-8%" width="116%" height="116%">
            <feGaussianBlur stdDeviation={isTemperatureHeatmap ? 0.8 : 2.4} />
          </filter>
          <filter id="singapore-map-heat-blur" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="13" />
          </filter>
          <filter id="singapore-weather-haze-blur" x="-30%" y="-80%" width="160%" height="260%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <marker id="singapore-wind-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 L1.8,3.5 Z" fill="#ffffff" stroke="#164e63" strokeWidth="0.8" />
          </marker>
        </defs>

        {heatmapLayer && heatBounds && (
          <g clipPath="url(#singapore-map-land-clip)" className="pointer-events-none">
            <g filter="url(#singapore-map-surface-blur)" opacity={heatmapLayer.opacity ?? 0.96}>
              {visibleHeatCells.map((cell) => (
                <rect
                  key={cell.id}
                  x={cell.x}
                  y={cell.y}
                  width={cell.size}
                  height={cell.size}
                  fill={cell.color}
                />
              ))}
            </g>
            <g filter="url(#singapore-map-heat-blur)" opacity="0.22">
              {visibleHeatPoints.map((point) => {
                const [x, y] = point.coordinates;
                const color = heatColor(heatmapLayer.palette, point.value, heatBounds.min, heatBounds.max);
                const radius = heatmapLayer.radius ?? 54;

                return <circle key={`${point.id}-glow`} cx={x} cy={y} r={radius} fill={color} />;
              })}
            </g>
          </g>
        )}

        {weatherOverlay && (
          <g clipPath="url(#singapore-map-land-clip)" className="pointer-events-none">
            {weatherOverlay.kind === 'wind' &&
              visibleWindFieldPoints.map((point) => {
                const [x, y] = point.coordinates;
                const length = clamp(10 + point.value * 0.42, 12, 23);
                const direction = Number.isFinite(point.direction) ? Number(point.direction) : 90;

                return (
                  <g
                    key={`wind-${point.fieldId}`}
                    opacity={clamp(0.82 + point.value / 90, 0.82, 1)}
                    transform={`rotate(${direction} ${x} ${y})`}
                  >
                    <line
                      x1={x}
                      y1={y + length / 2}
                      x2={x}
                      y2={y - length / 2}
                      stroke="#083344"
                      strokeWidth="4"
                      strokeLinecap="round"
                      opacity="0.9"
                    />
                    <line
                      x1={x}
                      y1={y + length / 2}
                      x2={x}
                      y2={y - length / 2}
                      fill="none"
                      stroke="#f8fafc"
                      strokeWidth="2"
                      strokeLinecap="round"
                      markerEnd="url(#singapore-wind-arrow)"
                    />
                  </g>
                );
              })}

            {weatherOverlay.kind === 'psi' && (
              <g filter="url(#singapore-weather-haze-blur)" opacity="0.3">
                {visibleWeatherPoints.map((point, index) => {
                  const [x, y] = point.coordinates;
                  return (
                    <path
                      key={`haze-${point.id}`}
                      d={`M${x - 55},${y - 10 + index * 2} C${x - 20},${y - 22} ${x + 18},${y + 8} ${x + 58},${y - 5}`}
                      fill="none"
                      stroke={point.value > 100 ? '#fb923c' : '#e2e8f0'}
                      strokeWidth={clamp(8 + point.value / 18, 9, 20)}
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>
            )}
          </g>
        )}

        <g>
          {planningAreas.map((area) => {
            const isActive = activeAreaId === area.id;
            const status = areaStatuses.get(area.id);
            const style = riskStyleFor(status?.severity);
            const fillOpacity = heatmapLayer
              ? (isActive ? 0.2 : 0.03)
              : isNeutralMap
                ? (isActive ? 0.58 : 0.34)
                : 1;

            return (
              <path
                key={area.id}
                d={polygonPath(area.polygons)}
                fill={isNeutralMap ? (isActive ? '#2563eb' : '#334155') : isActive ? style.hover : '#52525b'}
                fillOpacity={fillOpacity}
                fillRule="evenodd"
                clipRule="evenodd"
                stroke={isNeutralMap ? (isActive ? '#93c5fd' : '#0f172a') : heatmapLayer ? '#0b1120' : '#18181b'}
                strokeOpacity={heatmapLayer ? 0.72 : isNeutralMap ? 0.86 : 1}
                strokeWidth={isNeutralMap ? (isActive ? '2' : '1.05') : heatmapLayer ? '1.05' : '1.35'}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="outline-none transition-colors duration-150"
                tabIndex={0}
                role="button"
                aria-label={`${area.name}, ${area.region}: ${style.label}, ${status?.markers.length ?? 0} ${problemLabel}`}
                onMouseEnter={() => setActiveAreaId(area.id)}
                onMouseLeave={() => setActiveAreaId(null)}
                onFocus={() => setActiveAreaId(area.id)}
                onBlur={() => setActiveAreaId(null)}
              />
            );
          })}
        </g>

        {activeArea && activeStatus && (
          <path
            d={polygonPath(activeArea.polygons)}
            fill="none"
            fillRule="evenodd"
            clipRule="evenodd"
            stroke={isNeutralMap ? '#2563eb' : '#fafafa'}
            strokeWidth="2.75"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="pointer-events-none"
            style={{ filter: isNeutralMap ? 'drop-shadow(0 0 5px rgba(96,165,250,0.45))' : `drop-shadow(0 0 4px ${riskStyleFor(activeStatus.severity).dot})` }}
          />
        )}

        {showMarkers && <g>
          {visibleMarkerClusters.map((cluster) => {
            const [x, y] = cluster.coordinates;
            const marker = cluster.markers[0];
            const isGrouped = cluster.markers.length > 1;
            const isActive = isGrouped ? activeClusterId === cluster.id : activeMarkerId === marker.id;
            const style = riskStyleFor(cluster.severity ?? marker.severity);
            const clusterRadius = clamp(13 + Math.log2(cluster.markers.length) * 2.5, 14, 22);

            if (isGrouped) {
              return (
                <g
                  key={cluster.id}
                  transform={`translate(${x} ${y}) scale(${1 / zoom})`}
                  className="cursor-zoom-in outline-none"
                  tabIndex={0}
                  role="button"
                  aria-label={`${cluster.markers.length} nearby ${problemLabel}. Activate to zoom in.`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => zoomToCluster(cluster)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      zoomToCluster(cluster);
                    }
                  }}
                  onMouseEnter={() => setActiveClusterId(cluster.id)}
                  onMouseLeave={() => setActiveClusterId(null)}
                  onFocus={() => setActiveClusterId(cluster.id)}
                  onBlur={() => setActiveClusterId(null)}
                >
                  <circle
                    r={clusterRadius + 5}
                    fill={style.dot}
                    fillOpacity="0.2"
                    stroke={style.dot}
                    strokeWidth="1.5"
                  />
                  <circle
                    r={clusterRadius}
                    fill={style.dot}
                    fillOpacity={isActive ? 1 : 0.9}
                    stroke="#fafafa"
                    strokeWidth={isActive ? 3 : 2}
                    style={{ filter: isActive ? `drop-shadow(0 0 6px ${style.dot})` : 'none' }}
                  />
                  <text
                    y="4"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="12"
                    fontWeight="800"
                    className="pointer-events-none"
                    style={{ paintOrder: 'stroke', stroke: '#18181b', strokeWidth: 2 }}
                  >
                    {cluster.markers.length}
                  </text>
                </g>
              );
            }

            return (
              <g
                key={marker.id}
                transform={`translate(${x} ${y}) scale(${1 / zoom})`}
                className="cursor-pointer outline-none"
                tabIndex={0}
                role="button"
                aria-label={`${marker.name}: ${marker.value}. ${marker.detail}`}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseEnter={() => setActiveMarkerId(marker.id)}
                onMouseLeave={() => setActiveMarkerId(null)}
                onFocus={() => setActiveMarkerId(marker.id)}
                onBlur={() => setActiveMarkerId(null)}
              >
                <circle
                  r={isActive ? 9 : 6}
                  fill={style.dot}
                  fillOpacity={isActive ? 1 : 0.82}
                  stroke="#fafafa"
                  strokeWidth={isActive ? 2.5 : 1.5}
                  style={{ filter: isActive ? `drop-shadow(0 0 5px ${style.dot})` : 'none' }}
                />
                {isActive && (
                  <text
                    x="12"
                    y="4"
                    fill="#ffffff"
                    fontSize="11"
                    fontWeight="700"
                    className="pointer-events-none"
                    style={{ paintOrder: 'stroke', stroke: '#18181b', strokeWidth: 3 }}
                  >
                    {marker.value}
                  </text>
                )}
              </g>
            );
          })}
        </g>}

        {showAreaLabels && <g className="pointer-events-none">
          {visiblePlanningAreas.map((area) => {
            const status = areaStatuses.get(area.id);
            const style = riskStyleFor(status?.severity);
            const [dotX, dotY] = area.label;
            const [offsetX = 0, offsetY = 0] = labelOffsets[area.name] ?? [];
            const labelX = dotX + offsetX;
            const labelY = dotY + offsetY;
            const moved = offsetX !== 0 || offsetY !== 0;
            const isActive = activeAreaId === area.id;

            return (
              <g
                key={`${area.id}-label`}
                opacity={isActive ? 1 : activeAreaId ? 0.3 : 0.58}
                className="transition-opacity duration-150"
              >
                {moved && (
                  <line
                    x1={dotX}
                    y1={dotY}
                    x2={labelX}
                    y2={labelY}
                    stroke={isNeutralMap ? (isActive ? '#2563eb' : '#94a3b8') : isActive ? '#ffffff' : '#a1a1aa'}
                    strokeWidth="0.8"
                    strokeDasharray="2 2"
                  />
                )}
                {!isNeutralMap && (
                  <circle
                    cx={dotX}
                    cy={dotY}
                    r={isActive ? 4.3 : 3}
                    fill={style.dot}
                    stroke="#18181b"
                    strokeWidth="1.2"
                  />
                )}
                <text
                  x={labelX + 5}
                  y={labelY + 3}
                  fill={isActive ? '#ffffff' : '#e4e4e7'}
                  fontSize={isActive ? labelFontSize(area.name) + 1.5 : labelFontSize(area.name)}
                  fontWeight={isActive ? 700 : 500}
                  style={{
                    paintOrder: 'stroke',
                    stroke: '#27272a',
                    strokeWidth: 2.5,
                    strokeLinejoin: 'round',
                  }}
                >
                  {area.name}
                </text>
              </g>
            );
          })}
        </g>}
      </svg>

      <div className={`absolute right-3 top-3 flex items-center overflow-hidden rounded-lg shadow-xl ${
        useLightMapChrome ? 'border border-slate-300 bg-white/95' : 'border border-zinc-700 bg-zinc-950/95 backdrop-blur'
      }`}>
        <button
          type="button"
          onClick={() => zoomAt(zoom / 1.35)}
          disabled={zoom <= 1.01}
          className={`grid h-9 w-9 place-items-center border-r text-lg transition-colors disabled:cursor-not-allowed ${
            useLightMapChrome
              ? 'border-slate-300 text-slate-700 hover:bg-slate-100 disabled:text-slate-300'
              : 'border-zinc-700 text-zinc-200 hover:bg-zinc-800 disabled:text-zinc-600'
          }`}
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          type="button"
          onClick={() => setViewport(initialViewport)}
          className={`h-9 min-w-16 border-r px-2 text-xs font-medium transition-colors ${
            useLightMapChrome ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
          }`}
          aria-label="Reset map zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => zoomAt(zoom * 1.35)}
          disabled={zoom >= maxZoom - 0.01}
          className={`grid h-9 w-9 place-items-center text-lg transition-colors disabled:cursor-not-allowed ${
            useLightMapChrome ? 'text-slate-700 hover:bg-slate-100 disabled:text-slate-300' : 'text-zinc-200 hover:bg-zinc-800 disabled:text-zinc-600'
          }`}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      <div className={`pointer-events-none absolute bottom-3 right-3 rounded-md px-2 py-1 text-[10px] ${
        useLightMapChrome ? 'border border-slate-300 bg-white/90 text-slate-500' : 'border border-zinc-700 bg-zinc-950/85 text-zinc-400 backdrop-blur'
      }`}>
        Pinch to zoom - Drag to move - Select clusters to expand
      </div>


      {heatmapLayer && heatBounds && (
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded-lg border border-zinc-700 bg-zinc-950/90 p-2 shadow-xl backdrop-blur">
          <div className="flex flex-col items-center">
            <span className="mb-1 text-[10px] font-semibold text-zinc-200">{formatHeatValue(heatBounds.max, heatmapLayer.unit)}</span>
            <div className="h-36">
              <div
                className="h-full w-3 rounded-full border border-white/20"
                style={{ background: heatmapGradient(heatmapLayer.palette) }}
              />
            </div>
            <span className="mt-1 text-[10px] font-semibold text-zinc-200">{formatHeatValue(heatBounds.min, heatmapLayer.unit)}</span>
          </div>
        </div>
      )}

      <div className={`pointer-events-none absolute ${heatmapLayer ? 'left-3 top-[calc(50%-13rem)]' : 'left-3 top-3'} max-w-[240px] rounded-lg px-3 py-2 shadow-xl ${
        useLightMapChrome ? 'border border-slate-300 bg-white/95' : 'border border-zinc-700 bg-zinc-950/95 backdrop-blur'
      }`}>
        {activeCluster ? (
          <>
            <div className={`flex items-center gap-2 text-sm font-semibold ${useLightMapChrome ? 'text-slate-900' : 'text-white'}`}>
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: riskStyleFor(activeCluster.severity).dot }}
              />
              {activeCluster.markers.length} nearby locations
            </div>
            <div className={`mt-1 text-xs ${useLightMapChrome ? 'text-slate-700' : 'text-zinc-300'}`}>
              {activeCluster.markers.slice(0, 3).map((marker) => marker.name).join(', ')}
              {activeCluster.markers.length > 3 ? ` and ${activeCluster.markers.length - 3} more` : ''}
            </div>
            <div className={`mt-1 text-[11px] ${useLightMapChrome ? 'text-slate-500' : 'text-zinc-500'}`}>Select the cluster to zoom in and separate its locations.</div>
          </>
        ) : activeMarker ? (
          <>
            <div className={`flex items-center gap-2 text-sm font-semibold ${useLightMapChrome ? 'text-slate-900' : 'text-white'}`}>
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: riskStyleFor(activeMarker.severity).dot }}
              />
              {activeMarker.name}
            </div>
            <div className={`mt-1 text-sm font-semibold ${useLightMapChrome ? 'text-slate-800' : 'text-zinc-100'}`}>{activeMarker.value}</div>
            <div className={`mt-0.5 text-xs ${useLightMapChrome ? 'text-slate-600' : 'text-zinc-300'}`}>{activeMarker.detail}</div>
          </>
        ) : activeArea && activeStatus ? (
          <>
            <div className={`flex items-center gap-2 text-sm font-semibold ${useLightMapChrome ? 'text-slate-900' : 'text-white'}`}>
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: activeStatus.severity
                    ? riskStyleFor(activeStatus.severity).dot
                    : neutralStyle.dot,
                }}
              />
              {activeArea.name}
            </div>
            <div className={`mt-0.5 text-[11px] ${useLightMapChrome ? 'text-slate-500' : 'text-zinc-500'}`}>{activeArea.region}</div>
            <div className={`mt-1 text-xs ${useLightMapChrome ? 'text-slate-700' : 'text-zinc-300'}`}>
              {activeHeatStats && heatmapLayer ? (
                <>
                  {activeHeatStats.estimated
                    ? `Estimated reading: ${formatHeatValue(activeHeatStats.average, heatmapLayer.unit)}`
                    : `${activeHeatStats.count} readings - avg ${formatHeatValue(activeHeatStats.average, heatmapLayer.unit)}`}
                  {activeHeatStats.peak && (
                    <>
                      <br />
                      Peak: {activeHeatStats.peak.name} ({formatHeatValue(activeHeatStats.peak.value, heatmapLayer.unit)})
                    </>
                  )}
                </>
              ) : activeStatus.markers.length ? (
                `${activeStatus.markers.length} ${problemLabel} - Highest level: ${
                  riskStyleFor(activeStatus.severity).label
                }`
              ) : (
                `No ${problemLabel} mapped in this area`
              )}
            </div>
          </>
        ) : (
          <>
            <div className={`text-xs font-medium ${useLightMapChrome ? 'text-slate-700' : 'text-zinc-300'}`}>{emptyTitle}</div>
            <div className={`mt-0.5 text-[11px] ${useLightMapChrome ? 'text-slate-500' : 'text-zinc-500'}`}>{emptyDetail}</div>
          </>
        )}
      </div>
    </div>
  );
}
