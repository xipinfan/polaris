import { createBrowserRouter, NavLink, Navigate, Outlet } from "react-router-dom";
import { useConsoleI18n } from "../i18n/I18nProvider";
import { HomePage } from "../pages/home/HomePage";
import { TrafficPage } from "../pages/traffic/TrafficPage";
import { MockPage } from "../pages/mock/MockPage";
import { DebugPage } from "../pages/debug/DebugPage";
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
          <NavLink to="/mock">{t("nav.mock")}</NavLink>
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
      { path: "mock", element: <MockPage /> },
      { path: "requests", element: <Navigate replace to="/mock" /> },
      { path: "rules", element: <Navigate replace to="/mock" /> },
      { path: "debug", element: <DebugPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
