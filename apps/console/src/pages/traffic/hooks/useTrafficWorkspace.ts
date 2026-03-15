import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useClearTrafficRequestsMutation, useReplayTrafficRequestMutation } from "../../../domains/traffic/mutations";
import { useTrafficRequestsQuery, useTrafficSettingsQuery } from "../../../domains/traffic/queries";
import { uiSelectors, workspaceSelectors } from "../../../stores/selectors";
import { useUiStore } from "../../../stores/uiStore";
import { useWorkspaceStore } from "../../../stores/workspaceStore";
import { getRequestResolutionMode } from "../utils/trafficFormatters";

export function useTrafficWorkspace() {
  const keyword = useUiStore(uiSelectors.trafficKeyword);
  const method = useUiStore(uiSelectors.trafficMethod);
  const statusCode = useUiStore(uiSelectors.trafficStatusCode);
  const hostOnly = useUiStore(uiSelectors.trafficHostOnly);
  const focusMode = useUiStore(uiSelectors.trafficFocusMode);
  const inspectorTab = useUiStore(uiSelectors.trafficInspectorTab);
  const autoRefresh = useUiStore(uiSelectors.trafficAutoRefresh);

  const setKeyword = useUiStore((state) => state.setTrafficKeyword);
  const setMethod = useUiStore((state) => state.setTrafficMethod);
  const setStatusCode = useUiStore((state) => state.setTrafficStatusCode);
  const setHostOnly = useUiStore((state) => state.setTrafficHostOnly);
  const setFocusMode = useUiStore((state) => state.setTrafficFocusMode);
  const setInspectorTab = useUiStore((state) => state.setTrafficInspectorTab);
  const setAutoRefresh = useUiStore((state) => state.setTrafficAutoRefresh);

  const selectedId = useWorkspaceStore(workspaceSelectors.trafficSelectedRequestId);
  const isCertificateModalOpen = useWorkspaceStore(workspaceSelectors.trafficCertificateModalOpen);
  const setSelectedId = useWorkspaceStore((state) => state.setTrafficSelectedRequestId);
  const setIsCertificateModalOpen = useWorkspaceStore((state) => state.setTrafficCertificateModalOpen);

  const deferredKeyword = useDeferredValue(keyword);
  const recordBodyRef = useRef<HTMLDivElement | null>(null);
  const inspectorBodyRef = useRef<HTMLDivElement | null>(null);
  const previousVisibleCountRef = useRef(0);
  const userPinnedSelectionRef = useRef(false);

  const requestsQuery = useTrafficRequestsQuery(
    {
      keyword: deferredKeyword,
      method,
      statusCode,
      hostOnly,
    },
    { autoRefresh },
  );
  const settingsQuery = useTrafficSettingsQuery();
  const clearRequestsMutation = useClearTrafficRequestsMutation();
  const replayMutation = useReplayTrafficRequestMutation();

  const requests = requestsQuery.data ?? [];
  const isLoading = requestsQuery.isFetching;
  const settings = settingsQuery.data ?? null;
  const lastUpdatedAt = requestsQuery.dataUpdatedAt
    ? new Date(requestsQuery.dataUpdatedAt).toISOString()
    : undefined;

  const visibleRequests = useMemo(() => {
    switch (focusMode) {
      case "errors":
        return requests.filter((item) => item.statusCode >= 400);
      case "https":
        return requests.filter((item) => item.secure);
      case "debug":
        return requests.filter((item) => item.source === "debug");
      case "mock":
        return requests.filter((item) => getRequestResolutionMode(item) === "mock");
      case "proxyForward":
        return requests.filter((item) => getRequestResolutionMode(item) === "proxy_forward");
      case "direct":
        return requests.filter((item) => getRequestResolutionMode(item) === "direct");
      default:
        return requests;
    }
  }, [focusMode, requests]);

  useEffect(() => {
    if (visibleRequests.length === 0) {
      setSelectedId(undefined);
      return;
    }

    if (!selectedId || !visibleRequests.some((item) => item.id === selectedId)) {
      setSelectedId(visibleRequests[visibleRequests.length - 1].id);
    }
  }, [selectedId, setSelectedId, visibleRequests]);

  const selected = useMemo(
    () =>
      visibleRequests.find((item) => item.id === selectedId) ??
      visibleRequests[visibleRequests.length - 1],
    [visibleRequests, selectedId],
  );

  useEffect(() => {
    setInspectorTab("overview");
  }, [selected?.id, setInspectorTab]);

  useLayoutEffect(() => {
    if (!inspectorBodyRef.current) {
      return;
    }
    inspectorBodyRef.current.scrollTop = 0;
  }, [selected?.id, inspectorTab]);

  useEffect(() => {
    const nextCount = visibleRequests.length;
    if (nextCount === 0) {
      previousVisibleCountRef.current = 0;
      return;
    }

    if (
      nextCount > previousVisibleCountRef.current &&
      recordBodyRef.current &&
      !userPinnedSelectionRef.current
    ) {
      recordBodyRef.current.scrollTop = recordBodyRef.current.scrollHeight;
    }

    previousVisibleCountRef.current = nextCount;
  }, [visibleRequests.length]);

  const summary = useMemo(() => {
    const errorCount = visibleRequests.filter(
      (item) => item.statusCode >= 400,
    ).length;
    const secureCount = visibleRequests.filter((item) => item.secure).length;
    const avgDuration = visibleRequests.length
      ? Math.round(
          visibleRequests.reduce((total, item) => total + item.duration, 0) /
            visibleRequests.length,
        )
      : 0;
    const mockCount = visibleRequests.filter((item) => getRequestResolutionMode(item) === "mock").length;
    const proxyForwardCount = visibleRequests.filter(
      (item) => getRequestResolutionMode(item) === "proxy_forward"
    ).length;
    const directCount = visibleRequests.filter((item) => getRequestResolutionMode(item) === "direct").length;

    return {
      total: visibleRequests.length,
      errorCount,
      secureCount,
      avgDuration,
      mockCount,
      proxyForwardCount,
      directCount,
    };
  }, [visibleRequests]);

  const selectRequest = (id: string) => {
    userPinnedSelectionRef.current = true;
    setSelectedId(id);
  };

  const load = async () => {
    await requestsQuery.refetch();
  };

  const clearRequests = async () => {
    await clearRequestsMutation.mutateAsync();
    userPinnedSelectionRef.current = false;
    setSelectedId(undefined);
    await requestsQuery.refetch();
  };

  const replaySelectedRequest = async (id: string) => {
    const replayed = await replayMutation.mutateAsync(id);
    await requestsQuery.refetch();
    return replayed;
  };

  return {
    requests,
    settings,
    selected,
    keyword,
    method,
    statusCode,
    hostOnly,
    focusMode,
    inspectorTab,
    isLoading,
    autoRefresh,
    isCertificateModalOpen,
    lastUpdatedAt,
    visibleRequests,
    summary,
    recordBodyRef,
    inspectorBodyRef,
    setKeyword,
    setMethod,
    setStatusCode,
    setHostOnly,
    setFocusMode,
    setInspectorTab,
    setAutoRefresh,
    setIsCertificateModalOpen,
    load,
    clearRequests,
    replaySelectedRequest,
    selectRequest,
  };
}
