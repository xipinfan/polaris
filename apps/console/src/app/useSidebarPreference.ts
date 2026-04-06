import { useEffect, useState } from "react";
import { readPersistence, writePersistence } from "../lib/persistence";

const SIDEBAR_COLLAPSED_KEY = "polaris.sidebar.collapsed";

export function useSidebarPreference() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readPersistence(SIDEBAR_COLLAPSED_KEY, false),
  );

  useEffect(() => {
    writePersistence(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed);
  }, [sidebarCollapsed]);

  return {
    sidebarCollapsed,
    setSidebarCollapsed,
  };
}
