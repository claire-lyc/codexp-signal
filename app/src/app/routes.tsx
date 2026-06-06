import type { ComponentType } from "react";
import { createBrowserRouter } from "react-router";
import LandingPage from "./components/LandingPage";

const lazyRoute = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingPage,
  },
  {
    path: "/gov",
    lazy: lazyRoute(() => import("./components/government/GovLayout")),
    children: [
      { index: true, lazy: lazyRoute(() => import("./components/government/GovOverview")) },
      { path: "pandemic", lazy: lazyRoute(() => import("./components/government/GovPandemic")) },
      { path: "weather", lazy: lazyRoute(() => import("./components/government/GovWeather")) },
      { path: "supply-chain", lazy: lazyRoute(() => import("./components/government/GovSupplyChain")) },
      { path: "infrastructure", lazy: lazyRoute(() => import("./components/government/GovInfrastructure")) },
      { path: "cybersecurity", lazy: lazyRoute(() => import("./components/government/GovCybersecurity")) },
      { path: "public-sentiment", lazy: lazyRoute(() => import("./components/government/GovPublicSentiment")) },
      { path: "form-handling", lazy: lazyRoute(() => import("./components/government/GovFormHandling")) },
      { path: "volunteers", lazy: lazyRoute(() => import("./components/government/GovVolunteers")) },
      { path: "ai-recommendations", lazy: lazyRoute(() => import("./components/government/GovAIRecommendations")) },
      { path: "historical", lazy: lazyRoute(() => import("./components/government/GovHistoricalAnalysis")) },
      { path: "broadcast", lazy: lazyRoute(() => import("./components/government/GovBroadcast")) },
    ],
  },
  {
    path: "/public",
    lazy: lazyRoute(() => import("./components/public/PublicLayout")),
    children: [
      { index: true, lazy: lazyRoute(() => import("./components/public/PublicHome")) },
      { path: "alerts", lazy: lazyRoute(() => import("./components/public/PublicAlerts")) },
      { path: "report", lazy: lazyRoute(() => import("./components/public/PublicSOS")) },
      { path: "sos", lazy: lazyRoute(() => import("./components/public/PublicSOS")) },
      { path: "volunteer", lazy: lazyRoute(() => import("./components/public/PublicVolunteer")) },
      { path: "forum", lazy: lazyRoute(() => import("./components/public/PublicForum")) },
    ],
  },
]);
