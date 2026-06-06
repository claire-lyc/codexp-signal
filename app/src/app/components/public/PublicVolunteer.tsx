import { Users, Shield, Upload, Calendar, MapPin, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { useState } from 'react';

const volunteerOpportunities = [
  {
    id: 1,
    title: 'Healthcare Volunteers Needed',
    organization: 'Ministry of Health',
    location: 'Jurong West',
    urgency: 'high',
    volunteers: 12,
    needed: 25,
    skills: ['Healthcare', 'First Aid'],
    description: 'Assist with patient care and health screening at temporary care facilities.',
  },
  {
    id: 2,
    title: 'Logistics Support Required',
    organization: 'Singapore Red Cross',
    location: 'Tampines',
    urgency: 'medium',
    volunteers: 8,
    needed: 15,
    skills: ['Logistics', 'Driving'],
    description: 'Help distribute essential supplies to affected communities.',
  },
  {
    id: 3,
    title: 'Community Support Volunteers',
    organization: 'People\'s Association',
    location: 'Ang Mo Kio',
    urgency: 'low',
    volunteers: 20,
    needed: 20,
    skills: ['Community Outreach'],
    description: 'Provide community support and assistance to elderly residents.',
  },
];

export default function PublicVolunteer() {
  const [authenticated, setAuthenticated] = useState(false);
  const [registered, setRegistered] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Volunteer & Support</h1>
        <p className="text-zinc-400">Help your community during times of crisis</p>
      </div>

      {!authenticated && (
        <div className="bg-gradient-to-r from-blue-950/50 to-purple-950/50 border border-blue-900/50 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-900/50 rounded-lg">
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Singpass Authentication Required</h3>
              <p className="text-sm text-zinc-300 mb-4">
                To sign up as a volunteer or donate to crisis relief efforts, please authenticate using Singpass. This ensures all volunteers are verified Singapore residents.
              </p>
              <button
                onClick={() => setAuthenticated(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Login with Singpass
              </button>
            </div>
          </div>
        </div>
      )}

      {authenticated && !registered && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Register as a Volunteer
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Full Name</label>
                <input
                  type="text"
                  placeholder="As per NRIC"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Contact Number</label>
                <input
                  type="tel"
                  placeholder="+65 XXXX XXXX"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Skills & Qualifications</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {['Healthcare', 'First Aid', 'Logistics', 'Driving', 'IT Support', 'Community Outreach', 'Translation'].map((skill) => (
                  <button
                    key={skill}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-blue-600 rounded transition-colors text-sm"
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Preferred Region</label>
              <select className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600">
                <option value="">Select region...</option>
                <option value="central">Central</option>
                <option value="north">North</option>
                <option value="south">South</option>
                <option value="east">East</option>
                <option value="west">West</option>
                <option value="any">Any Region</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Availability</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {['Weekdays', 'Weekends', 'Evenings', 'Emergency Only'].map((time) => (
                  <button
                    key={time}
                    className="px-3 py-2 bg-zinc-800 hover:bg-blue-600 rounded transition-colors text-sm"
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Upload Certifications (Optional)</label>
              <div className="border-2 border-dashed border-zinc-700 rounded-lg p-4 text-center hover:border-zinc-600 transition-colors cursor-pointer">
                <Upload className="w-6 h-6 text-zinc-500 mx-auto mb-2" />
                <p className="text-sm text-zinc-400">Upload certificates (First Aid, Medical License, etc.)</p>
                <input type="file" accept=".pdf,.jpg,.png" multiple className="hidden" />
              </div>
            </div>

            <div className="bg-yellow-950/30 border border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                <div className="text-sm text-zinc-300">
                  <strong className="text-yellow-400">Verification Required:</strong> All volunteer applications undergo verification by government authorities. You will receive confirmation within 24-48 hours. Skills and certifications will be verified before deployment.
                </div>
              </div>
            </div>

            <button
              onClick={() => setRegistered(true)}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
            >
              Submit Registration
            </button>
          </div>
        </div>
      )}

      {registered && (
        <div className="bg-green-950/50 border border-green-800 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <div>
              <h3 className="font-semibold text-green-400 mb-1">Registration Submitted</h3>
              <p className="text-sm text-zinc-300">
                Your volunteer application is under review. You'll be notified once verified (typically within 24-48 hours).
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Current Volunteer Opportunities</h2>
        <div className="space-y-4">
          {volunteerOpportunities.map((opp) => (
            <div
              key={opp.id}
              className={`border rounded-lg p-5 ${
                opp.urgency === 'high'
                  ? 'bg-red-950/20 border-red-800'
                  : opp.urgency === 'medium'
                  ? 'bg-yellow-950/20 border-yellow-800'
                  : 'bg-green-950/20 border-green-800'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-1">{opp.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-zinc-400 mb-2">
                    <span>{opp.organization}</span>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{opp.location}</span>
                    </div>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    opp.urgency === 'high'
                      ? 'bg-red-900 text-red-400'
                      : opp.urgency === 'medium'
                      ? 'bg-yellow-900 text-yellow-400'
                      : 'bg-green-900 text-green-400'
                  }`}
                >
                  {opp.urgency === 'high' ? 'URGENT' : opp.urgency === 'medium' ? 'NEEDED' : 'ONGOING'}
                </span>
              </div>

              <p className="text-sm text-zinc-300 mb-3">{opp.description}</p>

              <div className="flex flex-wrap gap-2 mb-3">
                {opp.skills.map((skill) => (
                  <span key={skill} className="text-xs px-2 py-1 bg-zinc-800 text-zinc-300 rounded">
                    {skill}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-700">
                <div className="text-sm text-zinc-400">
                  {opp.volunteers}/{opp.needed} volunteers assigned
                </div>
                <button
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm"
                  disabled={!authenticated}
                >
                  {authenticated ? 'Apply Now' : 'Login to Apply'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            Your Volunteer Schedule
          </h2>
          {authenticated && registered ? (
            <div className="space-y-3">
              <div className="p-4 bg-zinc-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Healthcare Support</div>
                  <span className="text-xs px-2 py-1 bg-blue-950 text-blue-400 rounded">Upcoming</span>
                </div>
                <div className="text-sm text-zinc-400">May 22, 2026 • 2:00 PM - 6:00 PM</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Register and get verified to see your volunteer shifts.</p>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Donate to Crisis Relief</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Support communities affected by crises. All donations are managed by verified NGOs and government agencies.
          </p>
          <button
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            disabled={!authenticated}
          >
            {authenticated ? 'Make a Donation' : 'Login to Donate'}
          </button>
        </div>
      </div>
    </div>
  );
}
