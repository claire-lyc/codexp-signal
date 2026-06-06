import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import mapData from '../../data/singapore-planning-areas.json';

type RiskLevel = 'high' | 'medium' | 'low';
type Point = [number, number];

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

const initialViewport: Viewport = {
  x: 0,
  y: 0,
  width: mapData.width,
  height: mapData.height,
};
const maxZoom = 4;

const highRiskAreas = new Set(['Bedok', 'Orchard', 'Tampines', 'Marine Parade']);
const mediumRiskAreas = new Set([
  'Ang Mo Kio',
  'Jurong West',
  'Punggol',
  'Woodlands',
  'Downtown Core',
  'Kallang',
]);

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
  high: { dot: '#ef4444', label: 'High risk', hover: '#991b1b' },
  medium: { dot: '#eab308', label: 'Moderate risk', hover: '#854d0e' },
  low: { dot: '#3b82f6', label: 'Low risk', hover: '#1e40af' },
};

function getRisk(name: string): RiskLevel {
  if (highRiskAreas.has(name)) return 'high';
  if (mediumRiskAreas.has(name)) return 'medium';
  return 'low';
}

function getDetail(name: string, risk: RiskLevel) {
  if (name === 'Bedok') return 'Dengue cluster monitoring';
  if (name === 'Orchard') return 'Flash flood monitoring';
  if (name === 'Tampines' || name === 'Marine Parade') return 'Weather alert monitoring';
  if (risk === 'medium') return 'Elevated operational monitoring';
  return 'No major active alerts';
}

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

export default function SingaporeRegionMap() {
  const planningAreas = mapData.planningAreas as PlanningArea[];
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [viewport, setViewport] = useState(initialViewport);
  const [isPanning, setIsPanning] = useState(false);
  const dragStart = useRef<{ pointer: Point; viewport: Viewport } | null>(null);
  const activeArea = planningAreas.find((area) => area.id === activeAreaId);
  const activeRisk = activeArea ? getRisk(activeArea.name) : null;
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
            const risk = getRisk(area.name);

            return (
              <path
                key={area.id}
                d={polygonPath(area.polygons)}
                fill={isActive ? riskStyles[risk].hover : '#52525b'}
                fillRule="evenodd"
                clipRule="evenodd"
                stroke="#18181b"
                strokeWidth="1.35"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="outline-none transition-colors duration-150"
                tabIndex={0}
                role="button"
                aria-label={`${area.name}, ${area.region}: ${riskStyles[risk].label}`}
                onMouseEnter={() => setActiveAreaId(area.id)}
                onMouseLeave={() => setActiveAreaId(null)}
                onFocus={() => setActiveAreaId(area.id)}
                onBlur={() => setActiveAreaId(null)}
              />
            );
          })}
        </g>

        {activeArea && activeRisk && (
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
            style={{ filter: `drop-shadow(0 0 4px ${riskStyles[activeRisk].dot})` }}
          />
        )}

        <g className="pointer-events-none">
          {planningAreas.map((area) => {
            const risk = getRisk(area.name);
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
                  fill={riskStyles[risk].dot}
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
        </g>
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
        {activeArea && activeRisk ? (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: riskStyles[activeRisk].dot }}
              />
              {activeArea.name}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">{activeArea.region}</div>
            <div className="mt-1 text-xs text-zinc-300">{getDetail(activeArea.name, activeRisk)}</div>
          </>
        ) : (
          <>
            <div className="text-xs font-medium text-zinc-300">Singapore planning areas</div>
            <div className="mt-0.5 text-[11px] text-zinc-500">Hover or focus any outlined area</div>
          </>
        )}
      </div>
    </div>
  );
}
