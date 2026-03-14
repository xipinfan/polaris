export const PERSISTENCE_VERSION = 1;

type Envelope<T> = {
  version: number;
  value: T;
};

export function readPersistence<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Envelope<T> | T;
    if (
      parsed &&
      typeof parsed === "object" &&
      "version" in parsed &&
      "value" in parsed
    ) {
      const envelope = parsed as Envelope<T>;
      if (envelope.version !== PERSISTENCE_VERSION) {
        return fallback;
      }
      return envelope.value;
    }

    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writePersistence<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload: Envelope<T> = {
      version: PERSISTENCE_VERSION,
      value,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore persistence failures so runtime behavior is unaffected.
  }
}

export function removePersistence(key: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore remove failures.
  }
}
