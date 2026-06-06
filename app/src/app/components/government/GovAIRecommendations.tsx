// GET /api/recommendations?crisisType=
import { useState } from 'react';
import { Brain, CheckCircle, AlertTriangle, Globe, TrendingUp, Filter } from 'lucide-react';

const allRecommendations = [
  {
    id: 1,
    category: 'Health',
    agency: 'MOH',
    action: 'Activate additional ICU capacity in eastern hospitals',
    reasoning: 'Case trend analysis shows 15–20% increase projected in next 5 days. Historical data from similar outbreaks suggests preemptive capacity expansion reduces mortality by 12–18%.',
    confidence: 87,
    urgency: 'high',
    region: 'East',
    sources: ['MOH Case Data', 'Hospital Utilization Logs', 'Singapore 2023 Outbreak Study'],
    comparison: 'South Korea implemented similar measures 3 days ahead of peak, reducing overflow by 23%',
  },
  {
    id: 2,
    category: 'Supply Chain',
    agency: 'Enterprise SG',
    action: 'Initiate emergency medicine procurement from alternate suppliers',
    reasoning: 'Current Panadol Menstrual depletion rate indicates critical shortage in 4–14 days. Diversifying import sources reduces single-point failure risk.',
    confidence: 91,
    urgency: 'high',
    region: 'Nationwide',
    sources: ['Supply Chain Analytics', 'Import Dependency Map', 'WHO Guidelines'],
    comparison: 'Taiwan maintains 3-source minimum for critical medicines, reducing supply disruptions by 67%',
  },
  {
    id: 3,
    category: 'Weather',
    agency: 'PUB',
    action: 'Issue flood advisories and activate drainage reinforcement in Orchard and East Coast',
    reasoning: 'Rainfall pattern matches historical flood events from 2018. Soil saturation at 78%, indicating high runoff risk in identified zones.',
    confidence: 78,
    urgency: 'high',
    region: 'Central, East',
    sources: ['NEA Weather Models', 'PUB Drainage Data', '2018 Flood Analysis'],
    comparison: 'Netherlands uses similar predictive models with 82% accuracy in flood prevention',
  },
  {
    id: 4,
    category: 'Health',
    agency: 'NEA',
    action: 'Deploy targeted dengue fogging operations in Bedok North and Pasir Ris',
    reasoning: 'Two high-severity dengue clusters detected in East region with 40+ combined cases. Population density increases vector spread risk.',
    confidence: 83,
    urgency: 'medium',
    region: 'East',
    sources: ['NEA Dengue Surveillance', 'MOH Case Reports', 'Population Density Data'],
    comparison: 'Malaysia reduced cluster spread by 34% with preemptive fogging within 48h of detection',
  },
  {
    id: 5,
    category: 'Cybersecurity',
    agency: 'CSA',
    action: 'Patch identified vulnerability in critical infrastructure networks',
    reasoning: 'Active threat detected targeting port authority systems. Similar vector was exploited in 2024 regional incidents.',
    confidence: 95,
    urgency: 'medium',
    region: 'Nationwide',
    sources: ['CSA Threat Intelligence', 'Interpol Cyber Advisory', 'Internal Network Scans'],
    comparison: 'Australia neutralised similar threats within 6h using coordinated patch deployment',
  },
];

const categories = ['All', 'Health', 'Supply Chain', 'Weather', 'Cybersecurity', 'Infrastructure'];
const agencyOptions = ['All Agencies', 'MOH', 'NEA', 'PUB', 'LTA', 'Enterprise SG', 'CSA'];
const severities = ['All', 'high', 'medium', 'low'];
const regions = ['All', 'Nationwide', 'East', 'West', 'Central', 'North', 'South'];

const urgencyStyles: Record<string, string> = {
  high: 'bg-red-900 text-red-400',
  medium: 'bg-yellow-900 text-yellow-400',
  low: 'bg-blue-900 text-blue-400',
};

const categoryStyles: Record<string, string> = {
  Health: 'bg-green-900/50 text-green-400',
  'Supply Chain': 'bg-yellow-900/50 text-yellow-400',
  Weather: 'bg-blue-900/50 text-blue-400',
  Cybersecurity: 'bg-red-900/50 text-red-400',
  Infrastructure: 'bg-purple-900/50 text-purple-400',
};

export default function GovAIRecommendations() {
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterAgency, setFilterAgency] = useState('All Agencies');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterRegion, setFilterRegion] = useState('All');
  const [dismissed, setDismissed] = useState<number[]>([]);

  const filtered = allRecommendations.filter((r) => {
    if (dismissed.includes(r.id)) return false;
    if (filterCategory !== 'All' && r.category !== filterCategory) return false;
    if (filterAgency !== 'All Agencies' && r.agency !== filterAgency) return false;
    if (filterSeverity !== 'All' && r.urgency !== filterSeverity) return false;
    if (filterRegion !== 'All' && !r.region.includes(filterRegion)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Data Projections</h1>
        <p className="text-zinc-400">Analyst-supported insights, recommended actions, and data-driven crisis response guidance</p>
      </div>

      <div className="bg-gradient-to-r from-purple-950/50 to-blue-950/50 border border-purple-900/50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-900/50 rounded-lg"><Brain className="w-6 h-6 text-purple-400" /></div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">About Data Projections</h3>
            <p className="text-sm text-zinc-300">
              All projections are generated from verified data sources and validated against historical outcomes from Singapore and international responses. Insights are supported by human analysts, data scientists, and mathematical models. Each recommendation requires human approval before implementation.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="text-sm font-medium">Filter Recommendations</span>
          <span className="text-xs text-zinc-500 ml-auto">{filtered.length} showing</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Crisis Type</label>
            <div className="flex flex-wrap gap-1">
              {categories.map((c) => (
                <button key={c} onClick={() => setFilterCategory(c)} className={`px-2 py-0.5 rounded text-xs transition-colors ${filterCategory === c ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Agency</label>
            <select value={filterAgency} onChange={(e) => setFilterAgency(e.target.value)} className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-red-600">
              {agencyOptions.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Severity</label>
            <div className="flex gap-1">
              {severities.map((s) => (
                <button key={s} onClick={() => setFilterSeverity(s)} className={`px-2 py-0.5 rounded text-xs transition-colors ${filterSeverity === s ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>{s === 'All' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Region</label>
            <div className="flex flex-wrap gap-1">
              {regions.map((r) => (
                <button key={r} onClick={() => setFilterRegion(r)} className={`px-2 py-0.5 rounded text-xs transition-colors ${filterRegion === r ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>{r}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center text-zinc-500">
          No recommendations match your filters.
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((rec) => (
          <div key={rec.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-1 rounded ${categoryStyles[rec.category] || 'bg-zinc-800 text-zinc-400'}`}>{rec.category.toUpperCase()}</span>
                    <span className={`text-xs px-2 py-1 rounded ${urgencyStyles[rec.urgency]}`}>{rec.urgency.toUpperCase()} PRIORITY</span>
                    <span className="text-xs px-2 py-1 bg-zinc-800 text-zinc-400 rounded">Agency: {rec.agency}</span>
                    <span className="text-xs px-2 py-1 bg-zinc-800 text-zinc-400 rounded">Region: {rec.region}</span>
                  </div>
                  <h3 className="text-lg font-semibold">{rec.action}</h3>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Analyst Reasoning & Data Analysis</h4>
                  <p className="text-sm text-zinc-300">{rec.reasoning}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-zinc-400 mb-2">Verified Data Sources</h4>
                    <div className="space-y-1">
                      {rec.sources.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                          <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />{s}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-zinc-400 mb-2">International Comparison</h4>
                    <div className="flex items-start gap-2">
                      <Globe className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-zinc-300">{rec.comparison}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-zinc-400">Confidence: {rec.confidence}%</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-yellow-950 border border-yellow-800 rounded">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs text-yellow-400">Human Approval Required</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDismissed((d) => [...d, rec.id])} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors text-sm">Dismiss</button>
                    <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />Approve & Implement
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-950/30 border border-blue-800 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-400 mt-0.5" />
          <div className="text-sm text-zinc-300">
            <strong className="text-blue-400">Note:</strong> All data projections are advisory only. Final decisions require human oversight and approval. Projections consider cascading impacts, historical precedents, international comparisons, and resource constraints. Wording reflects analyst-supported modelling, not deterministic AI prediction.
          </div>
        </div>
      </div>
    </div>
  );
}
