import { AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

const pastEmergencies = [
  { title: 'Flash Flood Warning', note: 'Archived on Jun 5' },
  { title: 'Dengue Red Zone', note: 'Archived on Jun 5' },
  { title: 'MRT East-West Line Disruption', note: 'Resolved on Jun 4' },
  { title: 'Haze Advisory', note: 'Lifted on Jun 3' },
];

export default function EmergencySnapshot({ portal }: { portal: 'public' | 'gov' }) {
  const href = portal === 'public' ? '/public/alerts' : '/gov/broadcast';

  return (
    <section className="border-b border-zinc-800 bg-zinc-900/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-800 bg-red-950/50 px-2.5 py-1 text-xs font-medium text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Current emergencies: none
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pastEmergencies.map((item) => (
            <span key={item.title} className="inline-flex items-center gap-1.5 rounded-lg border border-green-900/70 bg-green-950/30 px-2.5 py-1 text-xs text-green-300">
              <CheckCircle className="h-3.5 w-3.5" />
              {item.title} - {item.note}
            </span>
          ))}
          <Link to={href} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-blue-300 hover:bg-zinc-800">
            View details
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
