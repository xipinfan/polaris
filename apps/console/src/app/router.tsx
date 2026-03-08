import { createBrowserRouter, NavLink, Outlet } from "react-router-dom";
import { useConsoleI18n } from "../i18n/I18nProvider";
import { HomePage } from "../pages/home/HomePage";
import { TrafficPage } from "../pages/traffic/TrafficPage";
import { RequestAssetPage } from "../pages/requests/RequestAssetPage";
import { DebugPage } from "../pages/debug/DebugPage";
import { RulesPage } from "../pages/rules/RulesPage";
import { SettingsPage } from "../pages/settings/SettingsPage";

function AppLayout() {
  const { t } = useConsoleI18n();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>北极星</h1>
          <p>Local API workbench</p>
        </div>
        <nav className="nav">
          <NavLink to="/">{t("nav.home")}</NavLink>
          <NavLink to="/traffic">{t("nav.traffic")}</NavLink>
          <NavLink to="/requests">{t("nav.requests")}</NavLink>
          <NavLink to="/rules">{t("nav.rules")}</NavLink>
          <NavLink to="/debug">{t("nav.debug")}</NavLink>
          <NavLink to="/settings">{t("nav.settings")}</NavLink>
        </nav>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "traffic", element: <TrafficPage /> },
      { path: "requests", element: <RequestAssetPage /> },
      { path: "rules", element: <RulesPage /> },
      { path: "mock", element: <RulesPage /> },
      { path: "debug", element: <DebugPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
