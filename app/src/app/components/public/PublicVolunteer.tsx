import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  ClipboardCheck,
  Clock,
  FileCheck,
  Loader2,
  MapPin,
  Shield,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  clearVolunteerProfile,
  makeVolunteerId,
  opportunityCapacity,
  readVolunteerOpportunities,
  readVolunteerNotifications,
  readVolunteerProfile,
  saveVolunteerProfile,
  scoreVolunteerBreakdown,
  scoreVolunteerForOpportunity,
  statusLabel,
  volunteerAvailability,
  volunteerSkills,
  type VolunteerAssignment,
  type VolunteerNotification,
  type VolunteerOpportunity,
  type VolunteerProfile,
} from '../../lib/volunteerFlow';

type FormState = {
  name: string;
  phone: string;
  email: string;
  region: string;
  skills: string[];
  availability: string[];
  certifications: string;
  emergencyContact: string;
};

const emptyForm: FormState = {
  name: '',
  phone: '',
  email: '',
  region: '',
  skills: [],
  availability: [],
  certifications: '',
  emergencyContact: '',
};

const lifecycle = [
  { label: 'Register', icon: ClipboardCheck },
  { label: 'Verify', icon: FileCheck },
  { label: 'Match', icon: Users },
  { label: 'Assign', icon: UserCheck },
  { label: 'Serve', icon: CheckCircle },
];

export default function PublicVolunteer() {
  const [authenticated, setAuthenticated] = useState(false);
  const [profile, setProfile] = useState<VolunteerProfile | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [opportunityTab, setOpportunityTab] = useState<'available' | 'unavailable'>('available');
  const [pageTab, setPageTab] = useState<'volunteer' | 'donate'>('volunteer');
  const [opportunities, setOpportunities] = useState<VolunteerOpportunity[]>(() => readVolunteerOpportunities());
  const [notifications, setNotifications] = useState<VolunteerNotification[]>(() => readVolunteerNotifications());

  useEffect(() => {
    const saved = readVolunteerProfile();
    if (saved) {
      setAuthenticated(true);
      setProfile(saved);
      setForm({
        name: saved.name,
        phone: saved.phone,
        email: saved.email,
        region: saved.region,
        skills: saved.skills,
        availability: saved.availability,
        certifications: saved.certifications,
        emergencyContact: saved.emergencyContact,
      });
    }

    const refreshNeeds = () => setOpportunities(readVolunteerOpportunities());
    const refreshNotifications = () => setNotifications(readVolunteerNotifications());
    window.addEventListener('storage', refreshNeeds);
    window.addEventListener('storage', refreshNotifications);
    window.addEventListener('signal-volunteer-needs-updated', refreshNeeds);
    window.addEventListener('signal-volunteer-notifications-updated', refreshNotifications);
    return () => {
      window.removeEventListener('storage', refreshNeeds);
      window.removeEventListener('storage', refreshNotifications);
      window.removeEventListener('signal-volunteer-needs-updated', refreshNeeds);
      window.removeEventListener('signal-volunteer-notifications-updated', refreshNotifications);
    };
  }, []);

  const rankedOpportunities = useMemo(() => {
    const candidate = profile ?? {
      skills: form.skills,
      region: form.region || 'Any Region',
      availability: form.availability,
    };
    return opportunities
      .map((opportunity) => ({
        ...opportunity,
        match: scoreVolunteerForOpportunity(candidate, opportunity),
        matchBreakdown: scoreVolunteerBreakdown(candidate, opportunity),
        assigned: profile?.assignments.find((assignment) => assignment.opportunityId === opportunity.id),
        applied: profile?.appliedOpportunityIds.includes(opportunity.id) ?? false,
        filled: opportunityCapacity(opportunity, profile),
      }))
      .sort((a, b) => b.match - a.match);
  }, [form.availability, form.region, form.skills, opportunities, profile]);

  const activeAssignment = profile?.assignments.find((assignment) => assignment.status !== 'completed' && assignment.status !== 'declined') ?? null;
  const myNotifications = profile ? notifications.filter((notification) => notification.volunteerId === profile.id) : [];

  const currentStepIndex = useMemo(() => {
    if (!authenticated) return -1;
    if (!profile) return 0;
    if (profile.status === 'pending_review') return 1;
    if (activeAssignment?.status === 'offered' || activeAssignment?.status === 'accepted') return 3;
    if (activeAssignment?.status === 'checked_in') return 4;
    return 2;
  }, [activeAssignment?.status, authenticated, profile]);

  const toggleValue = (field: 'skills' | 'availability', value: string) => {
    setForm((current) => {
      const selected = current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value];
      return { ...current, [field]: selected };
    });
  };

  const submitRegistration = () => {
    const nextErrors = [];
    if (!form.name.trim()) nextErrors.push('Full name is required.');
    if (!form.phone.trim()) nextErrors.push('Contact number is required.');
    if (!form.region) nextErrors.push('Choose a preferred region.');
    if (!form.skills.length) nextErrors.push('Select at least one skill.');
    if (!form.availability.length) nextErrors.push('Select at least one availability window.');
    setErrors(nextErrors);
    if (nextErrors.length) return;

    setSubmitting(true);
    window.setTimeout(() => {
      const nextProfile: VolunteerProfile = {
        id: makeVolunteerId(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        region: form.region,
        skills: form.skills,
        availability: form.availability,
        certifications: form.certifications.trim(),
        emergencyContact: form.emergencyContact.trim(),
        status: 'pending_review',
        registeredAt: new Date().toISOString(),
        appliedOpportunityIds: [],
        assignments: [],
      };
      saveVolunteerProfile(nextProfile);
      setProfile(nextProfile);
      setSubmitting(false);
      setMessage('Registration submitted. Government operators can now review and assign you from the volunteer console.');
    }, 600);
  };

  const quickVerify = () => {
    if (!profile) return;
    const nextProfile = { ...profile, status: 'verified' as const };
    saveVolunteerProfile(nextProfile);
    setProfile(nextProfile);
    setMessage('Demo verification complete. You can now apply for matched opportunities.');
  };

  const applyForOpportunity = (opportunityId: number) => {
    if (!profile) return;
    const nextProfile = {
      ...profile,
      status: profile.status === 'pending_review' ? profile.status : 'verified' as const,
      appliedOpportunityIds: Array.from(new Set([...profile.appliedOpportunityIds, opportunityId])),
    };
    saveVolunteerProfile(nextProfile);
    setProfile(nextProfile);
    setMessage('Application sent to the coordinating agency for assignment.');
  };

  const acceptAssignment = (assignment: VolunteerAssignment) => updateAssignment(assignment.id, 'accepted', 'Shift accepted. Reporting details are now shown in your schedule.');
  const declineAssignment = (assignment: VolunteerAssignment) => updateAssignment(assignment.id, 'declined', 'Assignment declined. You can keep browsing other opportunities.');
  const checkIn = (assignment: VolunteerAssignment) => updateAssignment(assignment.id, 'checked_in', 'Checked in. Your agency coordinator can see that you are on site.');
  const completeShift = (assignment: VolunteerAssignment) => updateAssignment(assignment.id, 'completed', 'Shift completed. Thank you for supporting the response.');

  const continueVolunteering = () => {
    if (!profile) return;
    const nextProfile: VolunteerProfile = {
      ...profile,
      status: 'verified',
    };
    saveVolunteerProfile(nextProfile);
    setProfile(nextProfile);
    setOpportunityTab('available');
    setMessage('You are back in the verified pool and can apply for more opportunities.');
  };

  const resetDemoProfile = () => {
    clearVolunteerProfile();
    setAuthenticated(false);
    setProfile(null);
    setForm(emptyForm);
    setErrors([]);
    setMessage('');
    setOpportunityTab('available');
  };

  const goBackStep = () => {
    if (!profile) {
      setAuthenticated(false);
      return;
    }
    if (activeAssignment) {
      setMessage('Back to matching. Your active assignment details remain available on the right.');
      return;
    }
    setOpportunityTab('available');
    setMessage('Back to matching. You can browse available opportunities.');
  };

  const updateAssignment = (assignmentId: string, status: VolunteerAssignment['status'], nextMessage: string) => {
    if (!profile) return;
    const nextProfile: VolunteerProfile = {
      ...profile,
      status: status === 'checked_in' ? 'checked_in' : status === 'completed' ? 'completed' : status === 'declined' ? 'verified' : 'assigned',
      assignments: profile.assignments.map((assignment) => assignment.id === assignmentId ? { ...assignment, status } : assignment),
    };
    saveVolunteerProfile(nextProfile);
    setProfile(nextProfile);
    setMessage(nextMessage);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Volunteer & Support</h1>
          <p className="text-zinc-400">Verify your readiness once, then respond when agencies need your skills.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-1">
            <button onClick={() => setPageTab('volunteer')} className={`rounded-md px-3 py-1.5 text-sm ${pageTab === 'volunteer' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Volunteer</button>
            <button onClick={() => setPageTab('donate')} className={`rounded-md px-3 py-1.5 text-sm ${pageTab === 'donate' ? 'bg-green-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Donate</button>
          </div>
          {profile && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm">
              <div className="text-zinc-500">Volunteer ID</div>
              <div className="font-mono text-zinc-100">{profile.id}</div>
            </div>
          )}
        </div>
      </div>

      {pageTab === 'donate' && <DonationPanel authenticated={authenticated} onLogin={() => setAuthenticated(true)} />}

      {pageTab === 'volunteer' && (
        <>
      <button onClick={goBackStep} className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="grid gap-3 md:grid-cols-5">
        {lifecycle.map((item, index) => {
          const Icon = item.icon;
          const isActive = index <= currentStepIndex;
          return (
            <div key={item.label} className={`rounded-lg border p-3 ${isActive ? 'border-blue-800 bg-blue-950/30 text-blue-200' : 'border-zinc-800 bg-zinc-900 text-zinc-500'}`}>
              <Icon className="mb-2 h-5 w-5" />
              <div className="text-sm font-medium">{item.label}</div>
            </div>
          );
        })}
      </div>

      {!authenticated && (
        <section className="rounded-xl border border-blue-900/50 bg-blue-950/20 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-blue-900/50 p-3">
              <Shield className="h-6 w-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="mb-2 font-semibold">Singpass Authentication Required</h2>
              <p className="mb-4 text-sm text-zinc-300">Sign in to create a verified readiness profile. Agencies can then match you to future needs based on your experience.</p>
              <button onClick={() => setAuthenticated(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium transition-colors hover:bg-blue-700">
                <Shield className="h-4 w-4" />
                Login with Singpass
              </button>
            </div>
          </div>
        </section>
      )}

      {authenticated && !profile && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Users className="h-5 w-5 text-blue-400" />Create Readiness Profile</h2>
            <p className="mt-1 text-sm text-zinc-500">This is for prior verification. You do not need to choose a live assignment yet.</p>
          </div>
          <div className="space-y-5 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="As per NRIC" />
              <Field label="Contact Number" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} placeholder="+65 XXXX XXXX" />
              <Field label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} placeholder="Optional" />
              <Field label="Emergency Contact" value={form.emergencyContact} onChange={(value) => setForm({ ...form, emergencyContact: value })} placeholder="+65 XXXX XXXX" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Preferred Region</label>
              <select value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600">
                <option value="">Select region...</option>
                {['Central', 'North', 'South', 'East', 'West', 'Any Region'].map((region) => <option key={region}>{region}</option>)}
              </select>
            </div>

            <ToggleGroup title="Skills & Qualifications" values={volunteerSkills} selected={form.skills} onToggle={(skill) => toggleValue('skills', skill)} />
            <ToggleGroup title="Availability" values={volunteerAvailability} selected={form.availability} onToggle={(slot) => toggleValue('availability', slot)} />

            <div>
              <label className="mb-2 block text-sm font-medium">Experience & Certification Notes</label>
              <textarea value={form.certifications} onChange={(event) => setForm({ ...form, certifications: event.target.value })} placeholder="Past volunteering, first aid, driving licence, medical registration, language capability..." rows={3} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>

            <label className="block cursor-pointer rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-950/40 p-4 text-center transition-colors hover:border-zinc-600">
              <Upload className="mx-auto mb-2 h-6 w-6 text-zinc-500" />
              <div className="text-sm text-zinc-400">Optional certificate upload placeholder</div>
              <input type="file" accept=".pdf,.jpg,.png" multiple className="hidden" />
            </label>

            {errors.length > 0 && (
              <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
                {errors.map((error) => <div key={error}>{error}</div>)}
              </div>
            )}

            <div className="rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-zinc-300">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-500" />
                <div><strong className="text-yellow-400">Verification first:</strong> Agencies review your experience before deployment. Once verified, you can view live opportunities and agencies can call you for matching needs.</div>
              </div>
            </div>

            <button onClick={submitRegistration} disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium transition-colors hover:bg-blue-700 disabled:opacity-60">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Submit for Verification
            </button>
          </div>
        </section>
      )}

      {profile && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            <StatusPanel profile={profile} activeAssignment={activeAssignment} onVerify={quickVerify} onContinue={continueVolunteering} onReset={resetDemoProfile} />
            <NotificationPanel notifications={myNotifications} opportunities={opportunities} />
            {message && <div className="rounded-lg border border-green-800 bg-green-950/40 p-3 text-sm text-green-300">{message}</div>}
            <OpportunityList profile={profile} opportunities={rankedOpportunities} tab={opportunityTab} setTab={setOpportunityTab} onApply={applyForOpportunity} />
          </section>
          <aside className="space-y-4">
            <ScheduleCard profile={profile} assignment={activeAssignment} onAccept={acceptAssignment} onDecline={declineAssignment} onCheckIn={checkIn} onComplete={completeShift} />
          </aside>
        </div>
      )}
        </>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600" />
    </div>
  );
}

function ToggleGroup({ title, values, selected, onToggle }: { title: string; values: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{title}</label>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <button key={value} type="button" onClick={() => onToggle(value)} className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${selected.includes(value) ? 'border-blue-500 bg-blue-600/20 text-blue-200' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600'}`}>
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusPanel({
  profile,
  activeAssignment,
  onVerify,
  onContinue,
  onReset,
}: {
  profile: VolunteerProfile;
  activeAssignment: VolunteerAssignment | null;
  onVerify: () => void;
  onContinue: () => void;
  onReset: () => void;
}) {
  const pending = profile.status === 'pending_review';
  const completedCount = profile.assignments.filter((assignment) => assignment.status === 'completed').length;
  return (
    <div className={`rounded-xl border p-5 ${pending ? 'border-yellow-800 bg-yellow-950/20' : 'border-green-800 bg-green-950/20'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {pending ? <Clock className="mt-0.5 h-6 w-6 text-yellow-400" /> : <CheckCircle className="mt-0.5 h-6 w-6 text-green-400" />}
          <div>
            <h2 className="font-semibold">{activeAssignment ? statusLabel(profile.status) : pending ? 'Pending review' : 'Verified readiness profile'}</h2>
            <p className="text-sm text-zinc-300">
              {pending
                ? 'Your readiness profile is queued for review. Demo mode lets you fast-forward verification.'
                : activeAssignment
                ? 'You have an active agency offer or assignment. You can still browse other opportunities below.'
                : completedCount
                ? `You completed ${completedCount} assignment${completedCount > 1 ? 's' : ''}. You can keep browsing or reset the demo.`
                : 'You are verified. You can access live opportunities and agencies can match you to future calls.'}
            </p>
          </div>
        </div>
        {profile.assignments.some((assignment) => assignment.status === 'declined') && (
          <div className="rounded-lg border border-red-900/70 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            One recent application was not selected. You can still browse and apply for other roles.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {pending && <button onClick={onVerify} className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-yellow-700">Demo verify</button>}
          {!pending && !activeAssignment && completedCount > 0 && <button onClick={onContinue} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-700">Continue volunteering</button>}
          <button onClick={onReset} className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700">Start over</button>
        </div>
      </div>
    </div>
  );
}

function NotificationPanel({ notifications, opportunities }: { notifications: VolunteerNotification[]; opportunities: VolunteerOpportunity[] }) {
  if (!notifications.length) return null;

  return (
    <div className="rounded-xl border border-blue-800 bg-blue-950/20 p-5">
      <h2 className="mb-3 font-semibold">Agency Call-Back Requests</h2>
      <div className="space-y-2">
        {notifications.map((notification) => {
          const opportunity = opportunities.find((item) => item.id === notification.opportunityId);
          return (
            <div key={notification.id} className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">{notification.agency} requested your help</div>
                <span className="rounded bg-blue-900 px-2 py-0.5 text-xs text-blue-200">{notification.status}</span>
              </div>
              <div className="text-sm text-zinc-300">{notification.message}</div>
              <div className="mt-2 text-xs text-zinc-500">{opportunity?.title ?? 'Volunteer opportunity'}{notification.roleTitle ? ` - ${notification.roleTitle}` : ''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OpportunityList({
  profile,
  opportunities,
  tab,
  setTab,
  onApply,
}: {
  profile: VolunteerProfile;
  opportunities: Array<VolunteerOpportunity & {
    match: number;
    matchBreakdown: { skills: number; region: number; availability: number; total: number };
    assigned?: VolunteerAssignment;
    applied: boolean;
    filled: number;
  }>;
  tab: 'available' | 'unavailable';
  setTab: (tab: 'available' | 'unavailable') => void;
  onApply: (id: number) => void;
}) {
  const available = opportunities.filter((opportunity) => opportunity.filled < opportunity.needed);
  const unavailable = opportunities.filter((opportunity) => opportunity.filled >= opportunity.needed);
  const visible = tab === 'available' ? available : unavailable;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Matched Opportunities</h2>
          <p className="text-xs text-zinc-500">Match = skills 50 pts, region 30 pts, availability 20 pts.</p>
        </div>
        <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
          <button onClick={() => setTab('available')} className={`rounded-md px-3 py-1.5 text-sm ${tab === 'available' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Available ({available.length})</button>
          <button onClick={() => setTab('unavailable')} className={`rounded-md px-3 py-1.5 text-sm ${tab === 'unavailable' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Unavailable ({unavailable.length})</button>
        </div>
      </div>
      <div className="space-y-4">
        {visible.map((opportunity) => {
          const canApply = profile.status !== 'pending_review' && !opportunity.applied && !opportunity.assigned && opportunity.filled < opportunity.needed;
          return (
            <div key={opportunity.id} className={`rounded-lg border p-5 ${opportunity.urgency === 'high' ? 'border-red-800 bg-red-950/20' : opportunity.urgency === 'medium' ? 'border-yellow-800 bg-yellow-950/20' : 'border-green-800 bg-green-950/20'}`}>
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{opportunity.title}</h3>
                    <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{opportunity.match}% match</span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
                    <span>{opportunity.organization}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{opportunity.location}</span>
                    <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" />{opportunity.shift}</span>
                  </div>
                </div>
                <span className={`rounded px-2 py-1 text-xs ${opportunity.urgency === 'high' ? 'bg-red-900 text-red-300' : opportunity.urgency === 'medium' ? 'bg-yellow-900 text-yellow-300' : 'bg-green-900 text-green-300'}`}>{opportunity.urgency.toUpperCase()}</span>
              </div>
              <p className="mb-3 text-sm text-zinc-300">{opportunity.description}</p>
              <div className="mb-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
                <div className="rounded bg-zinc-900/70 px-2 py-1">Skills: {opportunity.matchBreakdown.skills}/50</div>
                <div className="rounded bg-zinc-900/70 px-2 py-1">Region: {opportunity.matchBreakdown.region}/30</div>
                <div className="rounded bg-zinc-900/70 px-2 py-1">Availability: {opportunity.matchBreakdown.availability}/20</div>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {opportunity.requiredSkills.map((skill) => <span key={skill} className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{skill}</span>)}
              </div>
              <div className="mb-3 space-y-2">
                {opportunity.roleSlots.map((role) => (
                  <div key={role.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">{role.title}</div>
                      <div className="text-xs text-zinc-500">{role.assigned}/{role.needed} slots</div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {role.requiredSkills.map((skill) => <span key={skill} className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">{skill}</span>)}
                    </div>
                    {role.specialRequirements && <div className="mt-2 text-xs text-yellow-300">Special: {role.specialRequirements}</div>}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 border-t border-zinc-800 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-zinc-400">{opportunity.filled}/{opportunity.needed} volunteers assigned</div>
                {opportunity.assigned ? (
                  <span className={`rounded-lg px-3 py-2 text-sm ${opportunity.assigned.status === 'declined' ? 'bg-red-950 text-red-300' : 'bg-green-950 text-green-300'}`}>
                    {opportunity.assigned.status === 'declined' ? 'Not selected for this role' : `Assignment ${opportunity.assigned.status}`}
                  </span>
                ) : opportunity.applied ? (
                  <span className="rounded-lg bg-blue-950 px-3 py-2 text-sm text-blue-300">Applied, awaiting agency assignment</span>
                ) : (
                  <button onClick={() => onApply(opportunity.id)} disabled={!canApply} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500">
                    {profile.status === 'pending_review' ? 'Verification required' : opportunity.filled >= opportunity.needed ? 'Fully staffed' : 'Apply for Assignment'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!visible.length && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-5 text-sm text-zinc-500">
            {tab === 'available' ? 'No open volunteer slots right now.' : 'No fully staffed opportunities yet.'}
          </div>
        )}
      </div>
    </div>
  );
}

function ScheduleCard({
  profile,
  assignment,
  onAccept,
  onDecline,
  onCheckIn,
  onComplete,
}: {
  profile: VolunteerProfile;
  assignment: VolunteerAssignment | null;
  onAccept: (assignment: VolunteerAssignment) => void;
  onDecline: (assignment: VolunteerAssignment) => void;
  onCheckIn: (assignment: VolunteerAssignment) => void;
  onComplete: (assignment: VolunteerAssignment) => void;
}) {
  const opportunity = assignment ? readVolunteerOpportunities().find((item) => item.id === assignment.opportunityId) : null;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Calendar className="h-5 w-5 text-purple-400" />Assignment Details</h2>
      {!assignment || !opportunity ? (
        <p className="text-sm text-zinc-400">{profile.status === 'pending_review' ? 'Get verified first. Assignment details appear here after an agency offer.' : 'No accepted assignment yet. Details will appear here after an agency offer.'}</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
            <div className="mb-1 font-semibold">{opportunity.title}</div>
            {assignment.roleTitle && <div className="mb-1 text-sm text-blue-300">{assignment.roleTitle}</div>}
            <div className="text-sm text-zinc-400">{opportunity.shift}</div>
            <div className="mt-2 text-sm text-zinc-300">{opportunity.reportingPoint}</div>
            <div className="mt-3 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">Status: {assignment.status}</div>
          </div>
          {assignment.status === 'offered' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => onAccept(assignment)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700">Accept Assignment</button>
              <button onClick={() => onDecline(assignment)} className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-600">Reject</button>
            </div>
          )}
          {assignment.status === 'accepted' && <button onClick={() => onCheckIn(assignment)} className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-700">Check In On Site</button>}
          {assignment.status === 'checked_in' && <button onClick={() => onComplete(assignment)} className="w-full rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-600">Mark Shift Complete</button>}
        </div>
      )}
    </div>
  );
}

function DonationPanel({ authenticated, onLogin }: { authenticated: boolean; onLogin: () => void }) {
  return (
    <div className="rounded-xl border border-green-800/70 bg-green-950/20 p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-lg bg-green-900/40 p-3">
          <CheckCircle className="h-5 w-5 text-green-300" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Donate to Crisis Relief</h2>
          <p className="mt-1 text-sm text-zinc-300">Support verified relief partners for supplies, transport, medicine, and temporary shelter.</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {['Essential supplies', 'Medical support', 'Community shelters'].map((fund) => (
          <button key={fund} disabled={!authenticated} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-left transition-colors hover:border-green-700 disabled:cursor-not-allowed disabled:opacity-60">
            <div className="font-medium">{fund}</div>
            <div className="mt-1 text-xs text-zinc-500">Verified relief channel</div>
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={authenticated ? undefined : onLogin} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-700">
          {authenticated ? 'Continue Donation' : 'Login to Donate'}
        </button>
        <span className="text-xs text-zinc-500">Donation flow is demo-only until payment integration is added.</span>
      </div>
    </div>
  );
}
