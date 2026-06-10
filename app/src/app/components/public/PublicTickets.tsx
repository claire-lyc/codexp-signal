import {
  AlertCircle,
  Camera,
  CheckCircle,
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Send,
  Shield,
  Tag,
  Ticket,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../../lib/api';
import { accessTokenKey, authHeaders, refreshTokenKey } from '../../lib/auth';

type CreatedTicket = {
  id: string;
  publicReportId: string;
  status: string;
  assignedAgency: string;
  item?: TicketRecord;
};

type TicketUrgency = 'critical' | 'high' | 'medium' | 'low';

type TicketComment = {
  id: string;
  author: string;
  visibility: 'public' | 'internal';
  body: string;
  createdAt: string;
};

type TicketImage = {
  id: string;
  filename: string | null;
  mimeType: string | null;
  byteSize: number | null;
  storageKey: string | null;
  previewUrl: string | null;
  status: string;
  createdAt: string;
};

type TicketRecord = {
  id: string;
  reporter: string;
  message: string;
  location: string;
  crisisType: string;
  specificCrisis?: string | null;
  status: string;
  assignedAgency: string;
  urgency: TicketUrgency;
  hasImage: boolean;
  comments?: TicketComment[];
  images?: TicketImage[];
  chatEnabled?: boolean;
};

type AuthUser = {
  displayName: string | null;
  email: string | null;
  username: string | null;
  role: string | null;
  tags: string[];
};

type SubjectTag = {
  id: string;
  label: string;
  description: string | null;
  categories: string[];
};

type FieldErrors = {
  reportType?: string;
  specificCrisis?: string;
  description?: string;
  location?: string;
  image?: string;
  auth?: string;
};

const ticketTags = [
  { value: 'health', label: 'Health', icon: 'H', agency: 'MOH' },
  { value: 'environment', label: 'Weather & Environment', icon: 'W', agency: 'PUB / NEA' },
  { value: 'supply', label: 'Supply Shortage', icon: 'S', agency: 'Enterprise SG' },
  { value: 'infrastructure', label: 'Infrastructure', icon: 'I', agency: 'LTA' },
  { value: 'transport', label: 'Transport', icon: 'T', agency: 'LTA' },
  { value: 'other', label: 'Other', icon: 'O', agency: 'GOV-OPS' },
];

const specificCrises: Record<string, string[]> = {
  health: ['COVID-19', 'Hantavirus', 'Dengue', 'Other health issue'],
  supply: ['Medicine shortage', 'Food shortage', 'Essential goods shortage', 'Fuel shortage'],
  infrastructure: ['Power outage', 'Water supply disruption', 'Building or road damage', 'Telecommunications outage'],
  transport: ['Train disruption', 'Bus disruption', 'Traffic incident', 'Road obstruction'],
  environment: ['Flash flood', 'Drain overflow', 'Rising water level', 'Haze', 'Air pollution', 'Water pollution', 'Pest or animal issue', 'Other weather or environment issue'],
  other: ['Community safety issue', 'Public facility issue', 'Noise or nuisance', 'Other issue'],
};

export default function PublicTickets() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginUser, setLoginUser] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [reportType, setReportType] = useState('');
  const [specificCrisis, setSpecificCrisis] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [createdTicket, setCreatedTicket] = useState<CreatedTicket | null>(null);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketRecord | null>(null);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [trackId, setTrackId] = useState('');
  const [reply, setReply] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');
  const [showAllTags, setShowAllTags] = useState(false);
  const [locating, setLocating] = useState(false);
  const [reportComposerOpen, setReportComposerOpen] = useState(false);
  const [subjectTags, setSubjectTags] = useState<SubjectTag[]>([]);

  const visibleTags = showAllTags ? ticketTags : ticketTags.slice(0, 5);
  const imagePreviews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  const specificCrisisOptions = useMemo(() => {
    const base = specificCrises[reportType] ?? [];
    const categoryAliases = categoriesForReportType(reportType);
    const dynamic = subjectTags
      .filter((tag) => tag.categories.some((category) => categoryAliases.includes(category)) && subjectTagFitsReportType(tag.label, reportType))
      .map((tag) => tag.label);
    const seen = new Set<string>();
    return [...base, ...dynamic].filter((label) => {
      const key = label.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => {
      const aOther = a.toLowerCase().startsWith('other');
      const bOther = b.toLowerCase().startsWith('other');
      if (aOther !== bOther) return aOther ? 1 : -1;
      return a.localeCompare(b);
    });
  }, [reportType, subjectTags]);

  useEffect(() => {
    fetchMe();
  }, []);

  useEffect(() => {
    if (!authUser) return;
    loadMyTickets();
    const timer = window.setInterval(() => loadMyTickets(true), 15000);
    return () => window.clearInterval(timer);
  }, [authUser?.username, authUser?.email]);

  useEffect(() => {
    if (!authUser) return;
    fetch(apiUrl('/api/report-subject-tags?active=true'), { headers: authHeaders() })
      .then((response) => response.ok ? response.json() as Promise<{ items: SubjectTag[] }> : Promise.reject())
      .then((data) => setSubjectTags(data.items))
      .catch(() => setSubjectTags([]));
  }, [authUser?.username, authUser?.email]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [imagePreviews]);

  const fetchMe = async () => {
    setAuthLoading(true);
    try {
      const response = await fetch(apiUrl('/api/auth/me'), { headers: authHeaders() });
      if (!response.ok) throw new Error('Not signed in');
      const data = (await response.json()) as { user: AuthUser };
      setAuthUser(data.user);
      setLoginError('');
    } catch {
      setAuthUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const loadMyTickets = async (quiet = false) => {
    if (!quiet) setTicketsLoading(true);
    try {
      const response = await fetch(apiUrl('/api/citizen/reports?scope=visible'), { headers: authHeaders() });
      if (!response.ok) throw new Error('Unable to load tickets');
      const data = await response.json() as { items: TicketRecord[] };
      const visibleItems = data.items.filter((ticket) => !isSpam(ticket));
      setTickets(visibleItems);
      setSelectedTicket((current) => {
        if (!visibleItems.length) return null;
        const matching = visibleItems.find((ticket) => ticket.id === current?.id);
        if (!matching) return current && !isSpam(current) ? current : visibleItems[0];
        return {
          ...matching,
          images: current?.images?.some((image) => image.previewUrl) ? current.images : matching.images,
        };
      });
    } catch {
      if (!quiet) {
        setSubmitState('error');
        setSubmitMessage('Could not load your existing tickets.');
      }
    } finally {
      if (!quiet) setTicketsLoading(false);
    }
  };

  const fetchTicketDetails = async (ticketId: string) => {
    try {
      const response = await fetch(apiUrl(`/api/citizen/reports/${ticketId}`), { headers: authHeaders() });
      if (!response.ok) throw new Error('Unable to load ticket');
      const data = await response.json() as { item: TicketRecord };
      setSelectedTicket(data.item);
      setTickets((current) => current.map((ticket) => (ticket.id === data.item.id ? data.item : ticket)));
    } catch {
      // Keep the lightweight list item selected if detail fetch is unavailable.
    }
  };

  const openTicket = (ticket: TicketRecord) => {
    setSelectedTicket(ticket);
    void fetchTicketDetails(ticket.id);
  };

  const handleLogin = async () => {
    setLoginBusy(true);
    setLoginError('');
    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginUser, password: loginPassword }),
      });
      if (!response.ok) throw new Error('Invalid username or password');
      const data = await response.json() as { tokens: { accessToken: string; refreshToken: string } };
      localStorage.setItem(accessTokenKey, data.tokens.accessToken);
      localStorage.setItem(refreshTokenKey, data.tokens.refreshToken);
      setLoginPassword('');
      await fetchMe();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLocate = () => {
    setFieldErrors((current) => ({ ...current, location: undefined }));
    if (!navigator.geolocation) {
      setFieldErrors((current) => ({ ...current, location: 'Location is not available in this browser.' }));
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setLatitude(lat);
        setLongitude(lng);
        setLocation(`Current location (${lat}, ${lng})`);
        setLocating(false);
      },
      () => {
        setFieldErrors((current) => ({ ...current, location: 'Allow location access or type the location manually.' }));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleFiles = (fileList: FileList | null) => {
    const selected = Array.from(fileList ?? []).filter((file) => file.type.startsWith('image/')).slice(0, 5);
    setFiles(selected);
    setFieldErrors((current) => ({ ...current, image: undefined }));
  };

  const validate = () => {
    const nextErrors: FieldErrors = {};
    if (!authUser) nextErrors.auth = 'Sign in before submitting a report.';
    if (!reportType) nextErrors.reportType = 'Choose a tag.';
    if (reportType && !specificCrisis) nextErrors.specificCrisis = 'Choose the specific problem.';
    if (!description.trim()) nextErrors.description = 'Describe what happened.';
    if (files.some((file) => file.size > 5 * 1024 * 1024)) nextErrors.image = 'Each image must be 5 MB or smaller.';
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    setCreatedTicket(null);
    setSubmitMessage('');
    if (!validate()) {
      setSubmitState('error');
      setSubmitMessage('Check the highlighted fields and try again.');
      return;
    }

    const formData = new FormData();
    formData.append('reportType', reportType);
    formData.append('crisisType', reportType);
    formData.append('title', specificCrisis);
    formData.append('description', description.trim());
    formData.append('locationText', location.trim());
    if (latitude !== null) formData.append('latitude', String(latitude));
    if (longitude !== null) formData.append('longitude', String(longitude));
    files.forEach((file) => formData.append('images', file));

    setSubmitState('submitting');
    try {
      const response = await fetch(apiUrl('/api/citizen/reports'), {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = (await response.json()) as CreatedTicket;
      const item = data.item ?? ticketFromCreated(data, {
        reportType,
        specificCrisis,
        description,
        location,
        hasImage: files.length > 0,
      });
      setCreatedTicket(data);
      if (!isSpam(item)) {
        setTickets((current) => [item, ...current.filter((ticket) => ticket.id !== item.id)]);
        setSelectedTicket(item);
      }
      setDescription('');
      setSpecificCrisis('');
      setLocation('');
      setLatitude(null);
      setLongitude(null);
      setFiles([]);
      setFieldErrors({});
      setSubmitState('success');
      setSubmitMessage(`Report ${data.publicReportId} submitted and sent to ${data.assignedAgency}.`);
      setReportComposerOpen(false);
      loadMyTickets(true);
    } catch {
      setSubmitState('error');
      setSubmitMessage('Upload failed. Try again.');
    }
  };

  const handleTrack = async () => {
    const normalizedId = trackId.trim().toUpperCase();
    if (!normalizedId) return;
    setSubmitMessage('');

    try {
      const response = await fetch(apiUrl(`/api/citizen/reports/${normalizedId}`), { headers: authHeaders() });
      if (!response.ok) throw new Error('Report not found');
      const data = await response.json() as { item: TicketRecord };
      if (isSpam(data.item)) throw new Error('Report not found');
      setTickets((current) => [data.item, ...current.filter((ticket) => ticket.id !== data.item.id)]);
      setSelectedTicket(data.item);
    } catch {
      setSubmitState('error');
      setSubmitMessage(`Could not find report ${normalizedId}.`);
    }
  };

  const sendReply = async () => {
    if (!selectedTicket || !reply.trim() || isResolved(selectedTicket)) return;
    try {
      const response = await fetch(apiUrl(`/api/citizen/reports/${selectedTicket.id}/comments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ body: reply.trim() }),
      });
      if (response.status === 409) throw new Error('This ticket is resolved. Discussion is closed.');
      if (!response.ok) throw new Error('Unable to send reply');
      const data = await response.json() as { item: TicketRecord };
      if (isSpam(data.item)) return;
      setSelectedTicket(data.item);
      setTickets((current) => [data.item, ...current.filter((ticket) => ticket.id !== data.item.id)]);
      setReply('');
    } catch (error) {
      setSubmitState('error');
      setSubmitMessage(error instanceof Error ? error.message : 'Reply failed. Try again.');
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto flex max-w-2xl items-center justify-center py-20 text-zinc-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Checking sign-in
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <EmergencyBanner />
        <ReportGuidanceCard />
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-950 text-blue-300">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Sign in to submit a report</h1>
              <p className="text-sm text-zinc-400">Your account is attached to reports and any follow-up replies from agencies.</p>
            </div>
          </div>
          <div className="space-y-3">
            <input
              value={loginUser}
              onChange={(event) => setLoginUser(event.target.value)}
              placeholder="Username or email"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <input
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleLogin()}
              type="password"
              placeholder="Password"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {loginError && <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">{loginError}</div>}
            <button
              onClick={handleLogin}
              disabled={loginBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {loginBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Report an Issue</h1>
            <p className="text-zinc-400">Send non-emergency reports and receive follow-up updates from the relevant agency</p>
          </div>
          <button
            type="button"
            data-tour="submit-report"
            onClick={() => setReportComposerOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Submit a Report
          </button>
        </div>
        <EmergencyBanner />
        <ReportGuidanceCard />
      </div>

      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <section className="min-w-0 space-y-4">
          {reportComposerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
            <div className="border-b border-zinc-800 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Ticket className="h-5 w-5 text-blue-400" />
                  <h2 className="font-semibold">Submit a Report</h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-zinc-500">{authUser.username ?? authUser.email}</div>
                  <button
                    type="button"
                    data-tour="close-report"
                    onClick={() => setReportComposerOpen(false)}
                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                    aria-label="Close submit report"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <textarea
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setFieldErrors((current) => ({ ...current, description: undefined }));
                }}
                placeholder="Describe the issue..."
                rows={5}
                className={inputClass(Boolean(fieldErrors.description), 'min-h-32 resize-y')}
              />
              {fieldErrors.description && <ErrorLine text={fieldErrors.description} />}

              <div className="flex flex-wrap items-center gap-2">
                <Tag className="h-4 w-4 text-zinc-400" />
                {visibleTags.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setReportType(item.value);
                      setSpecificCrisis('');
                      setFieldErrors((current) => ({
                        ...current,
                        reportType: undefined,
                        specificCrisis: undefined,
                      }));
                    }}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      reportType === item.value
                        ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[10px]">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
                {!showAllTags && (
                  <button
                    type="button"
                    onClick={() => setShowAllTags(true)}
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
                  >
                    +{ticketTags.length - visibleTags.length}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {fieldErrors.reportType && <ErrorLine text={fieldErrors.reportType} />}

              {reportType ? (
                <div>
                  <label htmlFor="specific-crisis" className="mb-1.5 block text-sm font-medium text-zinc-300">
                    Specific problem
                  </label>
                  <select
                    id="specific-crisis"
                    value={specificCrisis}
                    onChange={(event) => {
                      setSpecificCrisis(event.target.value);
                      setFieldErrors((current) => ({ ...current, specificCrisis: undefined }));
                    }}
                    className={inputClass(Boolean(fieldErrors.specificCrisis))}
                  >
                    <option value="">Select a specific problem</option>
                    {specificCrisisOptions.map((crisis) => (
                      <option key={crisis} value={crisis}>{crisis}</option>
                    ))}
                  </select>
                  {fieldErrors.specificCrisis && <ErrorLine text={fieldErrors.specificCrisis} />}
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      placeholder="Address, landmark, or postal code..."
                      className={inputClass(Boolean(fieldErrors.location), 'pl-9')}
                    />
                  </div>
                  {fieldErrors.location && <ErrorLine text={fieldErrors.location} />}
                </div>
                <button
                  type="button"
                  onClick={handleLocate}
                  disabled={locating}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-60"
                >
                  {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  Auto-detect
                </button>
              </div>

              <label className={`block cursor-pointer rounded-lg border-2 border-dashed p-4 transition-colors ${fieldErrors.image ? 'border-red-700 bg-red-950/20' : 'border-zinc-700 bg-zinc-950/50 hover:border-zinc-600'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400">
                    <Camera className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-200">{files.length ? `${files.length} photo${files.length > 1 ? 's' : ''} selected` : 'Click to upload photo'}</div>
                    <div className="text-xs text-zinc-500">Up to 5 images, 5 MB each</div>
                  </div>
                </div>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => handleFiles(event.target.files)} />
              </label>
              {fieldErrors.image && <ErrorLine text={fieldErrors.image} />}

              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {imagePreviews.map((preview) => (
                    <div key={preview.url} className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                      <img src={preview.url} alt={preview.file.name} className="h-28 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFiles((current) => current.filter((file) => file !== preview.file))}
                        className="absolute right-2 top-2 rounded-full bg-zinc-950/80 p-1 text-zinc-300 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={handleSubmit}
                  disabled={submitState === 'submitting'}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-medium transition-colors hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitState === 'submitting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Submit Report
                </button>
                {submitMessage && (
                  <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${submitState === 'success' ? 'border border-green-800 bg-green-950/40 text-green-300' : 'border border-red-800 bg-red-950/40 text-red-300'}`}>
                    {submitState === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {submitMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
          )}

          <div className="flex gap-2">
            <input
              value={trackId}
              onChange={(event) => setTrackId(event.target.value)}
              placeholder="Find report, e.g. TKT-0042"
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button onClick={handleTrack} className="rounded-lg bg-zinc-800 px-3 py-2 hover:bg-zinc-700">
              <Search className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-2 [scrollbar-color:#3f3f46_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700/70">
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} selected={selectedTicket?.id === ticket.id} onClick={() => openTicket(ticket)} />
            ))}
            {ticketsLoading && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">
                Loading your reports...
              </div>
            )}
            {!ticketsLoading && !tickets.length && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">
                Your submitted or tracked reports will appear here.
              </div>
            )}
          </div>
        </section>

        <DiscussionPanel ticket={selectedTicket} reply={reply} setReply={setReply} sendReply={sendReply} />
      </div>
    </div>
  );
}

function EmergencyBanner() {
  return (
    <div className="mb-5 rounded-xl border border-red-800 bg-red-950/40 p-5">
      <div className="flex items-start gap-3">
        <Phone className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
        <div>
          <div className="mb-1 font-semibold text-red-300">Immediate Life-Threatening Emergency?</div>
          <p className="mb-3 text-sm text-zinc-300">
            Call emergency services directly. Reports submitted here are not a replacement for emergency calls.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href="tel:995" className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-red-700">
              <Phone className="h-4 w-4" />
              Call 995
            </a>
            <a href="tel:1777" className="inline-flex items-center gap-2 rounded-lg bg-zinc-700 px-4 py-2 text-sm transition-colors hover:bg-zinc-600">
              Non-Emergency: 1777
            </a>
            <a href="tel:999" className="inline-flex items-center gap-2 rounded-lg bg-zinc-700 px-4 py-2 text-sm transition-colors hover:bg-zinc-600">
              Police: 999
            </a>
            <a href="tel:1767" className="inline-flex items-center gap-2 rounded-lg bg-zinc-700 px-4 py-2 text-sm transition-colors hover:bg-zinc-600">
              Crisis Hotline: 1767
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportGuidanceCard() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-800/50 bg-blue-950/20 px-4 py-3 text-sm text-zinc-300">
        Use this page to report issues, upload photos, and follow agency updates in one place.
      </div>
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-xs text-zinc-400">
        False reports may delay response to real incidents.
      </div>
    </div>
  );
}

function TicketCard({ ticket, selected, onClick }: { ticket: TicketRecord; selected: boolean; onClick: () => void }) {
  const resolved = isResolved(ticket);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition-colors ${selected ? (resolved ? 'border-green-500 bg-green-950/20' : 'border-blue-500 bg-blue-950/20') : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge icon={<Tag className="h-3.5 w-3.5" />} text={ticket.crisisType} blue={selected && !resolved} green={selected && resolved} />
        {ticket.specificCrisis ? <Badge icon={<AlertCircle className="h-3.5 w-3.5" />} text={ticket.specificCrisis} /> : null}
        <Badge icon={<Shield className="h-3.5 w-3.5" />} text={ticket.assignedAgency} />
        {ticket.hasImage && <Badge icon={<ImageIcon className="h-3.5 w-3.5" />} text="Photo" />}
        <span className="ml-auto font-mono text-xs text-zinc-500">{ticket.id}</span>
      </div>
      <div className="mb-1 font-semibold text-zinc-100">{ticket.message.slice(0, 88)}{ticket.message.length > 88 ? '...' : ''}</div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{ticket.location}</span>
        <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{ticket.comments?.filter((comment) => comment.visibility === 'public').length ?? 0}</span>
        <span className={resolved ? 'text-green-400' : ''}>{ticket.status}</span>
      </div>
    </button>
  );
}

function DiscussionPanel({
  ticket,
  reply,
  setReply,
  sendReply,
}: {
  ticket: TicketRecord | null;
  reply: string;
  setReply: (value: string) => void;
  sendReply: () => void;
}) {
  if (!ticket) {
    return (
      <aside className="min-h-[560px] rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
          <MessageCircle className="mb-4 h-12 w-12" />
          <h2 className="text-lg font-semibold text-zinc-300">Select a report</h2>
          <p className="mt-2 text-sm">Submitted or tracked reports expand here for updates and discussion.</p>
        </div>
      </aside>
    );
  }

  const resolved = isResolved(ticket);
  const groupedMessages = groupMessages(ticket);

  return (
    <aside className={`min-h-[560px] overflow-hidden rounded-xl border bg-zinc-900 ${resolved ? 'border-green-800/70' : 'border-zinc-800'}`}>
      <div className="border-b border-zinc-800 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-zinc-100">{ticket.id}</h2>
          <span className={`rounded-full px-2 py-1 text-xs ${resolved ? 'bg-green-950 text-green-300' : 'bg-zinc-800 text-zinc-400'}`}>{ticket.status}</span>
        </div>
        <div className="text-sm text-zinc-400">{ticket.assignedAgency}</div>
      </div>

      <div className="space-y-5 p-4">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge icon={<Tag className="h-3.5 w-3.5" />} text={ticket.crisisType} blue={!resolved} green={resolved} />
            {ticket.specificCrisis ? <Badge icon={<AlertCircle className="h-3.5 w-3.5" />} text={ticket.specificCrisis} /> : null}
            <Badge icon={<MapPin className="h-3.5 w-3.5" />} text={ticket.location} />
            {ticket.hasImage && <Badge icon={<ImageIcon className="h-3.5 w-3.5" />} text={`${ticket.images?.length || 1} photo`} />}
          </div>
          <p className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm leading-6 text-zinc-200">{ticket.message}</p>
        </div>

        {ticket.images?.length ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm text-zinc-400">
            {ticket.images.map((image) => (
              <div key={image.id} className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                <span className="truncate">{image.filename ?? image.storageKey ?? 'Uploaded image'}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="border-t border-zinc-800 pt-4">
          <div className="mb-3 text-sm font-semibold text-zinc-300">Discussion</div>
          <div className="space-y-3">
            {groupedMessages.map((group) => (
              <MessageGroup key={group.id} group={group} />
            ))}
            {resolved && (
              <div className="rounded-lg border border-green-800 bg-green-950/30 px-3 py-2 text-sm text-green-300">
                Ticket resolved. Discussion is closed.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 p-4">
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${resolved ? 'border-green-900 bg-green-950/20' : 'border-zinc-700 bg-zinc-950'}`}>
          <Plus className="h-4 w-4 text-zinc-500" />
          <input
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && sendReply()}
            disabled={resolved}
            placeholder={resolved ? 'Discussion closed after resolution' : `Send an update in ${ticket.id}`}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
          />
          <button disabled={resolved} onClick={sendReply} className="rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

type MessageGroupData = {
  id: string;
  author: string;
  visibility: 'public' | 'internal';
  createdAt: string;
  bodies: string[];
  images: TicketImage[];
};

function MessageGroup({ group }: { group: MessageGroupData }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-950 text-sm font-semibold text-blue-300">
        {group.author.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-baseline gap-2">
          <span className="font-semibold text-zinc-100">{group.author}</span>
          <span className="text-xs text-zinc-500">{group.createdAt}</span>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <div className="space-y-2">
            {group.bodies.map((body, index) => (
              <p key={`${group.id}-body-${index}`} className="text-sm leading-6 text-zinc-300">{body}</p>
            ))}
          </div>
          {group.images.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {group.images.map((image) => (
                image.previewUrl ? (
                  <img key={image.id} src={image.previewUrl} alt={image.filename ?? 'Uploaded ticket photo'} className="h-32 w-full rounded-lg border border-zinc-800 object-cover" />
                ) : (
                  <div key={image.id} className="flex min-h-20 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-400">
                    <ImageIcon className="h-4 w-4" />
                    <span className="truncate">{image.filename ?? image.storageKey ?? 'Uploaded image'}</span>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({ icon, text, blue = false, green = false }: { icon: React.ReactNode; text: string; blue?: boolean; green?: boolean }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${green ? 'border-green-500 bg-green-600/20 text-green-200' : blue ? 'border-blue-500 bg-blue-600/20 text-blue-200' : 'border-zinc-700 bg-zinc-800 text-zinc-300'}`}>
      {icon}
      <span className="truncate">{text}</span>
    </span>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-red-300">
      <AlertCircle className="h-3.5 w-3.5" />
      {text}
    </div>
  );
}

function inputClass(error: boolean, extra = '') {
  return `w-full rounded-lg border bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 ${error ? 'border-red-700 focus:ring-red-600' : 'border-zinc-700 focus:ring-blue-600'} ${extra}`;
}

function ticketFromCreated(data: CreatedTicket, input: {
  reportType: string;
  specificCrisis: string;
  description: string;
  location: string;
  hasImage: boolean;
}): TicketRecord {
  return {
    id: data.publicReportId,
    reporter: 'You',
    message: input.description.trim(),
    location: input.location.trim() || 'Location not provided',
    crisisType: labelForReportType(input.reportType),
    specificCrisis: input.specificCrisis,
    status: data.status,
    assignedAgency: data.assignedAgency,
    urgency: urgencyFor(input.reportType, input.description),
    hasImage: input.hasImage,
    comments: [],
    images: [],
    chatEnabled: true,
  };
}

function groupMessages(ticket: TicketRecord): MessageGroupData[] {
  const messages: MessageGroupData[] = [
    {
      id: `${ticket.id}-original`,
      author: ticket.reporter,
      visibility: 'public',
      createdAt: 'Original report',
      bodies: [ticket.message],
      images: [],
    },
    ...((ticket.images ?? []).length
      ? [{
          id: `${ticket.id}-original-images`,
          author: ticket.reporter,
          visibility: 'public' as const,
          createdAt: 'Attached photos',
          bodies: [],
          images: ticket.images ?? [],
        }]
      : []),
    ...(ticket.comments ?? [])
      .filter((comment) => comment.visibility === 'public')
      .map((comment) => ({
        id: comment.id,
        author: comment.author,
        visibility: comment.visibility,
        createdAt: formatCommentTime(comment.createdAt),
        bodies: [comment.body],
        images: [],
      })),
  ];

  return messages.reduce<MessageGroupData[]>((groups, message) => {
    const previous = groups.at(-1);
    if (
      previous &&
      previous.author === message.author &&
      previous.visibility === message.visibility &&
      previous.images.length === 0 &&
      message.images.length === 0
    ) {
      previous.bodies.push(...message.bodies);
      previous.images.push(...message.images);
      previous.createdAt = message.createdAt;
      return groups;
    }
    groups.push({ ...message, bodies: [...message.bodies], images: [...message.images] });
    return groups;
  }, []);
}

function isResolved(ticket: TicketRecord) {
  return ticket.status === 'resolved' || ticket.chatEnabled === false;
}

function isSpam(ticket: TicketRecord) {
  return ticket.status === 'spam' || ticket.status === 'rejected';
}

function labelForReportType(value: string) {
  if (value === 'health') return 'Health';
  if (value === 'flood' || value === 'environment') return 'Weather';
  if (value === 'supply') return 'Supply Chain';
  if (value === 'infrastructure' || value === 'transport') return 'Infrastructure';
  return 'General';
}

function agencyForReportType(value: string) {
  if (value === 'health') return 'MOH';
  if (value === 'flood' || value === 'environment') return 'PUB';
  if (value === 'supply') return 'Enterprise SG';
  if (value === 'infrastructure' || value === 'transport') return 'LTA';
  return 'GOV-OPS';
}

function urgencyFor(crisisType: string, message: string): TicketUrgency {
  void crisisType;
  void message;
  return 'medium';

}

function categoriesForReportType(reportType: string) {
  if (reportType === 'flood') return ['flood', 'weather'];
  if (reportType === 'supply') return ['supply', 'supply_chain'];
  if (reportType === 'transport') return ['transport', 'infrastructure'];
  if (reportType === 'environment') return ['environment', 'weather', 'flood'];
  if (reportType === 'other') return ['other', 'general'];
  return [reportType];
}

function subjectTagFitsReportType(label: string, reportType: string) {
  const text = label.toLowerCase();
  if (text === 'flash flooding') return false;
  const supply = ['medicine', 'food', 'goods', 'fuel', 'shortage', 'stock', 'panadol', 'salbutamol', 'inhaler', 'pharmacy', 'pharmacies'];
  const weather = ['flood', 'drain', 'water', 'haze', 'pollution', 'pest', 'weather'];
  const health = ['covid', 'hantavirus', 'dengue', 'health', 'symptom', 'clinic', 'hospital'];
  const infrastructure = ['power', 'outage', 'building', 'road damage', 'telecommunications', 'lift'];
  const transport = ['train', 'bus', 'traffic', 'road obstruction'];

  if (reportType === 'health') return health.some((keyword) => text.includes(keyword));
  if (reportType === 'environment') return weather.some((keyword) => text.includes(keyword));
  if (reportType === 'supply') return supply.some((keyword) => text.includes(keyword));
  if (reportType === 'infrastructure') return infrastructure.some((keyword) => text.includes(keyword));
  if (reportType === 'transport') return transport.some((keyword) => text.includes(keyword));
  return true;
}

function formatCommentTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
