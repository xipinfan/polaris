import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useShallow } from "zustand/react/shallow";
import { useClearTrafficRequestsMutation, useReplayTrafficRequestMutation } from "../../../domains/traffic/mutations";
import { useTrafficRequestsQuery, useTrafficSettingsQuery } from "../../../domains/traffic/queries";
import { useUiStore } from "../../../stores/uiStore";
import { useWorkspaceStore } from "../../../stores/workspaceStore";
import {
  filterVisibleTrafficRequests,
  findNextSelectedTrafficRequestId,
  findSelectedTrafficRequest,
  summarizeTrafficRequests,
} from "../utils/trafficWorkspace";

const EMPTY_REQUESTS: NonNullable<ReturnType<typeof useTrafficRequestsQuery>["data"]> = [];

export function useTrafficWorkspace() {
  const {
    keyword,
    method,
    statusCode,
    hostOnly,
    focusMode,
    inspectorTab,
    autoRefresh,
    setKeyword,
    setMethod,
    setStatusCode,
    setHostOnly,
    setFocusMode,
    setInspectorTab,
    setAutoRefresh,
  } = useUiStore(
    useShallow((state) => ({
      keyword: state.trafficKeyword,
      method: state.trafficMethod,
      statusCode: state.trafficStatusCode,
      hostOnly: state.trafficHostOnly,
      focusMode: state.trafficFocusMode,
      inspectorTab: state.trafficInspectorTab,
      autoRefresh: state.trafficAutoRefresh,
      setKeyword: state.setTrafficKeyword,
      setMethod: state.setTrafficMethod,
      setStatusCode: state.setTrafficStatusCode,
      setHostOnly: state.setTrafficHostOnly,
      setFocusMode: state.setTrafficFocusMode,
      setInspectorTab: state.setTrafficInspectorTab,
      setAutoRefresh: state.setTrafficAutoRefresh,
    })),
  );

  const {
    selectedId,
    isCertificateModalOpen,
    trafficSessionStartedAt,
    setSelectedId,
    setIsCertificateModalOpen,
    setTrafficSessionStartedAt,
  } = useWorkspaceStore(
    useShallow((state) => ({
      selectedId: state.trafficSelectedRequestId,
      isCertificateModalOpen: state.trafficCertificateModalOpen,
      trafficSessionStartedAt: state.trafficSessionStartedAt,
      setSelectedId: state.setTrafficSelectedRequestId,
      setIsCertificateModalOpen: state.setTrafficCertificateModalOpen,
      setTrafficSessionStartedAt: state.setTrafficSessionStartedAt,
    })),
  );

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

  const requests = requestsQuery.data ?? EMPTY_REQUESTS;
  const isLoading = requestsQuery.isFetching;
  const settings = settingsQuery.data ?? null;
  const lastUpdatedAt = requestsQuery.dataUpdatedAt
    ? new Date(requestsQuery.dataUpdatedAt).toISOString()
    : undefined;

  const visibleRequests = useMemo(
    () => filterVisibleTrafficRequests(requests, focusMode, trafficSessionStartedAt),
    [focusMode, requests, trafficSessionStartedAt],
  );

  useEffect(() => {
    const nextSelectedId = findNextSelectedTrafficRequestId(visibleRequests, selectedId);
    if (nextSelectedId !== selectedId) {
      setSelectedId(nextSelectedId);
    }
  }, [selectedId, setSelectedId, visibleRequests]);

  const selected = useMemo(
    () => findSelectedTrafficRequest(visibleRequests, selectedId),
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

  const summary = useMemo(() => summarizeTrafficRequests(visibleRequests), [visibleRequests]);

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
    setTrafficSessionStartedAt(Date.now());
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
