import { Camera, CheckCircle, Info, MapPin, Phone, Send, Shield } from 'lucide-react';
import { useState } from 'react';

export default function PublicReport() {
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [reportId, setReportId] = useState('');

  const handleSubmit = () => {
    const id = Math.floor(Math.random() * 90000 + 10000).toString();
    setReportId(id);
    setSubmitted(true);

    setTimeout(() => {
      setSubmitted(false);
      setReportType('');
      setDescription('');
      setReportId('');
    }, 5000);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold mb-2">Report an Issue</h1>
        <p className="text-zinc-400">Send incident information to SiGnal for public safety review</p>
      </div>

      <div className="bg-red-950/40 border border-red-800 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Phone className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-red-300 mb-1">Immediate Life-Threatening Emergency?</div>
            <p className="text-sm text-zinc-300 mb-3">
              Call emergency services directly. Reports submitted here are not a replacement for emergency calls.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href="tel:995" className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm font-medium">
                <Phone className="w-4 h-4" />Call 995
              </a>
              <a href="tel:1777" className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors text-sm">
                Non-Emergency: 1777
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-950/20 border border-blue-800/50 rounded-lg px-4 py-3 flex items-start gap-2 text-sm text-zinc-300">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <span>
          Use this report form for quick issue reporting. For formal follow-up and agency tracking, open a ticket from the Tickets section.
        </span>
      </div>

      {submitted && (
        <div className="bg-green-950/50 border border-green-800 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <div>
              <h3 className="font-semibold text-green-400 mb-1">Report Submitted</h3>
              <p className="text-sm text-zinc-300">
                Your report has been received. Reference ID: <span className="font-mono font-bold text-white">RPT-{reportId}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">Updates usually appear within 5-15 minutes if public action is required.</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-500" />
          Issue Report
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Incident Type</label>
            <select
              value={reportType}
              onChange={(event) => setReportType(event.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="">Select incident type...</option>
              <option value="flood">Flooding / Water Damage</option>
              <option value="health">Health / Medical Concern</option>
              <option value="supply">Supply Shortage Sighting</option>
              <option value="infrastructure">Infrastructure Issue</option>
              <option value="transport">Transport Disruption</option>
              <option value="environment">Environmental Hazard</option>
              <option value="other">Other / General Report</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what you observed - be as specific as possible..."
              rows={5}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Location</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter address, landmark, or postal code..."
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              />
              <button
                type="button"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 text-sm"
              >
                <MapPin className="w-4 h-4" />Auto-Detect
              </button>
            </div>
            <div className="mt-1.5 text-xs text-zinc-500 flex items-center gap-1">
              <Shield className="w-3 h-3" />Location data is used only for response coordination
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Upload Photos (Optional)</label>
            <label className="block border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center hover:border-zinc-600 transition-colors cursor-pointer">
              <Camera className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
              <p className="text-sm text-zinc-400 mb-1">Click to upload photos</p>
              <p className="text-xs text-zinc-600">Images help responders assess the situation quickly</p>
              <input type="file" accept="image/*" multiple className="hidden" />
            </label>
          </div>

          <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 text-xs text-zinc-400">
            <strong className="text-zinc-300">Note:</strong> False reports may delay response to real incidents.
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setReportType('');
                setDescription('');
              }}
              className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!reportType || !description.trim()}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Send className="w-4 h-4" />Submit Report
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="font-semibold mb-3 text-sm">Track Your Report</h3>
          <p className="text-sm text-zinc-400 mb-3">Enter your report reference ID to check basic status.</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="RPT-12345"
              className="min-w-0 flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
            />
            <button className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg">
              Check
            </button>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="font-semibold mb-3 text-sm">Emergency Hotlines</h3>
          <div className="space-y-2 text-sm">
            <Hotline label="Police / Ambulance / Fire" phone="995" colour="text-red-400" />
            <Hotline label="Police" phone="999" colour="text-blue-400" />
            <Hotline label="Crisis Hotline (24h)" phone="1767" colour="text-purple-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Hotline({ label, phone, colour }: { label: string; phone: string; colour: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-400">{label}</span>
      <a href={`tel:${phone}`} className={`${colour} font-bold hover:underline`}>{phone}</a>
    </div>
  );
}
