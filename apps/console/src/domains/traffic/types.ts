export type TrafficRequestFilters = {
  keyword?: string;
  method?: string;
  statusCode?: string;
  hostOnly?: string;
};

export type TrafficRequestsQueryOptions = {
  autoRefresh: boolean;
};
