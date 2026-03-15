export type TrafficFocusMode =
  | "all"
  | "errors"
  | "https"
  | "debug"
  | "mock"
  | "proxyForward"
  | "direct";

export type TrafficInspectorTab =
  | "overview"
  | "timeline"
  | "composer"
  | "tools";

export type CertificatePlatform = "windows" | "mac" | "other";
