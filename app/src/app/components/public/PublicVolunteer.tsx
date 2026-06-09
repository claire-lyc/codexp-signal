import {
  Calendar,
  CheckCircle,
  Loader2,
  MapPin,
  Shield,
  Upload,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../../lib/api';
import { API_REFRESH_INTERVAL_MS } from '../../lib/api';
import { authHeaders } from '../../lib/auth';
import {
  clearVolunteerProfile,
  demoCitizenVolunteerProfile,
  makeVolunteerId,
  opportunityCapacity,
  readVolunteerOpportunities,
  readVolunteerNotifications,
  readVolunteerProfile,
  saveVolunteerProfile,
  scoreVolunteerForOpportunity,
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

type AccountProfileResponse = {
  user: {
    displayName: string | null;
    email: string | null;
  } | null;
  preferences?: {
    phoneNumber: string | null;
    smsEnabled: boolean;
    alertNotifications: boolean;
    replyNotifications: boolean;
    agencyPingNotifications: boolean;
    volunteerNotifications: boolean;
  };
  volunteerProfile?: VolunteerProfile | null;
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

export default function PublicVolunteer() {
  const [authenticated, setAuthenticated] = useState(true);
  const [profile, setProfile] = useState<VolunteerProfile | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfileResponse | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState('');
  const [pageTab, setPageTab] = useState<'volunteer' | 'donate'>('volunteer');
  const [workTab, setWorkTab] = useState<'opportunities' | 'applications' | 'upcoming'>('opportunities');
  const [slotTab, setSlotTab] = useState<'available' | 'unavailable'>('available');
  const [opportunities, setOpportunities] = useState<VolunteerOpportunity[]>(() => readVolunteerOpportunities());
  const [notifications, setNotifications] = useState<VolunteerNotification[]>(() => readVolunteerNotifications());

  const loadRemoteVolunteerProfile = (quiet = false) =>
    fetch(apiUrl('/api/volunteers/profile'), { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error('Volunteer profile unavailable');
        return response.json() as Promise<{ item: { userId: string; profile: VolunteerProfile } | null }>;
      })
      .then((data) => {
        if (!data.item?.profile) return;
        const merged = normalizeVolunteerProfile(data.item.profile, accountProfile);
        saveVolunteerProfile(merged);
        hydrateProfile(merged);
        if (!quiet && (merged.assignments.some((assignment) => assignment.status === 'offered'))) {
          setMessage('A new volunteer offer is available for your review.');
        }
      });

  const hydrateProfile = (nextProfile: VolunteerProfile) => {
    setProfile(nextProfile);
    setForm(formFromProfile(nextProfile));
  };

  const saveVolunteerRemote = async (nextProfile: VolunteerProfile) => {
    await syncAccountDetails(nextProfile, accountProfile);
    const response = await fetch(apiUrl('/api/volunteers/profile'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(nextProfile),
    });
    if (!response.ok) throw new Error('Volunteer profile sync failed');
    saveVolunteerProfile(nextProfile);
    hydrateProfile(nextProfile);
    return response.json();
  };

  const persistVolunteerProfile = (nextProfile: VolunteerProfile, nextMessage?: string) => {
    saveVolunteerProfile(nextProfile);
    hydrateProfile(nextProfile);
    saveVolunteerRemote(nextProfile).catch(() => {
      // Keep local fallback state when backend sync fails.
    });
    if (nextMessage) setMessage(nextMessage);
  };

  useEffect(() => {
    fetch(apiUrl('/api/auth/profile'), { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error('Account profile unavailable');
        return response.json() as Promise<AccountProfileResponse>;
      })
      .then((data) => {
        setAccountProfile(data);
        const syncedVolunteer = normalizeVolunteerProfile(data.volunteerProfile ?? null, data);
        if (syncedVolunteer) {
          saveVolunteerProfile(syncedVolunteer);
          hydrateProfile(syncedVolunteer);
          return;
        }

        const saved = readVolunteerProfile();
        if (saved) {
          const merged = normalizeVolunteerProfile(saved, data);
          saveVolunteerProfile(merged);
          hydrateProfile(merged);
          return;
        }

        const seeded = normalizeVolunteerProfile(
          { ...demoCitizenVolunteerProfile, assignments: [...demoCitizenVolunteerProfile.assignments] },
          data,
        );
        saveVolunteerProfile(seeded);
        hydrateProfile(seeded);
        setMessage('Demo returning volunteer loaded. You can apply, review pending applications, and check upcoming shifts.');
      })
      .catch(() => {
        const saved = readVolunteerProfile();
        if (saved) {
          hydrateProfile(saved);
        } else {
          const demoProfile = { ...demoCitizenVolunteerProfile, assignments: [...demoCitizenVolunteerProfile.assignments] };
          saveVolunteerProfile(demoProfile);
          hydrateProfile(demoProfile);
          setMessage('Demo returning volunteer loaded. You can apply, review pending applications, and check upcoming shifts.');
        }
      });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadRemoteVolunteerProfile(true).catch(() => {
        // Keep the latest local volunteer state when backend sync is temporarily unavailable.
      });
    }, API_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [accountProfile]);

  useEffect(() => {
    const refreshProfile = () => {
      const saved = readVolunteerProfile();
      setProfile(saved);
      if (saved) {
        setForm(formFromProfile(saved));
      }
    };
    const refreshNeeds = () => setOpportunities(readVolunteerOpportunities());
    const refreshNotifications = () => setNotifications(readVolunteerNotifications());
    window.addEventListener('storage', refreshProfile);
    window.addEventListener('storage', refreshNeeds);
    window.addEventListener('storage', refreshNotifications);
    window.addEventListener('signal-volunteer-updated', refreshProfile);
    window.addEventListener('signal-volunteer-needs-updated', refreshNeeds);
    window.addEventListener('signal-volunteer-notifications-updated', refreshNotifications);
    return () => {
      window.removeEventListener('storage', refreshProfile);
      window.removeEventListener('storage', refreshNeeds);
      window.removeEventListener('storage', refreshNotifications);
      window.removeEventListener('signal-volunteer-updated', refreshProfile);
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
        assignment: profile?.assignments.find((assignment) => assignment.opportunityId === opportunity.id),
        applied: profile?.appliedOpportunityIds.includes(opportunity.id) ?? false,
        filled: opportunityCapacity(opportunity, profile),
      }))
      .sort((a, b) => b.match - a.match);
  }, [form.availability, form.region, form.skills, opportunities, profile]);

  const offers = profile?.assignments.filter((assignment) => assignment.status === 'offered') ?? [];
  const upcoming = profile?.assignments.filter((assignment) => assignment.status === 'accepted' || assignment.status === 'checked_in') ?? [];
  const completed = profile?.assignments.filter((assignment) => assignment.status === 'completed') ?? [];
  const pendingApplications = profile
    ? rankedOpportunities.filter((opportunity) => opportunity.applied && !opportunity.assignment)
    : [];
  const myNotifications = profile ? notifications.filter((notification) => notification.volunteerId === profile.id) : [];

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
    const nextProfile: VolunteerProfile = {
      id: profile?.id ?? makeVolunteerId(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: accountProfile?.user?.email?.trim() || form.email.trim(),
      region: form.region,
      skills: form.skills,
      availability: form.availability,
      certifications: form.certifications.trim(),
      emergencyContact: form.emergencyContact.trim(),
      status: profile?.status === 'verified' || profile?.status === 'assigned' || profile?.status === 'checked_in' ? profile.status : 'pending_review',
      registeredAt: profile?.registeredAt ?? new Date().toISOString(),
      appliedOpportunityIds: profile?.appliedOpportunityIds ?? [],
      assignments: profile?.assignments ?? [],
    };

    saveVolunteerRemote(nextProfile)
      .then(() => {
        setShowProfileForm(false);
        setMessage(profile ? 'Volunteer details updated.' : 'Readiness profile submitted for government verification.');
      })
      .catch(() => {
        persistVolunteerProfile(nextProfile, profile ? 'Volunteer details updated on this device.' : 'Readiness profile saved on this device. Start the backend to sync it across operators.');
        setShowProfileForm(false);
      })
      .finally(() => setSubmitting(false));
  };

  const quickVerify = () => {
    if (!profile) return;
    loadRemoteVolunteerProfile()
      .then(() => {
        const latest = readVolunteerProfile();
        if (latest) {
          setMessage(latest.status === 'verified' ? 'Your profile has been approved and is ready for matching.' : 'Your profile is still under review.');
          return;
        }
        setMessage('We could not find a synced volunteer profile yet.');
      })
      .catch(() => {
        setMessage('Unable to refresh status right now. Please try again once the backend is available.');
      });
  };

  const applyForOpportunity = (opportunityId: number) => {
    if (!profile) return;
    const opportunity = opportunities.find((item) => item.id === opportunityId);
    const matchingRole = opportunity?.roleSlots.find((role) => (
      role.requiredSkills.every((skill) => profile.skills.includes(skill)) && role.assigned < role.needed
    ));
    const nextAssignments = matchingRole
      ? [
          ...profile.assignments.filter((assignment) => assignment.opportunityId !== opportunityId),
          {
            id: `ASN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            opportunityId,
            roleId: matchingRole.id,
            roleTitle: matchingRole.title,
            status: 'accepted' as const,
            assignedAt: new Date().toISOString(),
            note: `Automatically accepted for ${matchingRole.title}. Report to ${opportunity?.reportingPoint ?? 'the stated reporting point'}`,
          },
        ]
      : profile.assignments;
    const nextProfile = {
      ...profile,
      appliedOpportunityIds: Array.from(new Set([...profile.appliedOpportunityIds, opportunityId])),
      assignments: nextAssignments,
      status: matchingRole ? 'assigned' as const : profile.status,
    };
    setWorkTab(matchingRole ? 'upcoming' : 'applications');
    persistVolunteerProfile(
      nextProfile,
      matchingRole
        ? `You were automatically accepted for ${matchingRole.title}.`
        : 'Application sent to the coordinating agency for manual review.',
    );
  };

  const updateAssignment = (assignmentId: string, status: VolunteerAssignment['status'], nextMessage: string) => {
    if (!profile) return;
    const nextAssignments = profile.assignments.map((assignment) => assignment.id === assignmentId ? { ...assignment, status } : assignment);
    const stillActive = nextAssignments.some((assignment) => assignment.status === 'offered' || assignment.status === 'accepted' || assignment.status === 'checked_in');
    const nextProfile: VolunteerProfile = {
      ...profile,
      status: status === 'checked_in' ? 'checked_in' : stillActive ? 'assigned' : 'verified',
      assignments: nextAssignments,
    };
    persistVolunteerProfile(nextProfile, nextMessage);
  };

  const saveProfileUpdates = () => {
    if (!profile) return;
    const nextErrors = [];
    if (!form.name.trim()) nextErrors.push('Full name is required.');
    if (!form.phone.trim()) nextErrors.push('Contact number is required.');
    if (!form.region) nextErrors.push('Choose a preferred region.');
    if (!form.skills.length) nextErrors.push('Select at least one skill.');
    if (!form.availability.length) nextErrors.push('Select at least one availability window.');
    setErrors(nextErrors);
    if (nextErrors.length) return;

    setSavingProfile(true);
    const nextProfile: VolunteerProfile = {
      ...profile,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: accountProfile?.user?.email?.trim() || form.email.trim(),
      region: form.region,
      skills: form.skills,
      availability: form.availability,
      certifications: form.certifications.trim(),
      emergencyContact: form.emergencyContact.trim(),
    };

    saveVolunteerRemote(nextProfile)
      .then(() => {
        setMessage('Volunteer profile updated. Agencies will use your latest skills and availability for matching.');
      })
      .catch(() => {
        persistVolunteerProfile(nextProfile, 'Profile updated on this device. Start the backend to sync the latest changes.');
      })
      .finally(() => setSavingProfile(false));
  };

  const resetDemoProfile = () => {
    clearVolunteerProfile();
    setProfile(null);
    setForm(emptyForm);
    setErrors([]);
    setMessage('');
    setWorkTab('opportunities');
    setSlotTab('available');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Volunteer & Support</h1>
          <p className="text-zinc-400">Keep one verified profile, apply to multiple opportunities, and accept offers when agencies confirm you.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-1">
            <button onClick={() => setPageTab('volunteer')} className={`rounded-md px-3 py-1.5 text-sm ${pageTab === 'volunteer' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Volunteer</button>
            <button onClick={() => setPageTab('donate')} className={`rounded-md px-3 py-1.5 text-sm ${pageTab === 'donate' ? 'bg-green-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Donate</button>
          </div>
          {profile && (
            <button onClick={() => setShowProfileForm((value) => !value)} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
              Update Details
            </button>
          )}
        </div>
      </div>

      {pageTab === 'donate' && <DonationPanel authenticated={authenticated} />}

      {pageTab === 'volunteer' && (
        <>
          {!authenticated && (
            <section className="rounded-xl border border-blue-900/50 bg-blue-950/20 p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-blue-900/50 p-3">
                  <Shield className="h-6 w-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h2 className="mb-2 font-semibold">Singpass Sign In</h2>
                  <p className="mb-4 text-sm text-zinc-300">For the demo, signing in lets you continue if a volunteer profile already exists. First-time volunteers can create one after this step.</p>
                  <button onClick={() => setAuthenticated(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium transition-colors hover:bg-blue-700">
                    <Shield className="h-4 w-4" />
                    Login with Singpass
                  </button>
                </div>
              </div>
            </section>
          )}

          {authenticated && !profile && !showProfileForm && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-2 text-lg font-semibold">Volunteer Readiness Profile</h2>
              <p className="mb-4 text-sm text-zinc-400">First-time volunteers submit skills and availability once. Returning verified volunteers would be let into the opportunities page immediately.</p>
              <button onClick={() => setShowProfileForm(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700">
                Sign Up with Singpass
              </button>
            </section>
          )}

          {authenticated && showProfileForm && (
            <ProfileForm
              form={form}
              errors={errors}
              submitting={submitting}
              isUpdate={Boolean(profile)}
              onSubmit={submitRegistration}
              onCancel={() => setShowProfileForm(false)}
              onChange={setForm}
              onToggle={toggleValue}
            />
          )}

          {profile && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="space-y-4">
                <DashboardSummary pending={pendingApplications.length} offers={offers.length} upcoming={upcoming.length} completed={completed.length} onReset={resetDemoProfile} />
                <NotificationPanel notifications={myNotifications} opportunities={opportunities} />
                {message && <div className="rounded-lg border border-green-800 bg-green-950/40 p-3 text-sm text-green-300">{message}</div>}
                <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
                  <button onClick={() => setWorkTab('opportunities')} className={`rounded-md px-3 py-1.5 text-sm ${workTab === 'opportunities' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Opportunities</button>
                  <button onClick={() => setWorkTab('applications')} className={`rounded-md px-3 py-1.5 text-sm ${workTab === 'applications' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Applications ({pendingApplications.length + offers.length})</button>
                  <button onClick={() => setWorkTab('upcoming')} className={`rounded-md px-3 py-1.5 text-sm ${workTab === 'upcoming' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Upcoming ({upcoming.length})</button>
                </div>
                {workTab === 'opportunities' && (
                  <OpportunityList profile={profile} opportunities={rankedOpportunities} tab={slotTab} setTab={setSlotTab} onApply={applyForOpportunity} />
                )}
                {workTab === 'applications' && (
                  <ApplicationsList
                    pending={pendingApplications}
                    offers={offers}
                    opportunities={opportunities}
                    onAccept={(assignment) => updateAssignment(assignment.id, 'accepted', 'Offer accepted. It is now in Upcoming Volunteering.')}
                    onDecline={(assignment) => updateAssignment(assignment.id, 'declined', 'Offer rejected. You can keep applying for other opportunities.')}
                  />
                )}
                {workTab === 'upcoming' && (
                  <UpcomingList
                    assignments={upcoming}
                    opportunities={opportunities}
                    onCheckIn={(assignment) => updateAssignment(assignment.id, 'checked_in', 'Checked in. Your agency coordinator can see that you are on site.')}
                    onComplete={(assignment) => updateAssignment(assignment.id, 'completed', 'Shift completed. Thank you for supporting the response.')}
                  />
                )}
              </section>
              <aside className="space-y-4">
                <ProfileSummary profile={profile} />
                <UpcomingMini assignments={upcoming} offers={offers} opportunities={opportunities} />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formFromProfile(profile: VolunteerProfile): FormState {
  return {
    name: profile.name,
    phone: profile.phone,
    email: profile.email,
    region: profile.region,
    skills: profile.skills,
    availability: profile.availability,
    certifications: profile.certifications,
    emergencyContact: profile.emergencyContact,
  };
}

function normalizeVolunteerProfile(profile: VolunteerProfile | null, accountProfile: AccountProfileResponse | null) {
  if (!profile) return null;
  return {
    ...profile,
    name: accountProfile?.user?.displayName?.trim() || profile.name,
    email: accountProfile?.user?.email?.trim() || profile.email,
    phone: profile.phone || accountProfile?.preferences?.phoneNumber || '',
  };
}

async function syncAccountDetails(profile: VolunteerProfile, accountProfile: AccountProfileResponse | null) {
  const requests: Promise<Response>[] = [];
  const displayName = profile.name.trim();
  if (displayName && displayName !== (accountProfile?.user?.displayName ?? '')) {
    requests.push(
      fetch(apiUrl('/api/auth/profile/details'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ displayName }),
      }),
    );
  }

  if (accountProfile?.preferences?.smsEnabled && profile.phone.trim() && profile.phone.trim() !== (accountProfile.preferences.phoneNumber ?? '')) {
    requests.push(
      fetch(apiUrl('/api/auth/profile/preferences'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          ...accountProfile.preferences,
          phoneNumber: profile.phone.trim(),
        }),
      }),
    );
  }

  if (requests.length) {
    await Promise.all(requests);
  }
}

function ProfileForm({
  form,
  errors,
  submitting,
  isUpdate,
  onSubmit,
  onCancel,
  onChange,
  onToggle,
}: {
  form: FormState;
  errors: string[];
  submitting: boolean;
  isUpdate: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  onChange: (form: FormState) => void;
  onToggle: (field: 'skills' | 'availability', value: string) => void;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Users className="h-5 w-5 text-blue-400" />{isUpdate ? 'Update Volunteer Details' : 'Create Volunteer Profile'}</h2>
        <p className="mt-1 text-sm text-zinc-500">Skills are collected here only, not during every application.</p>
      </div>
      <div className="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Full Name" value={form.name} onChange={(value) => onChange({ ...form, name: value })} placeholder="As per NRIC" />
          <Field label="Contact Number" value={form.phone} onChange={(value) => onChange({ ...form, phone: value })} placeholder="+65 XXXX XXXX" />
          <Field label="Email" value={form.email} onChange={(value) => onChange({ ...form, email: value })} placeholder="Optional" />
          <Field label="Emergency Contact" value={form.emergencyContact} onChange={(value) => onChange({ ...form, emergencyContact: value })} placeholder="+65 XXXX XXXX" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Preferred Region</label>
          <select value={form.region} onChange={(event) => onChange({ ...form, region: event.target.value })} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600">
            <option value="">Select region...</option>
            {['Central', 'North', 'South', 'East', 'West', 'Any Region'].map((region) => <option key={region}>{region}</option>)}
          </select>
        </div>

        <ToggleGroup title="Skills & Qualifications" values={volunteerSkills} selected={form.skills} onToggle={(skill) => onToggle('skills', skill)} />
        <ToggleGroup title="Availability" values={volunteerAvailability} selected={form.availability} onToggle={(slot) => onToggle('availability', slot)} />

        <div>
          <label className="mb-2 block text-sm font-medium">Experience & Certification Notes</label>
          <textarea value={form.certifications} onChange={(event) => onChange({ ...form, certifications: event.target.value })} placeholder="Past volunteering, first aid, driving licence, medical registration, language capability..." rows={3} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600" />
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

        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={onSubmit} disabled={submitting} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium transition-colors hover:bg-blue-700 disabled:opacity-60">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {isUpdate ? 'Save Details' : 'Submit for Verification'}
          </button>
          <button onClick={onCancel} className="rounded-lg bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700">Cancel</button>
        </div>
      </div>
    </section>
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

function DashboardSummary({
  pending,
  offers,
  upcoming,
  completed,
  onReset,
}: {
  pending: number;
  offers: number;
  upcoming: number;
  completed: number;
  onReset: () => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Volunteer Dashboard</h2>
          <p className="text-sm text-zinc-400">Browse new opportunities, track applications, and manage accepted shifts from one page.</p>
        </div>
        <button onClick={onReset} className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700">Reset Demo</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-xs text-zinc-500">Details</div>
          <div className="mt-1 font-medium text-green-300">Verified</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-xs text-zinc-500">Pending</div>
          <div className="mt-1 text-xl font-bold">{pending}</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-xs text-zinc-500">Offers</div>
          <div className="mt-1 text-xl font-bold">{offers}</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-xs text-zinc-500">Completed / Assigned</div>
          <div className="mt-1 text-xl font-bold">{completed} / {upcoming}</div>
        </div>
      </div>
    </div>
  );
}

function NotificationPanel({ notifications, opportunities }: { notifications: VolunteerNotification[]; opportunities: VolunteerOpportunity[] }) {
  if (!notifications.length) return null;

  return (
    <div className="rounded-xl border border-blue-800 bg-blue-950/20 p-5">
      <h2 className="mb-3 font-semibold">Agency Notifications</h2>
      <div className="space-y-2">
        {notifications.map((notification) => {
          const opportunity = opportunities.find((item) => item.id === notification.opportunityId);
          return (
            <div key={notification.id} className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">{notification.agency} offered a volunteer role</div>
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
    assignment?: VolunteerAssignment;
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
          <h2 className="text-lg font-semibold">Volunteer Opportunities</h2>
          <p className="text-xs text-zinc-500">Apply to any open role. Existing applications stay pending while you continue browsing.</p>
        </div>
        <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
          <button onClick={() => setTab('available')} className={`rounded-md px-3 py-1.5 text-sm ${tab === 'available' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Available ({available.length})</button>
          <button onClick={() => setTab('unavailable')} className={`rounded-md px-3 py-1.5 text-sm ${tab === 'unavailable' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Unavailable ({unavailable.length})</button>
        </div>
      </div>
      <div className="space-y-4">
        {visible.map((opportunity) => {
          const canApply = profile.status !== 'pending_review' && !opportunity.applied && !opportunity.assignment && opportunity.filled < opportunity.needed;
          return (
            <div key={opportunity.id} className={`rounded-lg border p-5 ${opportunity.urgency === 'high' ? 'border-red-800 bg-red-950/20' : opportunity.urgency === 'medium' ? 'border-yellow-800 bg-yellow-950/20' : 'border-green-800 bg-green-950/20'}`}>
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{opportunity.title}</h3>
                    <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{opportunity.match}% fit</span>
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
                {opportunity.assignment ? (
                  <span className={`rounded-lg px-3 py-2 text-sm ${opportunity.assignment.status === 'declined' ? 'bg-red-950 text-red-300' : 'bg-green-950 text-green-300'}`}>
                    {opportunity.assignment.status === 'declined' ? 'Not selected' : `Offer ${opportunity.assignment.status}`}
                  </span>
                ) : opportunity.applied ? (
                  <span className="rounded-lg bg-blue-950 px-3 py-2 text-sm text-blue-300">Pending application</span>
                ) : (
                  <button onClick={() => onApply(opportunity.id)} disabled={!canApply} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500">
                    {profile.status === 'pending_review' ? 'Verification required' : opportunity.filled >= opportunity.needed ? 'Fully staffed' : 'Apply'}
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

function ApplicationsList({
  pending,
  offers,
  opportunities,
  onAccept,
  onDecline,
}: {
  pending: Array<VolunteerOpportunity & { match: number; filled: number }>;
  offers: VolunteerAssignment[];
  opportunities: VolunteerOpportunity[];
  onAccept: (assignment: VolunteerAssignment) => void;
  onDecline: (assignment: VolunteerAssignment) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-4 text-lg font-semibold">My Applications</h2>
      <div className="space-y-3">
        {offers.map((assignment) => {
          const opportunity = opportunities.find((item) => item.id === assignment.opportunityId);
          if (!opportunity) return null;
          return (
            <div key={assignment.id} className="rounded-lg border border-blue-800 bg-blue-950/20 p-4">
              <div className="mb-1 font-medium">{opportunity.title}</div>
              <div className="text-sm text-blue-200">{assignment.roleTitle ?? 'Volunteer role'} offered by {opportunity.authorisedAgency}</div>
              <div className="mt-2 text-sm text-zinc-300">{opportunity.shift} - {opportunity.reportingPoint}</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button onClick={() => onAccept(assignment)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700">Final Accept</button>
                <button onClick={() => onDecline(assignment)} className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-600">Reject Offer</button>
              </div>
            </div>
          );
        })}
        {pending.map((opportunity) => (
          <div key={opportunity.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
            <div className="mb-1 font-medium">{opportunity.title}</div>
            <div className="text-sm text-zinc-400">{opportunity.authorisedAgency} - {opportunity.location} - {opportunity.shift}</div>
            <div className="mt-2 inline-flex rounded bg-blue-950 px-2 py-1 text-xs text-blue-300">Pending agency review</div>
          </div>
        ))}
        {!offers.length && !pending.length && <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-5 text-sm text-zinc-500">No applications yet. Apply from the opportunities tab.</div>}
      </div>
    </div>
  );
}

function UpcomingList({
  assignments,
  opportunities,
  onCheckIn,
  onComplete,
}: {
  assignments: VolunteerAssignment[];
  opportunities: VolunteerOpportunity[];
  onCheckIn: (assignment: VolunteerAssignment) => void;
  onComplete: (assignment: VolunteerAssignment) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-4 text-lg font-semibold">Upcoming Volunteering</h2>
      <div className="space-y-3">
        {assignments.map((assignment) => {
          const opportunity = opportunities.find((item) => item.id === assignment.opportunityId);
          if (!opportunity) return null;
          return (
            <div key={assignment.id} className="rounded-lg border border-green-800 bg-green-950/20 p-4">
              <div className="mb-1 font-medium">{opportunity.title}</div>
              <div className="text-sm text-green-200">{assignment.roleTitle ?? 'Volunteer role'}</div>
              <div className="mt-2 text-sm text-zinc-300">{opportunity.shift}</div>
              <div className="text-sm text-zinc-300">{opportunity.reportingPoint}</div>
              <div className="mt-3 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">Status: {assignment.status}</div>
              {assignment.status === 'accepted' && <button onClick={() => onCheckIn(assignment)} className="mt-3 w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-700">Check In On Site</button>}
              {assignment.status === 'checked_in' && <button onClick={() => onComplete(assignment)} className="mt-3 w-full rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-600">Mark Shift Complete</button>}
            </div>
          );
        })}
        {!assignments.length && <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-5 text-sm text-zinc-500">Accepted assignments will appear here.</div>}
      </div>
    </div>
  );
}

function ProfileSummary({ profile }: { profile: VolunteerProfile }) {
  const readiness = profile.status === 'pending_review' ? 'Pending verification' : 'Verified';
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-4 text-lg font-semibold">Volunteer Profile</h2>
      <div className="space-y-3 text-sm">
        <div>
          <div className="text-zinc-500">Volunteer ID</div>
          <div className="font-mono text-zinc-100">{profile.id}</div>
        </div>
        <div>
          <div className="text-zinc-500">Readiness</div>
          <div>{readiness}</div>
        </div>
        <div>
          <div className="text-zinc-500">Region</div>
          <div>{profile.region}</div>
        </div>
        <div>
          <div className="text-zinc-500">Skills</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => <span key={skill} className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{skill}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function UpcomingMini({ assignments, offers, opportunities }: { assignments: VolunteerAssignment[]; offers: VolunteerAssignment[]; opportunities: VolunteerOpportunity[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Calendar className="h-5 w-5 text-purple-400" />Quick View</h2>
      <div className="space-y-2 text-sm">
        {offers.length > 0 && <div className="rounded-lg bg-blue-950/40 px-3 py-2 text-blue-200">{offers.length} offer{offers.length === 1 ? '' : 's'} waiting for final accept</div>}
        {assignments.slice(0, 3).map((assignment) => {
          const opportunity = opportunities.find((item) => item.id === assignment.opportunityId);
          return (
            <div key={assignment.id} className="rounded-lg bg-zinc-950/60 px-3 py-2">
              <div className="font-medium">{opportunity?.title ?? 'Volunteer shift'}</div>
              <div className="text-xs text-zinc-500">{assignment.roleTitle} - {assignment.status}</div>
            </div>
          );
        })}
        {!offers.length && !assignments.length && <p className="text-zinc-500">No confirmed shifts yet.</p>}
      </div>
    </div>
  );
}

function DonationPanel({ authenticated }: { authenticated: boolean }) {
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
        <button className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-700">{authenticated ? 'Continue Donation' : 'Donate'}</button>
        <span className="text-xs text-zinc-500">Donation flow is demo-only until payment integration is added.</span>
      </div>
    </div>
  );
}
