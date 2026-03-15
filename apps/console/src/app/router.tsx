import { Suspense, lazy } from "react";
import { createBrowserRouter, NavLink, Navigate, Outlet } from "react-router-dom";
import { useConsoleI18n } from "../i18n/I18nProvider";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import styles from "./AppLayout.module.css";

const HomePage = lazy(() => import("../pages/home/HomePage").then((module) => ({ default: module.HomePage })));
const TrafficPage = lazy(() => import("../pages/traffic/TrafficPage").then((module) => ({ default: module.TrafficPage })));
const ProxyForwardPage = lazy(() => import("../pages/proxy-forward/ProxyForwardPage").then((module) => ({ default: module.ProxyForwardPage })));
const MockPage = lazy(() => import("../pages/mock/MockPage").then((module) => ({ default: module.MockPage })));
const DebugPage = lazy(() => import("../pages/debug/DebugPage").then((module) => ({ default: module.DebugPage })));
const SettingsPage = lazy(() => import("../pages/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className={styles.pageSkeleton}>Loading...</div>}>{children}</Suspense>;
}

function AppLayout() {
  const { t } = useConsoleI18n();
  const getNavClassName = ({ isActive }: { isActive: boolean }) =>
    isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <h1>北极星</h1>
          <p>本地接口工作台</p>
        </div>
        <nav className={styles.nav}>
          <NavLink className={getNavClassName} to="/">{t("nav.home")}</NavLink>
          <NavLink className={getNavClassName} to="/traffic">{t("nav.traffic")}</NavLink>
          <NavLink className={getNavClassName} to="/proxy-forward">{t("nav.proxyForward")}</NavLink>
          <NavLink className={getNavClassName} to="/mock">{t("nav.mock")}</NavLink>
          <NavLink className={getNavClassName} to="/debug">{t("nav.debug")}</NavLink>
          <NavLink className={getNavClassName} to="/settings">{t("nav.settings")}</NavLink>
        </nav>
      </aside>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <LazyPage><HomePage /></LazyPage> },
      { path: "traffic", element: <LazyPage><TrafficPage /></LazyPage> },
      { path: "proxy-forward", element: <LazyPage><ProxyForwardPage /></LazyPage> },
      { path: "mock", element: <LazyPage><MockPage /></LazyPage> },
      { path: "requests", element: <Navigate replace to="/mock" /> },
      { path: "rules", element: <Navigate replace to="/mock" /> },
      { path: "debug", element: <LazyPage><DebugPage /></LazyPage> },
      { path: "settings", element: <LazyPage><SettingsPage /></LazyPage> },
    ],
  },
]);

