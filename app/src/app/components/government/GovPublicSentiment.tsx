// GET /api/sentiment?topic=&crisisType=
// GET /api/tickets?agency=&status= (linked to Form Handling)
import { useState } from 'react';
import { MessageSquare, AlertTriangle, CheckCircle, TrendingUp, Shield, ExternalLink, Twitter, Radio, Users } from 'lucide-react';
import { Link } from 'react-router';

const crisisTopicSets: Record<string, { topic: string; sentiment: string; score: number; trend: string; source: string }[]> = {
  health: [
    { topic: 'Covid-19 Response', sentiment: 'positive', score: 72, trend: 'up', source: 'Social Media / Forum' },
    { topic: 'Medicine Availability (Panadol)', sentiment: 'negative', score: 38, trend: 'down', source: 'Citizen Reports / Tweets' },
    { topic: 'Hospital Wait Times', sentiment: 'neutral', score: 52, trend: 'stable', source: 'Forum / Reviews' },
    { topic: 'Dengue Prevention Info', sentiment: 'positive', score: 68, trend: 'up', source: 'Social Media' },
  ],
  weather: [
    { topic: 'Flood Preparedness', sentiment: 'neutral', score: 60, trend: 'up', source: 'Social Media' },
    { topic: 'Haze Advisories', sentiment: 'positive', score: 74, trend: 'up', source: 'Forum' },
    { topic: 'Public Transport Disruption', sentiment: 'negative', score: 41, trend: 'down', source: 'Twitter / Citizen Reports' },
  ],
  supply: [
    { topic: 'Panadol Shortage Anxiety', sentiment: 'negative', score: 29, trend: 'down', source: 'Twitter / WhatsApp' },
    { topic: 'Government Communication', sentiment: 'neutral', score: 56, trend: 'stable', source: 'Forum / Survey' },
    { topic: 'Essential Supply Status', sentiment: 'positive', score: 71, trend: 'up', source: 'Official Channels' },
  ],
};

const misinfoQueue = [
  { id: 1, claim: 'Hospitals running out of beds', status: 'flagged', priority: 'high', source: 'Twitter', crisisType: 'health', reports: 347 },
  { id: 2, claim: 'Water supply contaminated in Jurong', status: 'verified-false', priority: 'high', source: 'WhatsApp', crisisType: 'health', reports: 892 },
  { id: 3, claim: 'Border closure imminent next week', status: 'under-review', priority: 'medium', source: 'Forum', crisisType: 'health', reports: 124 },
  { id: 4, claim: 'Panadol shortage is permanent', status: 'flagged', priority: 'medium', source: 'Social Media', crisisType: 'supply', reports: 203 },
];

const socialSources = [
  { platform: 'Twitter / X', posts: 12450, sentiment: 'mixed', trending: '#Singapore #Dengue #Panadol' },
  { platform: 'Citizen Reports', posts: 3287, sentiment: 'concerned', trending: 'Supply, Flood, Health' },
  { platform: 'Community Forum (SiGnal)', posts: 876, sentiment: 'moderate', trending: 'Transport, Haze' },
  { platform: 'WhatsApp Forwarded', posts: 5100, sentiment: 'anxious', trending: 'Misinformation detected' },
];

const crisisFilters = [
  { id: 'health', label: 'Health' },
  { id: 'weather', label: 'Weather' },
  { id: 'supply', label: 'Supply Chain' },
];

export default function GovPublicSentiment() {
  const [activeCrisis, setActiveCrisis] = useState('health');
  const sentimentData = crisisTopicSets[activeCrisis];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Public Sentiment Analysis</h1>
        <p className="text-zinc-400">Social monitoring, misinformation detection, and public anxiety tracking — linked to Form Handling and Citizen Forum</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-950 rounded-lg"><MessageSquare className="w-5 h-5 text-green-500" /></div>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold mb-1">59%</div>
          <div className="text-sm text-zinc-400">Overall Sentiment Score</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-red-950 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
            <span className="text-xs px-2 py-1 bg-red-950 text-red-400 rounded">Active</span>
          </div>
          <div className="text-2xl font-bold mb-1">47</div>
          <div className="text-sm text-zinc-400">Misinformation Flagged</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-yellow-950 rounded-lg"><Shield className="w-5 h-5 text-yellow-500" /></div>
            <span className="text-xs px-2 py-1 bg-yellow-950 text-yellow-400 rounded">Review</span>
          </div>
          <div className="text-2xl font-bold mb-1">12</div>
          <div className="text-sm text-zinc-400">Pending Verification</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-950 rounded-lg"><Users className="w-5 h-5 text-blue-500" /></div>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold mb-1">Medium</div>
          <div className="text-sm text-zinc-400">Public Anxiety Level</div>
        </div>
      </div>

      {/* Social media source breakdown */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Radio className="w-5 h-5 text-blue-500" />
          Social Media & Citizen Report Sources
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {socialSources.map((src) => (
            <div key={src.platform} className="bg-zinc-800 rounded-lg p-4">
              <div className="font-medium text-sm mb-2">{src.platform}</div>
              <div className="text-2xl font-bold mb-1">{src.posts.toLocaleString()}</div>
              <div className="text-xs text-zinc-400 mb-2">posts / reports</div>
              <div className="text-xs text-zinc-500">Sentiment: <span className="text-zinc-300">{src.sentiment}</span></div>
              <div className="text-xs text-zinc-500 mt-1">Trending: <span className="text-zinc-300">{src.trending}</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* Dynamic topic analysis — linked to active crisis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Topic Sentiment by Crisis</h2>
            <div className="flex gap-1">
              {crisisFilters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveCrisis(f.id)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${activeCrisis === f.id ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-zinc-500 mb-4">Topics auto-adjust based on most prevalent active crises.</p>
          <div className="space-y-4">
            {sentimentData.map((item) => (
              <div key={item.topic}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm">{item.topic}</span>
                    <div className="text-xs text-zinc-500">{item.source}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{item.score}%</span>
                    {item.trend === 'up' ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : item.trend === 'down' ? (
                      <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />
                    ) : (
                      <div className="w-4 h-0.5 bg-zinc-500" />
                    )}
                  </div>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${item.sentiment === 'positive' ? 'bg-green-600' : item.sentiment === 'neutral' ? 'bg-yellow-600' : 'bg-red-600'}`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Misinformation Queue</h2>
            <Link to="/gov/form-handling" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
              <ExternalLink className="w-3 h-3" />
              View in Form Handling
            </Link>
          </div>
          <div className="space-y-3">
            {misinfoQueue.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border ${item.priority === 'high' ? 'bg-red-950/30 border-red-800' : 'bg-yellow-950/30 border-yellow-800'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-medium mb-1 text-sm">{item.claim}</div>
                    <div className="text-xs text-zinc-400">Source: {item.source} · {item.reports.toLocaleString()} reports</div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded whitespace-nowrap ml-2 ${
                      item.status === 'flagged' ? 'bg-red-900 text-red-400' :
                      item.status === 'verified-false' ? 'bg-green-900 text-green-400' :
                      'bg-yellow-900 text-yellow-400'
                    }`}
                  >
                    {item.status === 'flagged' ? 'AI FLAGGED' : item.status === 'verified-false' ? 'VERIFIED FALSE' : 'UNDER REVIEW'}
                  </span>
                </div>
                {item.status === 'flagged' && (
                  <Link
                    to="/gov/form-handling"
                    className="mt-2 w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Route to Form Handler for Verification
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Links to Citizen Forum */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <div className="font-medium mb-1">Linked to Citizen Community Forum</div>
              <p className="text-sm text-zinc-400">Sentiment analysis also draws from citizen-submitted posts in the SiGnal Community Forum. Agency-specific ticket handling is controlled by role-based permissions.</p>
            </div>
          </div>
          <a href="/public/forum" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap transition-colors">
            <ExternalLink className="w-3 h-3" />
            View Forum
          </a>
        </div>
      </div>

      {/* AI/data summary */}
      <div className="bg-gradient-to-r from-purple-950/50 to-pink-950/50 border border-purple-900/50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-900/50 rounded-lg"><AlertTriangle className="w-6 h-6 text-purple-400" /></div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Analyst-Supported Sentiment Summary</h3>
            <p className="text-sm text-zinc-300 mb-3">
              Increasing public concern regarding Panadol Menstrual shortage and dengue cluster expansion. Recommend proactive communication campaign to address misinformation and clarify supply status. 47 flagged instances require human verification before public correction.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="px-2 py-1 bg-zinc-800 rounded">Confidence: 76%</span>
              <span className="px-2 py-1 bg-zinc-800 rounded">Sources: Twitter, Citizen Reports, Forum</span>
              <span className="px-2 py-1 bg-yellow-900 text-yellow-400 rounded">Human Approval Required</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
