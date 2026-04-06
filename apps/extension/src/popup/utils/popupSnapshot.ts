import type { ProxyRule, ServiceStatus } from "@polaris/shared-types";

const POPUP_SNAPSHOT_STORAGE_KEY = "polaris.popupSnapshot";

export type PopupSnapshot = {
  status: ServiceStatus;
  rules: ProxyRule[];
  updatedAt: string;
};

export async function readPopupSnapshot(): Promise<PopupSnapshot | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(POPUP_SNAPSHOT_STORAGE_KEY, (result) => {
      const snapshot = result[POPUP_SNAPSHOT_STORAGE_KEY];
      if (
        snapshot &&
        typeof snapshot === "object" &&
        typeof snapshot.updatedAt === "string" &&
        snapshot.status &&
        Array.isArray(snapshot.rules)
      ) {
        resolve(snapshot as PopupSnapshot);
        return;
      }
      resolve(null);
    });
  });
}

export async function writePopupSnapshot(snapshot: PopupSnapshot): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [POPUP_SNAPSHOT_STORAGE_KEY]: snapshot }, () => resolve());
  });
}
