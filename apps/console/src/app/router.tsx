import { Suspense, lazy, useEffect, useState } from "react";
import { createBrowserRouter, NavLink, Navigate, Outlet } from "react-router-dom";
import { useConsoleI18n } from "../i18n/I18nProvider";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import styles from "./AppLayout.module.css";

const HomePage = lazy(() => import("../pages/home/HomePage").then((module) => ({ default: module.HomePage })));
const TrafficPage = lazy(() =>
  import("../pages/traffic/TrafficPage").then((module) => ({ default: module.TrafficPage })),
);
const ProxyForwardPage = lazy(() =>
  import("../pages/proxy-forward/ProxyForwardPage").then((module) => ({ default: module.ProxyForwardPage })),
);
const MockPage = lazy(() => import("../pages/mock/MockPage").then((module) => ({ default: module.MockPage })));
const DebugPage = lazy(() => import("../pages/debug/DebugPage").then((module) => ({ default: module.DebugPage })));
const SettingsPage = lazy(() =>
  import("../pages/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className={styles.pageSkeleton}>Loading...</div>}>{children}</Suspense>;
}

function AppLayout() {
  const { t } = useConsoleI18n();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const getNavClassName = ({ isActive }: { isActive: boolean }) =>
    isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;

  useEffect(() => {
    const stored = window.localStorage.getItem("polaris.sidebar.collapsed");
    setSidebarCollapsed(stored === "1");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("polaris.sidebar.collapsed", sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  const navItems = [
    {
      key: "home",
      to: "/",
      testId: "nav-home",
      icon: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9 21v-6h6v6",
    },
    {
      key: "traffic",
      to: "/traffic",
      testId: "nav-traffic",
      icon: "M6 18V12M12 18V9M18 18V6M4 18h16",
    },
    {
      key: "proxyForward",
      to: "/proxy-forward",
      testId: "nav-proxy-forward",
      icon: "M4 7h11M11 4l4 3-4 3M20 17H9M13 14l-4 3 4 3",
    },
    {
      key: "mock",
      to: "/mock",
      testId: "nav-mock",
      icon: "M7 4h10l3 3v13H7zM17 4v3h3M10 12h7M10 16h7",
    },
    {
      key: "debug",
      to: "/debug",
      testId: "nav-debug",
      icon: "M9 7h6M8 10h8M7 13h10M10 17h4M12 3v3M6 7l-2-2M18 7l2-2",
    },
    {
      key: "settings",
      to: "/settings",
      testId: "nav-settings",
      icon: "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
    },
  ] as const;

  return (
    <div className={`${styles.shell} ${sidebarCollapsed ? styles.shellCollapsed : ""}`}>
      <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ""}`}>
        <div className={styles.brand}>
          <div className={styles.brandRow}>
            <img alt="" className={styles.brandMark} src="/polaris-mark.svg" />
            <div className={styles.brandText}>
              <h1>{"北极星"}</h1>
              <p>{"本地接口工作台"}</p>
            </div>
            <button
              aria-label={sidebarCollapsed ? "展开导航" : "收起导航"}
              className={styles.sidebarToggle}
              onClick={() => setSidebarCollapsed((value) => !value)}
              type="button"
            >
              {sidebarCollapsed ? ">" : "<"}
            </button>
          </div>
        </div>
        <nav className={styles.nav} data-testid="app-nav">
          {navItems.map((item) => {
            const label = t(`nav.${item.key}`);
            return (
              <NavLink
                aria-label={label}
                className={getNavClassName}
                data-testid={item.testId}
                key={item.key}
                title={sidebarCollapsed ? label : undefined}
                to={item.to}
              >
                <span aria-hidden className={styles.navIcon}>
                  <svg viewBox="0 0 24 24">
                    <path d={item.icon} />
                  </svg>
                </span>
                <span className={styles.navLabel}>{label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main className={styles.content} data-testid="app-content">
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
