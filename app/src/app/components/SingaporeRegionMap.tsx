import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import mapData from '../../data/singapore-planning-areas.json';

type RiskLevel = 'high' | 'medium' | 'low';
type Point = [number, number];

export type MapMarker = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  value: string;
  detail: string;
  severity: RiskLevel;
};

type SingaporeRegionMapProps = {
  markers?: MapMarker[];
  showAreaLabels?: boolean;
  emptyTitle?: string;
  emptyDetail?: string;
  problemLabel?: string;
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

const planningAreas = mapData.planningAreas as PlanningArea[];
const initialViewport: Viewport = {
  x: 0,
  y: 0,
  width: mapData.width,
  height: mapData.height,
};
const maxZoom = 4;

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
  high: { dot: '#ef4444', label: 'High severity', hover: '#991b1b' },
  medium: { dot: '#eab308', label: 'Moderate severity', hover: '#854d0e' },
  low: { dot: '#3b82f6', label: 'Low severity', hover: '#1e40af' },
};

const neutralStyle = { dot: '#71717a', label: 'No reported data', hover: '#3f3f46' };
const severityRank: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3 };

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

export default function SingaporeRegionMap({
  markers = [],
  showAreaLabels = true,
  emptyTitle = 'Singapore planning areas',
  emptyDetail = 'Hover or focus any outlined area',
  problemLabel = 'reported readings',
}: SingaporeRegionMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [viewport, setViewport] = useState(initialViewport);
  const [isPanning, setIsPanning] = useState(false);
  const dragStart = useRef<{ pointer: Point; viewport: Viewport } | null>(null);
  const areaStatuses = useMemo(
    () =>
      new Map(
        planningAreas.map((area) => {
          const areaMarkers = markers.filter((marker) =>
            pointInArea(projectCoordinates(marker.latitude, marker.longitude), area.polygons),
          );
          const severity = areaMarkers.reduce<RiskLevel | null>(
            (highest, marker) =>
              !highest || severityRank[marker.severity] > severityRank[highest]
                ? marker.severity
                : highest,
            null,
          );

          return [area.id, { markers: areaMarkers, severity }] as const;
        }),
      ),
    [markers],
  );
  const activeArea = planningAreas.find((area) => area.id === activeAreaId);
  const activeStatus = activeArea ? areaStatuses.get(activeArea.id) : null;
  const activeMarker = markers.find((marker) => marker.id === activeMarkerId);
  const zoom = mapData.width / viewport.width;

  const clampViewport = (next: Viewport): Viewport => ({
    ...next,
    x: Math.min(Math.max(next.x, 0), mapData.width - next.width),
    y: Math.min(Math.max(next.y, 0), mapData.height - next.height),
  });

  const zoomAt = (nextZoom: number, anchorX = 0.5, anchorY = 0.5) => {
    const clampedZoom = Math.min(Math.max(nextZoom, 1), maxZoom);

    setViewport((current) => {
      const nextWidth = mapData.width / clampedZoom;
      const nextHeight = mapData.height / clampedZoom;
      const mapAnchorX = current.x + current.width * anchorX;
      const mapAnchorY = current.y + current.height * anchorY;

      return clampViewport({
        x: mapAnchorX - nextWidth * anchorX,
        y: mapAnchorY - nextHeight * anchorY,
        width: nextWidth,
        height: nextHeight,
      });
    });
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

      setViewport((current) => {
        const currentZoom = mapData.width / current.width;
        const nextZoom = Math.min(Math.max(currentZoom * zoomFactor, 1), maxZoom);
        const nextWidth = mapData.width / nextZoom;
        const nextHeight = mapData.height / nextZoom;
        const mapAnchorX = current.x + current.width * anchorX;
        const mapAnchorY = current.y + current.height * anchorY;

        return clampViewport({
          x: mapAnchorX - nextWidth * anchorX,
          y: mapAnchorY - nextHeight * anchorY,
          width: nextWidth,
          height: nextHeight,
        });
      });
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
    };
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = {
      pointer: [event.clientX, event.clientY],
      viewport,
    };
    setIsPanning(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragStart.current) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const deltaX = ((event.clientX - dragStart.current.pointer[0]) / bounds.width) * viewport.width;
    const deltaY = ((event.clientY - dragStart.current.pointer[1]) / bounds.height) * viewport.height;

    setViewport(
      clampViewport({
        ...dragStart.current.viewport,
        x: dragStart.current.viewport.x - deltaX,
        y: dragStart.current.viewport.y - deltaY,
      }),
    );
  };

  const stopPanning = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStart.current = null;
    setIsPanning(false);
  };

  return (
    <div
      ref={mapContainerRef}
      className="relative h-full min-h-[280px] overflow-hidden rounded-lg bg-zinc-800"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(82,82,91,0.38),transparent_70%)]" />

      <svg
        viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
        className={`relative h-full w-full select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ touchAction: 'none' }}
        role="img"
        aria-label="Interactive map of Singapore's 55 planning areas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopPanning}
        onPointerCancel={stopPanning}
      >
        <g>
          {planningAreas.map((area) => {
            const isActive = activeAreaId === area.id;
            const status = areaStatuses.get(area.id);
            const style = status?.severity ? riskStyles[status.severity] : neutralStyle;

            return (
              <path
                key={area.id}
                d={polygonPath(area.polygons)}
                fill={isActive ? style.hover : '#52525b'}
                fillRule="evenodd"
                clipRule="evenodd"
                stroke="#18181b"
                strokeWidth="1.35"
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
            stroke="#fafafa"
            strokeWidth="2.75"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="pointer-events-none"
            style={{
              filter: `drop-shadow(0 0 4px ${
                activeStatus.severity ? riskStyles[activeStatus.severity].dot : neutralStyle.dot
              })`,
            }}
          />
        )}

        <g>
          {markers.map((marker) => {
            const [x, y] = projectCoordinates(marker.latitude, marker.longitude);
            const isActive = activeMarkerId === marker.id;
            const style = riskStyles[marker.severity];

            return (
              <g
                key={marker.id}
                className="cursor-pointer outline-none"
                tabIndex={0}
                role="button"
                aria-label={`${marker.name}: ${marker.value}. ${marker.detail}`}
                onMouseEnter={() => setActiveMarkerId(marker.id)}
                onMouseLeave={() => setActiveMarkerId(null)}
                onFocus={() => setActiveMarkerId(marker.id)}
                onBlur={() => setActiveMarkerId(null)}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={isActive ? 9 : 6}
                  fill={style.dot}
                  fillOpacity={isActive ? 1 : 0.82}
                  stroke="#fafafa"
                  strokeWidth={isActive ? 2.5 : 1.5}
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: isActive ? `drop-shadow(0 0 5px ${style.dot})` : 'none' }}
                />
                {isActive && (
                  <text
                    x={x + 12}
                    y={y + 4}
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
        </g>

        {showAreaLabels && <g className="pointer-events-none">
          {planningAreas.map((area) => {
            const status = areaStatuses.get(area.id);
            const style = status?.severity ? riskStyles[status.severity] : neutralStyle;
            const [dotX, dotY] = area.label;
            const [offsetX = 0, offsetY = 0] = labelOffsets[area.name] ?? [];
            const labelX = dotX + offsetX;
            const labelY = dotY + offsetY;
            const moved = offsetX !== 0 || offsetY !== 0;
            const isActive = activeAreaId === area.id;

            return (
              <g key={`${area.id}-label`} opacity={activeAreaId && !isActive ? 0.38 : 1}>
                {moved && (
                  <line
                    x1={dotX}
                    y1={dotY}
                    x2={labelX}
                    y2={labelY}
                    stroke={isActive ? '#ffffff' : '#a1a1aa'}
                    strokeWidth="0.8"
                    strokeDasharray="2 2"
                  />
                )}
                <circle
                  cx={dotX}
                  cy={dotY}
                  r={isActive ? 4.3 : 3}
                  fill={style.dot}
                  stroke="#18181b"
                  strokeWidth="1.2"
                />
                <text
                  x={labelX + 5}
                  y={labelY + 3}
                  fill={isActive ? '#ffffff' : '#e4e4e7'}
                  fontSize={isActive ? labelFontSize(area.name) + 1.5 : labelFontSize(area.name)}
                  fontWeight={isActive ? 700 : 500}
                  style={{ paintOrder: 'stroke', stroke: '#27272a', strokeWidth: 2.5, strokeLinejoin: 'round' }}
                >
                  {area.name}
                </text>
              </g>
            );
          })}
        </g>}
      </svg>

      <div className="absolute right-3 top-3 flex items-center overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950/95 shadow-xl backdrop-blur">
        <button
          type="button"
          onClick={() => zoomAt(zoom / 1.35)}
          disabled={zoom <= 1.01}
          className="grid h-9 w-9 place-items-center border-r border-zinc-700 text-lg text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-600"
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          type="button"
          onClick={() => setViewport(initialViewport)}
          className="h-9 min-w-16 border-r border-zinc-700 px-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
          aria-label="Reset map zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => zoomAt(zoom * 1.35)}
          disabled={zoom >= maxZoom - 0.01}
          className="grid h-9 w-9 place-items-center text-lg text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-600"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-zinc-700 bg-zinc-950/85 px-2 py-1 text-[10px] text-zinc-400 backdrop-blur">
        Pinch to zoom · Drag to move
      </div>

      <div className="pointer-events-none absolute left-3 top-3 max-w-[240px] rounded-lg border border-zinc-700 bg-zinc-950/95 px-3 py-2 shadow-xl backdrop-blur">
        {activeMarker ? (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: riskStyles[activeMarker.severity].dot }}
              />
              {activeMarker.name}
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-100">{activeMarker.value}</div>
            <div className="mt-0.5 text-xs text-zinc-300">{activeMarker.detail}</div>
          </>
        ) : activeArea && activeStatus ? (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: activeStatus.severity
                    ? riskStyles[activeStatus.severity].dot
                    : neutralStyle.dot,
                }}
              />
              {activeArea.name}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">{activeArea.region}</div>
            <div className="mt-1 text-xs text-zinc-300">
              {activeStatus.markers.length
                ? `${activeStatus.markers.length} ${problemLabel} · Highest level: ${
                    riskStyles[activeStatus.severity ?? 'low'].label
                  }`
                : `No ${problemLabel} mapped in this area`}
            </div>
          </>
        ) : (
          <>
            <div className="text-xs font-medium text-zinc-300">{emptyTitle}</div>
            <div className="mt-0.5 text-[11px] text-zinc-500">{emptyDetail}</div>
          </>
        )}
      </div>
    </div>
  );
}
