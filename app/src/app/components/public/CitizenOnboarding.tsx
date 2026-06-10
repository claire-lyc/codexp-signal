import { Bell, CheckCircle, LocateFixed, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

const completedKey = 'signal-citizen-onboarding-complete';
const stepKey = 'signal-citizen-onboarding-step';

type TourStep = {
  title: string;
  body: string;
  route: string;
  target?: string;
  actionLabel: string;
  secondaryLabel?: string;
  clickTargetAction?: 'advance' | 'finish';
  skipToIndex?: number;
};

const steps: TourStep[] = [
  {
    title: 'Enable location alerts',
    body: 'Location-based service lets SiGnal send more accurate nearby alerts, resources, and report location suggestions.',
    route: '/public',
    target: 'alert-bar',
    actionLabel: 'Turn On Location',
    secondaryLabel: 'Skip Location',
  },
  {
    title: 'Recent alert bar',
    body: 'This alert bar always carries the most recent government broadcast or emergency alert.',
    route: '/public',
    target: 'alert-bar',
    actionLabel: 'Next',
  },
  {
    title: 'Open all alerts',
    body: 'Click View Alerts to see the full alert page and previous government updates.',
    route: '/public',
    target: 'view-alerts',
    actionLabel: 'View Alerts',
    clickTargetAction: 'advance',
  },
  {
    title: 'Alerts page',
    body: 'This page collects the active and past alerts so citizens can verify what is happening.',
    route: '/public/alerts',
    actionLabel: 'Back to Home',
  },
  {
    title: 'Open the situation map',
    body: 'Click the first active situation to open its map layer.',
    route: '/public',
    target: 'first-situation',
    actionLabel: 'Skip',
    clickTargetAction: 'advance',
    skipToIndex: 6,
  },
  {
    title: 'Map layer opened',
    body: 'This is the situation map. It shows affected areas and risk signals for the active situation you selected.',
    route: '/public',
    target: 'situation-map',
    actionLabel: 'Go to Report',
  },
  {
    title: 'Open report form',
    body: 'Click Submit a Report to open the citizen report form.',
    route: '/public/report',
    target: 'submit-report',
    actionLabel: 'Skip',
    clickTargetAction: 'advance',
    skipToIndex: 8,
  },
  {
    title: 'Report form',
    body: 'This is where a citizen describes the issue, adds a location, and uploads photos. Close it when you are done viewing.',
    route: '/public/report',
    target: 'close-report',
    actionLabel: 'Continue',
    clickTargetAction: 'advance',
  },
  {
    title: 'Volunteer sign-in',
    body: 'This is where citizens can sign in or continue as a volunteer. It is optional, and the close button lets them leave the guide.',
    route: '/public/volunteer',
    target: 'volunteer-entry',
    actionLabel: 'Forum',
  },
  {
    title: 'Open compose post',
    body: 'Click Compose Post to open the community post composer.',
    route: '/public/forum',
    target: 'compose-post',
    actionLabel: 'Skip',
    clickTargetAction: 'advance',
    skipToIndex: 11,
  },
  {
    title: 'Compose post',
    body: 'Citizens can optionally write a post to ask for help or share verified local updates. Close the composer when you are done viewing.',
    route: '/public/forum',
    target: 'close-compose',
    actionLabel: 'Continue',
    clickTargetAction: 'advance',
  },
  {
    title: 'Open welcome post',
    body: 'Click the welcome post to open the thread.',
    route: '/public/forum',
    target: 'welcome-post',
    actionLabel: 'Skip',
    clickTargetAction: 'advance',
    skipToIndex: 13,
  },
  {
    title: 'Like the welcome post',
    body: 'Click Like on the welcome post. This thread also shows dislike and report controls when something needs review.',
    route: '/public/forum',
    target: 'welcome-like',
    actionLabel: 'Next',
    clickTargetAction: 'advance',
  },
  {
    title: 'Notification bell',
    body: 'The bell shows replies, official updates, volunteer notices, and agency follow-ups.',
    route: '/public/forum',
    target: 'notification-bell',
    actionLabel: 'Profile',
  },
  {
    title: 'Choose notification types',
    body: 'Select a notification type to edit preferences and end the tutorial, or click Next to return home and finish normally.',
    route: '/public/profile?tab=notifications',
    target: 'notification-types',
    actionLabel: 'Next',
    clickTargetAction: 'finish',
  },
  {
    title: 'You are ready',
    body: 'Thanks for completing the citizen walkthrough. You can restart it later by clearing browser site data.',
    route: '/public',
    actionLabel: 'Finish',
  },
];

export default function CitizenOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState(() => localStorage.getItem(completedKey) !== 'true');
  const [stepIndex, setStepIndex] = useState(() => {
    const stored = Number(localStorage.getItem(stepKey));
    return Number.isFinite(stored) && stored >= 0 && stored < steps.length ? stored : 0;
  });
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = steps[stepIndex];
  const currentPath = `${location.pathname}${location.search}`;

  useEffect(() => {
    if (!active) return;
    const wanted = step.route;
    if (wanted !== currentPath && !(wanted === '/public' && location.pathname === '/public')) {
      navigate(wanted, { replace: false });
    }
  }, [active, currentPath, location.pathname, navigate, step.route]);

  useEffect(() => {
    if (!active) return;
    localStorage.setItem(stepKey, String(stepIndex));
  }, [active, stepIndex]);

  useEffect(() => {
    if (!active) return;

    const updateTarget = () => {
      const node = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
      setTargetRect(node ? node.getBoundingClientRect() : null);
    };

    updateTarget();
    const timer = window.setTimeout(updateTarget, 250);
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  }, [active, currentPath, step.target]);

  useEffect(() => {
    if (!active || !step.target) return;
    const node = document.querySelector(`[data-tour="${step.target}"]`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, [active, currentPath, step.target]);

  const panelStyle = useMemo(() => {
    if (!targetRect) return { left: 20, top: 96 };
    const panelWidth = 360;
    const panelHeight = 236;
    const gap = 18;
    const spaces = {
      right: window.innerWidth - targetRect.right,
      left: targetRect.left,
      bottom: window.innerHeight - targetRect.bottom,
      top: targetRect.top,
    };
    const left =
      spaces.right >= panelWidth + gap
        ? targetRect.right + gap
        : spaces.left >= panelWidth + gap
          ? targetRect.left - panelWidth - gap
          : Math.min(Math.max(16, targetRect.left), window.innerWidth - panelWidth - 16);
    const top =
      spaces.right >= panelWidth + gap || spaces.left >= panelWidth + gap
        ? Math.min(Math.max(84, targetRect.top), window.innerHeight - panelHeight - 16)
        : spaces.bottom >= panelHeight + gap
          ? targetRect.bottom + gap
          : Math.max(84, targetRect.top - panelHeight - gap);
    return { left, top };
  }, [targetRect]);

  useEffect(() => {
    if (!active || !step.target || !step.clickTargetAction) return;

    const handleTargetClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest(`[data-tour="${step.target}"]`)) return;

      window.setTimeout(() => {
        if (step.clickTargetAction === 'finish') {
          dismiss();
          return;
        }
        setStepIndex((current) => Math.min(current + 1, steps.length - 1));
      }, 120);
    };

    document.addEventListener('click', handleTargetClick, true);
    return () => document.removeEventListener('click', handleTargetClick, true);
  }, [active, step.clickTargetAction, step.target]);

  if (!active) return null;

  const advance = () => {
    if (stepIndex === 0 && step.actionLabel === 'Turn On Location') {
      navigator.geolocation?.getCurrentPosition(
        () => undefined,
        () => undefined,
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }

    if (stepIndex === steps.length - 1) {
      localStorage.setItem(completedKey, 'true');
      localStorage.removeItem(stepKey);
      setActive(false);
      return;
    }

    setStepIndex((current) => step.skipToIndex ?? current + 1);
  };

  const dismiss = () => {
    localStorage.setItem(completedKey, 'true');
    localStorage.removeItem(stepKey);
    setActive(false);
  };

  return (
    <>
      {targetRect && (
        <div
          className="pointer-events-none fixed z-[81] rounded-xl border-2 border-blue-300 bg-blue-400/10 shadow-[0_0_24px_rgba(96,165,250,0.45)]"
          style={{
            left: targetRect.left - 6,
            top: targetRect.top - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}
      <div
        className="fixed z-[82] w-[calc(100vw-32px)] max-w-[360px] rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-white shadow-2xl"
        style={panelStyle}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-blue-300">
              {stepIndex === 0 ? <LocateFixed className="h-5 w-5" /> : stepIndex === 9 ? <Bell className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-semibold">{step.title}</h2>
            </div>
          </div>
          <button type="button" onClick={dismiss} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Close walkthrough">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm leading-6 text-zinc-300">{step.body}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={dismiss} className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white">
            {step.secondaryLabel ?? 'Exit'}
          </button>
          <button type="button" onClick={advance} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            {step.actionLabel}
          </button>
        </div>
      </div>
    </>
  );
}
