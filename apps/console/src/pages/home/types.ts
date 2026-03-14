import type { ServiceSnapshot } from "@polaris/shared-contracts";

export type HomeQuickEntry = {
  key: string;
  index: string;
  label: string;
  title: string;
  points: string[];
  action: string;
  primary: boolean;
  onClick: () => void;
};

export type HomeRecentMock = {
  id: string;
  title: string;
  meta: string;
};

export type ProxyMode = ServiceSnapshot["status"]["proxyMode"];

