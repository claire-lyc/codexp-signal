import { Activity, AlertTriangle, Database, MapPin, TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSearchParams } from 'react-router';
import SingaporeRegionMap, { type MapMarker } from '../SingaporeRegionMap';
import { useApi } from '../../lib/api';

type CrisisId = 'covid' | 'dengue' | 'hantavirus';
type Severity = 'high' | 'medium' | 'low';

type CrisisOption = {
  id: CrisisId;
  label: string;
  severity: Severity;
  color: string;
  badge: string;
  border: string;
};

type SimulatedCrisis = {
  description: string;
  stats: { label: string; value: string; delta?: string; icon: 'red' | 'orange' | 'green' | 'yellow' }[];
  clusters: Array<{
    name: string;
    cases: number;
    severity: Severity;
    latitude: number;
    longitude: number;
    detail: string;
  }>;
  trendData: { date: string; cases: number; icu: number }[];
  ppeStock: { item: string; stock: number; status: 'good' | 'medium' | 'low' }[];
  projection: string;
  confidence: string;
  dataSources: string;
  mapNote: string;
  source?: { label: string; url: string };
};

const crisisOptions: CrisisOption[] = [
  { id: 'covid', label: 'Covid-19', severity: 'medium', color: 'text-orange-400', badge: 'bg-orange-900 text-orange-400', border: 'border-orange-700' },
  { id: 'dengue', label: 'Dengue', severity: 'high', color: 'text-red-400', badge: 'bg-red-900 text-red-400', border: 'border-red-700' },
  { id: 'hantavirus', label: 'Hantavirus', severity: 'low', color: 'text-blue-400', badge: 'bg-blue-900 text-blue-400', border: 'border-blue-700' },
];

const simulatedCrisisData: Record<Exclude<CrisisId, 'dengue'>, SimulatedCrisis> = {
  covid: {
    description: 'Covid-19 archive - Historical cluster locations published by MOH in April 2020. These are not current active clusters.',
    stats: [
      { label: 'Archived clusters mapped', value: '5', icon: 'red' },
      { label: 'Largest listed cluster', value: '306', icon: 'orange' },
      { label: 'Archive period', value: 'Apr 2020', icon: 'green' },
      { label: 'Current-status use', value: 'No', icon: 'yellow' },
    ],
    clusters: [
      { name: 'S11 Dormitory @ Punggol', cases: 306, severity: 'high', latitude: 1.4127, longitude: 103.9103, detail: 'MOH cluster total reported on 10 April 2020' },
      { name: 'Westlite Toh Guan Dormitory', cases: 69, severity: 'high', latitude: 1.3277, longitude: 103.7467, detail: 'MOH cluster total reported on 10 April 2020' },
      { name: 'Mustafa Centre', cases: 57, severity: 'medium', latitude: 1.3098, longitude: 103.8551, detail: 'MOH cluster total reported on 9 April 2020' },
      { name: 'Toh Guan Dormitory', cases: 25, severity: 'medium', latitude: 1.3285, longitude: 103.7461, detail: 'MOH cluster total reported on 9 April 2020' },
      { name: 'NUH renovation site', cases: 14, severity: 'low', latitude: 1.2942, longitude: 103.7832, detail: 'New MOH cluster reported on 10 April 2020' },
    ],
    trendData: [
      { date: 'Apr 6', cases: 66, icu: 0 },
      { date: 'Apr 8', cases: 142, icu: 0 },
      { date: 'Apr 9', cases: 287, icu: 0 },
      { date: 'Apr 10', cases: 198, icu: 0 },
    ],
    ppeStock: [
      { item: 'N95 Masks', stock: 78, status: 'good' },
      { item: 'Surgical Masks', stock: 92, status: 'good' },
      { item: 'Gloves', stock: 65, status: 'medium' },
      { item: 'Gowns', stock: 45, status: 'low' },
      { item: 'Face Shields', stock: 88, status: 'good' },
    ],
    projection: 'Archived cluster geography is provided for historical comparison only. It must not be used to infer present-day COVID-19 transmission or operational risk.',
    confidence: 'Official archive',
    dataSources: 'MOH press releases',
    mapNote: 'Historical cluster totals published by MOH on 9-10 April 2020. Locations are mapped from the addresses named in those releases.',
    source: {
      label: 'MOH: 198 new cases and cluster links, 10 April 2020',
      url: 'https://www.moh.gov.sg/newsroom/32-more-cases-discharged-198-new-cases-of-covid-19-infection-confirmed/',
    },
  },
  hantavirus: {
    description: 'Hantavirus scenario - Operational monitoring zones only. No official Singapore cluster feed is connected.',
    stats: [
      { label: 'Scenario Signals', value: '4', delta: '', icon: 'red' },
      { label: 'Under Observation', value: '18', delta: '+3', icon: 'orange' },
      { label: 'Official Cases Feed', value: 'None', delta: '', icon: 'green' },
      { label: 'Risk Zones', value: '3', delta: '', icon: 'yellow' },
    ],
    clusters: [
      { name: 'Lim Chu Kang monitoring zone', cases: 2, severity: 'medium', latitude: 1.434, longitude: 103.702, detail: 'Scenario signal near agricultural and rodent-exposure environments' },
      { name: 'Seletar monitoring zone', cases: 1, severity: 'low', latitude: 1.409, longitude: 103.868, detail: 'Scenario signal for response-planning exercises' },
      { name: 'Choa Chu Kang monitoring zone', cases: 1, severity: 'low', latitude: 1.385, longitude: 103.744, detail: 'Scenario signal for response-planning exercises' },
    ],
    trendData: [
      { date: 'May 13', cases: 1, icu: 0 },
      { date: 'May 14', cases: 1, icu: 0 },
      { date: 'May 15', cases: 2, icu: 1 },
      { date: 'May 16', cases: 2, icu: 1 },
      { date: 'May 17', cases: 3, icu: 1 },
      { date: 'May 18', cases: 3, icu: 1 },
      { date: 'May 19', cases: 4, icu: 1 },
    ],
    ppeStock: [
      { item: 'Protective Suits', stock: 92, status: 'good' },
      { item: 'Ribavirin Stock', stock: 88, status: 'good' },
    ],
    projection: 'This scenario supports map and response-workflow testing. It does not represent confirmed cases, community spread, or an official public-health assessment.',
    confidence: 'Scenario only',
    dataSources: 'Operational exercise data',
    mapNote: 'Locations are illustrative monitoring zones and are not confirmed hantavirus clusters.',
  },
};

const severityColors: Record<Severity, string> = {
  high: 'bg-red-950/30 border-red-800',
  medium: 'bg-yellow-950/30 border-yellow-800',
  low: 'bg-blue-950/30 border-blue-800',
};

const iconColors: Record<SimulatedCrisis['stats'][number]['icon'], { bg: string; text: string }> = {
  red: { bg: 'bg-red-950', text: 'text-red-500' },
  orange: { bg: 'bg-orange-950', text: 'text-orange-500' },
  green: { bg: 'bg-green-950', text: 'text-green-500' },
  yellow: { bg: 'bg-yellow-950', text: 'text-yellow-500' },
};

function severity(cases: number): MapMarker['severity'] {
  if (cases >= 10) return 'high';
  if (cases >= 3) return 'medium';
  return 'low';
}

function descriptionClasses(crisisId: CrisisId) {
  if (crisisId === 'dengue') return 'bg-red-950/20 border-red-800 text-red-300';
  if (crisisId === 'covid') return 'bg-yellow-950/20 border-yellow-800 text-yellow-300';
  return 'bg-blue-950/20 border-blue-800 text-blue-300';
}

function SimulatedDiseaseDashboard({ crisisId }: { crisisId: Exclude<CrisisId, 'dengue'> }) {
  const crisis = crisisOptions.find((item) => item.id === crisisId)!;
  const data = simulatedCrisisData[crisisId];
  const markers: MapMarker[] = data.clusters.map((cluster, index) => ({
    id: `${crisisId}-${index}`,
    name: cluster.name,
    latitude: cluster.latitude,
    longitude: cluster.longitude,
    value: `${cluster.cases} ${crisisId === 'covid' ? 'archived cases' : 'scenario signals'}`,
    detail: cluster.detail,
    severity: cluster.severity,
  }));

  return (
    <>
      <div className={`rounded-lg border px-4 py-3 text-sm ${descriptionClasses(crisisId)}`}>
        <AlertTriangle className="mr-2 inline h-4 w-4 opacity-70" />
        {data.description}
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-900/60 bg-blue-950/20 p-4 text-sm">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
        <div>
          <div className="font-medium text-blue-300">{crisisId === 'covid' ? 'Archived government data' : 'Scenario map'}</div>
          <p className="mt-1 text-zinc-400">{data.mapNote}</p>
          {data.source ? (
            <a className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300" href={data.source.url} target="_blank" rel="noreferrer">
              {data.source.label}
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {data.stats.map((stat) => {
          const icon = iconColors[stat.icon];
          return (
            <div key={stat.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className={`rounded-lg p-2 ${icon.bg}`}>
                  <Activity className={`h-5 w-5 ${icon.text}`} />
                </div>
                {stat.delta && (
                  <span className={`text-xs ${stat.delta.includes('+') ? 'text-red-400' : 'text-zinc-400'}`}>{stat.delta}</span>
                )}
              </div>
              <div className="mb-1 text-2xl font-bold">{stat.value}</div>
              <div className="text-sm text-zinc-400">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MapPin className="h-5 w-5 text-red-600" />
            Location Map - {crisis.label}
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-red-500" />High</div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-yellow-500" />Medium</div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-green-500" />Low</div>
          </div>
        </div>
        <div className="h-[500px]">
          <SingaporeRegionMap
            markers={markers}
            emptyTitle={`${crisis.label} locations`}
            emptyDetail="Hover a marker for location details"
            problemLabel={crisisId === 'covid' ? 'archived clusters' : 'scenario signals'}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500">{data.mapNote}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">{crisisId === 'covid' ? 'MOH Daily Case Archive' : 'Scenario Trend'}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" />
              <YAxis stroke="#71717a" />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
              <Line type="monotone" dataKey="cases" stroke="#dc2626" strokeWidth={2} name="Daily Cases" />
              {crisisId === 'hantavirus' ? <Line type="monotone" dataKey="icu" stroke="#f97316" strokeWidth={2} name="Observed patients" /> : null}
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 flex justify-center gap-6 text-sm">
            <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-red-600" /><span className="text-zinc-400">Daily Cases</span></div>
            {crisisId === 'hantavirus' ? <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-orange-600" /><span className="text-zinc-400">Observed patients</span></div> : null}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">{crisisId === 'covid' ? 'Archived Clusters' : 'Monitoring Zones'}</h2>
          <div className="space-y-3">
            {data.clusters.map((cluster) => (
              <div key={cluster.name} className={`rounded-lg border p-4 ${severityColors[cluster.severity]}`}>
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-zinc-400" />
                    <span className="text-sm font-medium">{cluster.name}</span>
                  </div>
                  <span className="text-xl font-bold">{cluster.cases}</span>
                </div>
                <div className="text-xs text-zinc-400">{crisisId === 'covid' ? 'Cases in archived MOH cluster total' : 'Scenario signals in monitoring zone'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">Resource Stock Levels</h2>
          <div className="space-y-4">
            {data.ppeStock.map((item) => (
              <div key={item.item}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm">{item.item}</span>
                  <span className="text-sm font-semibold">{item.stock}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800">
                  <div
                    className={`h-2 rounded-full ${item.status === 'good' ? 'bg-green-600' : item.status === 'medium' ? 'bg-yellow-600' : 'bg-red-600'}`}
                    style={{ width: `${item.stock}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-blue-900/50 bg-gradient-to-r from-zinc-950/60 to-blue-950/50 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-blue-900/50 p-3">
              <AlertTriangle className="h-6 w-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="mb-2 font-semibold">Data Projection - {crisis.label}</h3>
              <p className="mb-3 text-sm text-zinc-300">{data.projection}</p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Confidence Level</span>
                  <span className="rounded bg-zinc-800 px-2 py-1">{data.confidence}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Data Sources</span>
                  <span className="rounded bg-zinc-800 px-2 py-1">{data.dataSources}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Human Verification</span>
                  <span className="rounded bg-yellow-900 px-2 py-1 text-yellow-400">Required</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DengueDashboard({ dashboardData, loading, error }: { dashboardData: any; loading: boolean; error: string | null }) {
  const dengue = dashboardData?.health?.dengue;

  if (loading) return <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">Loading dengue dashboard data...</div>;
  if (error || !dengue) return <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">Health dashboard API unavailable: {error ?? 'missing dengue data'}</div>;

  const markers: MapMarker[] = dengue.clusters.map((cluster: any, index: number) => ({
    id: `dengue-${index}`,
    name: cluster.name,
    latitude: cluster.latitude,
    longitude: cluster.longitude,
    value: `${cluster.cases} cases`,
    detail: `${cluster.homes ?? 0} homes and ${cluster.publicPlaces ?? 0} public places recorded`,
    severity: severity(cluster.cases),
  }));
  const totalCases = dengue.clusters.reduce((sum: number, cluster: any) => sum + cluster.cases, 0);
  const largestCluster = [...dengue.clusters].sort((a: any, b: any) => b.cases - a.cases)[0];
  const latestHistory = dengue.history.at(-1);
  const redZones = dengue.clusters.filter((cluster: any) => cluster.cases >= 10).length;

  return (
    <>
      <div className={`rounded-lg border px-4 py-3 text-sm ${descriptionClasses('dengue')}`}>
        <AlertTriangle className="mr-2 inline h-4 w-4 opacity-70" />
        Dengue - Colour-coded zones: Red (10+ cases/cluster), Yellow (3-9), Blue (1-2). Live cluster locations use the latest available NEA snapshot.
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
          { label: 'Red zones', value: redZones, icon: AlertTriangle },
          { label: 'Cases in mapped clusters', value: totalCases, icon: Activity },
          { label: 'Active clusters', value: dengue.clusters.length, icon: MapPin },
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
            Active Cluster Map - Dengue
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
                <div className="mt-1 text-xs text-zinc-500">{cluster.homes ?? 0} homes - {cluster.publicPlaces ?? 0} public places</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">Vector Control Supplies</h2>
          <div className="space-y-4">
            {[
              { item: 'Repellent Stock', stock: 72, status: 'medium' },
              { item: 'Larvicide', stock: 58, status: 'low' },
              { item: 'Blood Test Kits', stock: 85, status: 'good' },
            ].map((item) => (
              <div key={item.item}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm">{item.item}</span>
                  <span className="text-sm font-semibold">{item.stock}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800">
                  <div
                    className={`h-2 rounded-full ${item.status === 'good' ? 'bg-green-600' : item.status === 'medium' ? 'bg-yellow-600' : 'bg-red-600'}`}
                    style={{ width: `${item.stock}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-blue-900/50 bg-gradient-to-r from-zinc-950/60 to-blue-950/50 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-blue-900/50 p-3">
              <AlertTriangle className="h-6 w-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="mb-2 font-semibold">Data Projection - Dengue</h3>
              <p className="mb-3 text-sm text-zinc-300">
                Dengue cluster expansion should be watched around the largest active clusters. Recommend targeted vector-control outreach and community reporting in high-case neighbourhoods.
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Confidence Level</span>
                  <span className="rounded bg-zinc-800 px-2 py-1">79%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Data Sources</span>
                  <span className="rounded bg-zinc-800 px-2 py-1">NEA, MOH, LTA</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Human Verification</span>
                  <span className="rounded bg-yellow-900 px-2 py-1 text-yellow-400">Required</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function GovPandemic() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDisease = searchParams.get('disease');
  const selectedCrisis: CrisisId =
    requestedDisease === 'covid' || requestedDisease === 'dengue' || requestedDisease === 'hantavirus'
      ? requestedDisease
      : 'dengue';
  const { data: dashboardData, loading, error } = useApi<any>('/api/dashboard/cached-external');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Health & Diseases</h1>
        <p className="text-zinc-400">Real-time monitoring and healthcare coordination by disease type</p>
      </div>

      <div className="flex overflow-x-auto border-b border-zinc-800" role="tablist" aria-label="Disease dashboards">
        {crisisOptions.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selectedCrisis === item.id}
            onClick={() => setSearchParams({ disease: item.id })}
            className={`flex min-w-max items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              selectedCrisis === item.id
                ? `${item.color} border-current`
                : 'border-transparent text-zinc-500 hover:text-zinc-200'
            }`}
          >
            {item.label}
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${item.badge}`}>{item.severity.toUpperCase()}</span>
          </button>
        ))}
      </div>

      {selectedCrisis === 'dengue' ? (
        <DengueDashboard dashboardData={dashboardData} loading={loading} error={error} />
      ) : (
        <SimulatedDiseaseDashboard crisisId={selectedCrisis} />
      )}
    </div>
  );
}
