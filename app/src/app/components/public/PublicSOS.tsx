// POST /api/citizen/reports
import { MapPin, Camera, Send, Phone, Shield, CheckCircle, Info } from 'lucide-react';
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
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold mb-2">Report an Issue</h1>
        <p className="text-zinc-400">Submit a non-emergency incident report to help coordinate a response</p>
      </div>

      {/* Emergency hotline notice */}
      <div className="bg-red-950/40 border border-red-800 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Phone className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-red-300 mb-1">Immediate Life-Threatening Emergency?</div>
            <p className="text-sm text-zinc-300 mb-3">
              If you or someone around you is in immediate danger — call emergency services directly. Do not use this form for life-threatening situations.
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

      {/* About this form */}
      <div className="bg-blue-950/20 border border-blue-800/50 rounded-lg px-4 py-3 flex items-start gap-2 text-sm text-zinc-300">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <span>This form is for reporting incidents, submitting location information, and sharing images to help authorities coordinate a response. Reports are reviewed by government handlers and may be escalated to the relevant agency.</span>
      </div>

      {submitted && (
        <div className="bg-green-950/50 border border-green-800 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <div>
              <h3 className="font-semibold text-green-400 mb-1">Report Submitted</h3>
              <p className="text-sm text-zinc-300">
                Your report has been received and is being reviewed. Track it with Report ID: <span className="font-mono font-bold text-white">RPT-{reportId}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-5">Submit Crisis Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Incident Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
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
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you observed — be as specific as possible..."
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
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4" />Auto-Detect
              </button>
            </div>
            <div className="mt-1.5 text-xs text-zinc-500 flex items-center gap-1">
              <Shield className="w-3 h-3" />Location data is used only for emergency response coordination
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Upload Photos (Optional)</label>
            <div className="border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center hover:border-zinc-600 transition-colors cursor-pointer">
              <Camera className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
              <p className="text-sm text-zinc-400 mb-1">Click to upload photos</p>
              <p className="text-xs text-zinc-600">Images help responders assess the situation quickly</p>
              <input type="file" accept="image/*" multiple className="hidden" />
            </div>
          </div>

          <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 text-xs text-zinc-400">
            <strong className="text-zinc-300">Note:</strong> All reports are reviewed by government authorities before action is taken. Submission of false reports is a legal offence. Your report will typically be reviewed within 5–15 minutes.
          </div>

          <div className="flex gap-3 pt-2">
            <button className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Send className="w-4 h-4" />Submit Report
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="font-semibold mb-3 text-sm">Track Your Report</h3>
          <p className="text-sm text-zinc-400 mb-3">Enter your Report ID to check the status of a previously submitted report.</p>
          <input
            type="text"
            placeholder="RPT-XXXXX"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
          />
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="font-semibold mb-3 text-sm">Emergency Hotlines</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Police / Ambulance / Fire</span>
              <a href="tel:995" className="text-red-400 font-bold hover:underline">995</a>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Non-Emergency Police</span>
              <a href="tel:1800-255-0000" className="text-blue-400 hover:underline">1800-255-0000</a>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Crisis Hotline (24h)</span>
              <a href="tel:1767" className="text-purple-400 hover:underline">1767</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
