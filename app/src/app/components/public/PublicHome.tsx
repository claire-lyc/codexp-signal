// GET /api/citizen/alerts
// GET /api/heatmap?layer=crises&public=true
import { AlertTriangle, MapPin, Activity, Shield, TrendingUp, Navigation } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import SingaporeRegionMap, { type MapMarker } from '../SingaporeRegionMap';
import { useApi } from '../../lib/api';

type PublicHomeData = {
  activeCrisisLabels: string[];
  summary: string;
  stats: Array<{ label: string; value: string; icon: string; colour: string }>;
  activeAlerts: Array<{ id: number; type: string; message: string; severity: string; region: string }>;
  nearbyResources: Array<{ name: string; type: string; distance: string; status: string }>;
  updates: Array<{ time: string; message: string }>;
};

const publicStats: PublicHomeData['stats'] = [];
const statIconMap = { Activity, AlertTriangle, Shield, TrendingUp };
const statColours: Record<string, { bg: string; text: string }> = {
  red: { bg: 'bg-red-950', text: 'text-red-500' },
  yellow: { bg: 'bg-yellow-950', text: 'text-yellow-500' },
  green: { bg: 'bg-green-950', text: 'text-green-500' },
  blue: { bg: 'bg-blue-950', text: 'text-blue-500' },
};
const regionCoordinates: Record<string, { latitude: number; longitude: number }> = {
  Nationwide: { latitude: 1.3521, longitude: 103.8198 },
  North: { latitude: 1.4291, longitude: 103.8354 },
  South: { latitude: 1.276, longitude: 103.8457 },
  East: { latitude: 1.3529, longitude: 103.9441 },
  West: { latitude: 1.3456, longitude: 103.7019 },
  Central: { latitude: 1.3021, longitude: 103.8398 },
  All: { latitude: 1.3521, longitude: 103.8198 },
};

export default function PublicHome() {
  const { data: publicHome, loading, error } = useApi<PublicHomeData>('/api/citizen/home');
  const { data: citizenAlerts } = useApi<{ items: Array<{ id: number | string; type: string; message: string; severity: string; region: string; time?: string }> }>('/api/citizen/alerts');
  const activeAlerts = citizenAlerts?.items ?? publicHome?.activeAlerts ?? [];
  const nearbyResources = publicHome?.nearbyResources ?? [];
  const updates = publicHome?.updates ?? [];
  const stats = publicHome?.stats ?? publicStats;
  const mapMarkers = useMemo<MapMarker[]>(() => activeAlerts.map((alert) => {
    const regionName = Object.keys(regionCoordinates).find((region) => alert.region?.includes(region)) ?? 'Nationwide';
    const coordinates = regionCoordinates[regionName] ?? regionCoordinates.Nationwide;
    return {
      id: String(alert.id),
      name: alert.region || 'Nationwide',
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      value: alert.severity.toUpperCase(),
      detail: alert.message,
      severity: (alert.severity === 'high' || alert.severity === 'medium' || alert.severity === 'low') ? alert.severity : 'medium',
    };
  }), [activeAlerts]);

  return (
    <div className="space-y-8">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-zinc-800 rounded-xl">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">Stay Informed & Safe</h2>
            <p className="text-zinc-400">
              {publicHome?.summary ?? 'Loading current public advisories...'}
            </p>
          </div>
        </div>
      </div>

      {loading && <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">Loading public dashboard data...</div>}
      {error && <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">Public dashboard API unavailable: {error}</div>}

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = statIconMap[stat.icon as keyof typeof statIconMap] ?? Activity;
          const colour = statColours[stat.colour] ?? statColours.blue;

          return (
            <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className={`p-2 ${colour.bg} rounded-lg mb-3 inline-block`}><Icon className={`w-5 h-5 ${colour.text}`} /></div>
              <div className="text-2xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-zinc-400">{stat.label}</div>
            </div>
          );
        })}
      </div>

      {/* National heatmap */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-red-600" />
            National Alert Heatmap
          </h2>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500" />High Risk</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-500" />Moderate</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500" />Low Risk</span>
          </div>
        </div>
        <div className="h-[500px]">
          <SingaporeRegionMap markers={mapMarkers} />
        </div>
        <p className="text-xs text-zinc-500 mt-2">Hover or focus a region for current alert details. Regional status is linked to government crisis data.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Active alerts */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Active Alerts
            </h2>
            <div className="space-y-3">
              {activeAlerts.length === 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-800/60 p-4 text-sm text-zinc-500">
                  No active alerts right now. Check Alerts for current broadcasts and archived advisories.
                </div>
              )}
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${alert.severity === 'high' ? 'bg-red-950/30 border-red-800' : 'bg-yellow-950/30 border-yellow-800'}`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-5 h-5 mt-0.5 ${alert.severity === 'high' ? 'text-red-500' : 'text-yellow-500'}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{alert.type}</span>
                        <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded">{alert.region}</span>
                      </div>
                      <p className="text-sm text-zinc-300">{alert.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Link
              to="/public/alerts"
              className="mt-4 block text-center w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              View All Alerts
            </Link>
          </div>

          {/* Live updates */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Live Updates</h2>
            <div className="space-y-3">
              {updates.length === 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-800/60 p-4 text-sm text-zinc-500">
                  No live updates are currently published.
                </div>
              )}
              {updates.map((update, idx) => (
                <div key={idx} className="p-4 bg-zinc-800 rounded-lg">
                  <div className="text-xs text-zinc-500 mb-1">{update.time}</div>
                  <p className="text-sm">{update.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Nearby resources */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Nearby Resources
            </h2>
            <div className="space-y-3">
              {nearbyResources.map((resource, idx) => (
                <div key={idx} className="p-3 bg-zinc-800 rounded-lg">
                  <div className="flex items-start justify-between mb-1">
                    <div className="font-medium text-sm">{resource.name}</div>
                    <span className="text-xs px-2 py-0.5 bg-green-950 text-green-400 rounded">{resource.status}</span>
                  </div>
                  <div className="text-xs text-zinc-400 mb-2">{resource.type}</div>
                  <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <Navigation className="w-3 h-3" />{resource.distance}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Emergency actions */}
          <div className="bg-gradient-to-br from-red-950/50 to-orange-950/50 border border-red-900/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <Link to="/public/report" className="block w-full px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-center font-medium text-sm">
                Report an Issue
              </Link>
              <Link to="/public/volunteer" className="block w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-center font-medium text-sm">
                Volunteer to Help
              </Link>
              <a href="tel:995" className="block w-full px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-center font-medium text-sm">
                Emergency: Call 995
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-950/30 border border-blue-800 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
          <div className="text-sm text-zinc-300">
            <strong className="text-blue-400">Verified Information:</strong> All data on this platform is sourced from official government agencies and verified before publication. For urgent assistance, call <strong className="text-red-400">995</strong> (Emergency) or <strong className="text-blue-400">1777</strong> (Non-Emergency).
          </div>
        </div>
      </div>
    </div>
  );
}
