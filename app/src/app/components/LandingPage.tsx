import { Link } from 'react-router';
import { Shield, Users, AlertTriangle } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-red-950 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full text-center">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <Shield className="w-24 h-24 text-red-600" strokeWidth={1.5} />
            <div className="absolute inset-0 blur-xl bg-red-600/30"></div>
          </div>
        </div>

        <h1 className="text-6xl font-bold text-white mb-4 tracking-tight">
          <span className="text-red-600">S</span>i<span className="text-red-600">G</span>nal
        </h1>

        <p className="text-xl text-zinc-400 mb-12 max-w-2xl mx-auto">
          Singapore's National Adaptive Logistics & Alert Network
        </p>

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <Link
            to="/gov"
            className="group relative overflow-hidden bg-zinc-900/50 backdrop-blur border border-zinc-800 hover:border-red-600 rounded-2xl p-8 transition-all duration-300 hover:scale-105"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <AlertTriangle className="w-12 h-12 text-red-600 mb-4 mx-auto" />
            <h2 className="text-2xl font-semibold text-white mb-2">Government Access</h2>
            <p className="text-zinc-400 text-sm">National Crisis Command Centre</p>
          </Link>

          <Link
            to="/public"
            className="group relative overflow-hidden bg-zinc-900/50 backdrop-blur border border-zinc-800 hover:border-white rounded-2xl p-8 transition-all duration-300 hover:scale-105"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Users className="w-12 h-12 text-white mb-4 mx-auto" />
            <h2 className="text-2xl font-semibold text-white mb-2">Public Access</h2>
            <p className="text-zinc-400 text-sm">Citizen Emergency Companion</p>
          </Link>
        </div>

        <div className="mt-16 text-zinc-600 text-sm">
          Trusted by Government Agencies • Serving All Citizens
        </div>
      </div>
    </div>
  );
}
