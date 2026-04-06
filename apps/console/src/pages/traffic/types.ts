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
  | "tools";

export type CertificatePlatform = "windows" | "mac" | "other";
