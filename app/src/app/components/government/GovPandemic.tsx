import { Activity, AlertTriangle, Database, MapPin, TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import SingaporeRegionMap, { type MapMarker } from '../SingaporeRegionMap';
import dashboardData from '../../../data/dashboard-data.json';

const dengue = dashboardData.health.dengue;

function severity(cases: number): MapMarker['severity'] {
  if (cases >= 10) return 'high';
  if (cases >= 3) return 'medium';
  return 'low';
}

const markers: MapMarker[] = dengue.clusters.map((cluster, index) => ({
  id: `dengue-${index}`,
  name: cluster.name,
  latitude: cluster.latitude,
  longitude: cluster.longitude,
  value: `${cluster.cases} cases`,
  detail: `${cluster.homes} homes and ${cluster.publicPlaces} public places recorded`,
  severity: severity(cluster.cases),
}));

const totalCases = dengue.clusters.reduce((sum, cluster) => sum + cluster.cases, 0);
const largestCluster = [...dengue.clusters].sort((a, b) => b.cases - a.cases)[0];
const latestHistory = dengue.history.at(-1);

export default function GovPandemic() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Health / Diseases</h1>
        <p className="text-zinc-400">Current dengue clusters and published infectious-disease history</p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-900/60 bg-blue-950/20 p-4 text-sm">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
        <div>
          <div className="font-medium text-blue-300">Official data snapshot</div>
          <p className="mt-1 text-zinc-400">
            Cluster locations are from NEA&apos;s active dengue-cluster GeoJSON. The trend uses the latest
            available MOH Weekly Infectious Disease Bulletin records and is historical, not a live case forecast.
          </p>
          <a className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300" href={dengue.source.url} target="_blank" rel="noreferrer">
            {dengue.source.label}
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Active clusters', value: dengue.clusters.length, icon: MapPin },
          { label: 'Cases in mapped clusters', value: totalCases, icon: Activity },
          { label: 'Largest active cluster', value: largestCluster?.cases ?? 0, icon: AlertTriangle },
          { label: `Historical ${latestHistory?.period ?? 'week'}`, value: latestHistory?.cases ?? 0, icon: TrendingUp },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <Icon className="mb-3 h-5 w-5 text-red-500" />
            <div className="text-2xl font-bold">{value}</div>
            <div className="mt-1 text-sm text-zinc-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MapPin className="h-5 w-5 text-red-500" />
            Active Dengue Clusters
          </h2>
          <span className="text-xs text-zinc-500">Snapshot refreshed {new Date(dashboardData.generatedAt).toLocaleString()}</span>
        </div>
        <div className="h-[500px]">
          <SingaporeRegionMap
            markers={markers}
            emptyTitle="NEA active dengue clusters"
            emptyDetail="Hover a cluster marker for published case details"
            problemLabel="active dengue clusters"
          />
        </div>
        <div className="mt-3 flex gap-4 text-xs text-zinc-500">
          <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-red-500" />10+ cases</span>
          <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" />3-9 cases</span>
          <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />1-2 cases</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 lg:col-span-2">
          <h2 className="mb-1 text-lg font-semibold">MOH Published Dengue History</h2>
          <p className="mb-4 text-xs text-zinc-500">Latest 12 records available in the historical bulletin dataset</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dengue.history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="period" stroke="#71717a" tick={{ fontSize: 11 }} />
              <YAxis stroke="#71717a" />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
              <Line type="monotone" dataKey="cases" stroke="#dc2626" strokeWidth={2} name="Cases" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">Largest Current Clusters</h2>
          <div className="space-y-3">
            {[...dengue.clusters].sort((a, b) => b.cases - a.cases).slice(0, 6).map((cluster) => (
              <div key={`${cluster.name}-${cluster.longitude}`} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="flex justify-between gap-3">
                  <span className="text-sm font-medium">{cluster.name}</span>
                  <span className="font-bold text-red-400">{cluster.cases}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">{cluster.homes} homes · {cluster.publicPlaces} public places</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
