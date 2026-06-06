import { History, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';

const historicalCrises = [
  {
    name: '2023 Dengue Outbreak',
    date: 'June - August 2023',
    severity: 'High',
    outcome: 'Successfully contained',
    lessonsLearned: [
      'Early cluster detection reduced spread by 34%',
      'Community engagement programs improved compliance by 45%',
      'Resource pre-positioning cut response time by 2.5 days',
    ],
    effectiveness: 87,
  },
  {
    name: '2022 Flash Floods',
    date: 'December 2022',
    severity: 'Medium',
    outcome: 'Managed with minimal disruption',
    lessonsLearned: [
      'Enhanced drainage monitoring prevented overflow in 12 locations',
      'Public transport rerouting protocols improved commute times by 18%',
      'Real-time alerts reduced property damage by 23%',
    ],
    effectiveness: 82,
  },
  {
    name: '2021 Haze Crisis',
    date: 'September - October 2021',
    severity: 'High',
    outcome: 'Effectively mitigated health impacts',
    lessonsLearned: [
      'N95 mask distribution to vulnerable groups reduced hospital visits by 31%',
      'Air quality advisories via mobile apps reached 89% of population',
      'School closure protocols minimized student exposure',
    ],
    effectiveness: 79,
  },
];

export default function GovHistoricalAnalysis() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Historical Crisis Analysis</h1>
        <p className="text-zinc-400">Past response effectiveness and lessons learned</p>
      </div>

      <div className="bg-gradient-to-r from-indigo-950/50 to-purple-950/50 border border-indigo-900/50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-900/50 rounded-lg">
            <History className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Historical Data Repository</h3>
            <p className="text-sm text-zinc-300">
              This section provides detailed analysis of past crises, response effectiveness, and actionable insights to improve future preparedness. All data is verified and cross-referenced with official government records.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {historicalCrises.map((crisis, idx) => (
          <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{crisis.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-zinc-400">
                    <span>{crisis.date}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      crisis.severity === 'High' ? 'bg-red-950 text-red-400' : 'bg-yellow-950 text-yellow-400'
                    }`}>
                      {crisis.severity} Severity
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-950 border border-green-800 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">{crisis.outcome}</span>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-zinc-400 mb-3">Key Lessons Learned</h4>
                <div className="space-y-2">
                  {crisis.lessonsLearned.map((lesson, lessonIdx) => (
                    <div key={lessonIdx} className="flex items-start gap-2 text-sm text-zinc-300">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{lesson}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-zinc-400">Response Effectiveness Score</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-zinc-800 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${crisis.effectiveness}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold">{crisis.effectiveness}%</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors text-sm">
                  View Full Timeline
                </button>
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-sm">
                  Export Report
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-950/30 border border-blue-800 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
          <div className="text-sm text-zinc-300">
            <strong className="text-blue-400">Usage Note:</strong> Historical analysis data is used to train AI recommendation models and inform current crisis response protocols. Regular reviews ensure best practices are incorporated into operational procedures.
          </div>
        </div>
      </div>
    </div>
  );
}
