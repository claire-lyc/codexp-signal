import { createBrowserRouter } from "react-router";
import GovLayout from "./components/government/GovLayout";
import GovOverview from "./components/government/GovOverview";
import GovPandemic from "./components/government/GovPandemic";
import GovWeather from "./components/government/GovWeather";
import GovSupplyChain from "./components/government/GovSupplyChain";
import GovInfrastructure from "./components/government/GovInfrastructure";
import GovCybersecurity from "./components/government/GovCybersecurity";
import GovPublicSentiment from "./components/government/GovPublicSentiment";
import GovFormHandling from "./components/government/GovFormHandling";
import GovVolunteers from "./components/government/GovVolunteers";
import GovAIRecommendations from "./components/government/GovAIRecommendations";
import GovHistoricalAnalysis from "./components/government/GovHistoricalAnalysis";
import GovBroadcast from "./components/government/GovBroadcast";
import PublicLayout from "./components/public/PublicLayout";
import PublicHome from "./components/public/PublicHome";
import PublicAlerts from "./components/public/PublicAlerts";
import PublicSOS from "./components/public/PublicSOS";
import PublicVolunteer from "./components/public/PublicVolunteer";
import PublicForum from "./components/public/PublicForum";
import LandingPage from "./components/LandingPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingPage,
  },
  {
    path: "/gov",
    Component: GovLayout,
    children: [
      { index: true, Component: GovOverview },
      { path: "pandemic", Component: GovPandemic },
      { path: "weather", Component: GovWeather },
      { path: "supply-chain", Component: GovSupplyChain },
      { path: "infrastructure", Component: GovInfrastructure },
      { path: "cybersecurity", Component: GovCybersecurity },
      { path: "public-sentiment", Component: GovPublicSentiment },
      { path: "form-handling", Component: GovFormHandling },
      { path: "volunteers", Component: GovVolunteers },
      { path: "ai-recommendations", Component: GovAIRecommendations },
      { path: "historical", Component: GovHistoricalAnalysis },
      { path: "broadcast", Component: GovBroadcast },
    ],
  },
  {
    path: "/public",
    Component: PublicLayout,
    children: [
      { index: true, Component: PublicHome },
      { path: "alerts", Component: PublicAlerts },
      { path: "report", Component: PublicSOS },
      { path: "sos", Component: PublicSOS }, // keep old path working
      { path: "volunteer", Component: PublicVolunteer },
      { path: "forum", Component: PublicForum },
    ],
  },
]);
