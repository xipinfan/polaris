import os from "node:os";

function isIpv4Family(family: string | number): boolean {
  return family === "IPv4" || family === 4;
}

const VIRTUAL_INTERFACE_PATTERNS = [
  /loopback/i,
  /docker/i,
  /tailscale/i,
  /vmware/i,
  /virtual/i,
  /vbox/i,
  /hyper-v/i,
  /vethernet/i,
  /wsl/i,
  /zt/i,
  /bridge/i,
  /tap/i,
  /tun/i
];

const PREFERRED_INTERFACE_PATTERNS = [
  /wi-?fi/i,
  /wireless/i,
  /wlan/i,
  /^wl/i,
  /ethernet/i,
  /^en/i,
  /^eth/i
];

function scoreInterface(name: string): number {
  if (VIRTUAL_INTERFACE_PATTERNS.some((pattern) => pattern.test(name))) {
    return -100;
  }

  const preferredIndex = PREFERRED_INTERFACE_PATTERNS.findIndex((pattern) => pattern.test(name));
  if (preferredIndex >= 0) {
    return 100 - preferredIndex * 10;
  }

  return 0;
}

export function getLanIpv4Address(): string | undefined {
  const interfaces = os.networkInterfaces();
  const candidates: Array<{ name: string; address: string; score: number }> = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (!isIpv4Family(address.family) || address.internal) {
        continue;
      }

      if (!address.address || address.address.startsWith("169.254.")) {
        continue;
      }

      const score = scoreInterface(name);
      if (score < 0) {
        continue;
      }

      candidates.push({
        name,
        address: address.address,
        score
      });
    }
  }

  candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.name.localeCompare(right.name);
  });

  return candidates[0]?.address;
}
