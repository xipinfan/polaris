import { spawn } from "node:child_process";

const COMMAND_TIMEOUT_MS = 5_000;
const SYSTEM_PROXY_BYPASS = ["localhost", "127.0.0.1", "::1", "*.local"];

export interface SystemProxyManager {
  enable(host: string, port: number): Promise<void>;
  disable(): Promise<void>;
  isEnabled(): Promise<boolean>;
}

type CommandResult = {
  stdout: string;
  stderr: string;
  code: number | null;
};

function isCommandNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  return code.toUpperCase() === "ENOENT" || /ENOENT|not found/i.test(message);
}

function runCommand(
  command: string,
  args: string[],
  options?: {
    timeoutMs?: number;
    allowFailure?: boolean;
  },
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeoutMs = options?.timeoutMs ?? COMMAND_TIMEOUT_MS;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill();
      reject(new Error(`Command timed out: ${command} ${args.join(" ")}`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (!options?.allowFailure && code !== 0) {
        reject(new Error(stderr.trim() || `Command failed: ${command} ${args.join(" ")}`));
        return;
      }
      resolve({ stdout, stderr, code });
    });
  });
}

async function runPowerShellScript(script: string, allowFailure = false): Promise<CommandResult> {
  try {
    return await runCommand("pwsh", ["-NoProfile", "-Command", script], { allowFailure });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/ENOENT/i.test(message)) {
      throw error;
    }
    return runCommand("powershell.exe", ["-NoProfile", "-Command", script], { allowFailure });
  }
}

class DarwinSystemProxyManager implements SystemProxyManager {
  private async listActiveServices(): Promise<string[]> {
    const { stdout } = await runCommand("networksetup", ["-listallnetworkservices"], {
      allowFailure: true,
    });
    const services = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("*"));

    const activeServices: string[] = [];
    for (const service of services) {
      const info = await runCommand("networksetup", ["-getinfo", service], { allowFailure: true });
      if (/IP address:\s+\d+\.\d+\.\d+\.\d+/i.test(info.stdout)) {
        activeServices.push(service);
      }
    }
    return activeServices;
  }

  async enable(host: string, port: number): Promise<void> {
    const services = await this.listActiveServices();
    for (const service of services) {
      await runCommand("networksetup", ["-setwebproxy", service, host, String(port)]);
      await runCommand("networksetup", ["-setsecurewebproxy", service, host, String(port)]);
      await runCommand("networksetup", ["-setproxybypassdomains", service, ...SYSTEM_PROXY_BYPASS]);
      await runCommand("networksetup", ["-setwebproxystate", service, "on"]);
      await runCommand("networksetup", ["-setsecurewebproxystate", service, "on"]);
    }
  }

  async disable(): Promise<void> {
    const services = await this.listActiveServices();
    for (const service of services) {
      await runCommand("networksetup", ["-setwebproxystate", service, "off"], { allowFailure: true });
      await runCommand("networksetup", ["-setsecurewebproxystate", service, "off"], { allowFailure: true });
    }
  }

  async isEnabled(): Promise<boolean> {
    const services = await this.listActiveServices();
    for (const service of services) {
      const web = await runCommand("networksetup", ["-getwebproxy", service], { allowFailure: true });
      const secure = await runCommand("networksetup", ["-getsecurewebproxy", service], { allowFailure: true });
      if (/Enabled:\s+Yes/i.test(web.stdout) || /Enabled:\s+Yes/i.test(secure.stdout)) {
        return true;
      }
    }
    return false;
  }
}

class WindowsSystemProxyManager implements SystemProxyManager {
  async enable(host: string, port: number): Promise<void> {
    const proxyServer = `${host}:${port}`;
    const script = `
$path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"
Set-ItemProperty -Path $path -Name ProxyEnable -Type DWord -Value 1
Set-ItemProperty -Path $path -Name ProxyServer -Value "http=${proxyServer};https=${proxyServer}"
Set-ItemProperty -Path $path -Name ProxyOverride -Value "${SYSTEM_PROXY_BYPASS.join(";")}"
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinInetNative {
  [DllImport("wininet.dll", SetLastError=true)]
  public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);
}
"@
[WinInetNative]::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0) | Out-Null
[WinInetNative]::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0) | Out-Null
`;
    await runPowerShellScript(script);
  }

  async disable(): Promise<void> {
    const script = `
$path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"
Set-ItemProperty -Path $path -Name ProxyEnable -Type DWord -Value 0
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinInetNative {
  [DllImport("wininet.dll", SetLastError=true)]
  public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);
}
"@
[WinInetNative]::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0) | Out-Null
[WinInetNative]::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0) | Out-Null
`;
    await runPowerShellScript(script, true);
  }

  async isEnabled(): Promise<boolean> {
    const script = `
$path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"
$value = (Get-ItemProperty -Path $path -Name ProxyEnable -ErrorAction SilentlyContinue).ProxyEnable
if ($value -eq 1) { "true" } else { "false" }
`;
    const result = await runPowerShellScript(script, true);
    return result.stdout.trim().toLowerCase() === "true";
  }
}

class LinuxSystemProxyManager implements SystemProxyManager {
  async enable(host: string, port: number): Promise<void> {
    try {
      await runCommand("gsettings", ["set", "org.gnome.system.proxy", "mode", "manual"]);
      await runCommand("gsettings", ["set", "org.gnome.system.proxy.http", "host", host]);
      await runCommand("gsettings", ["set", "org.gnome.system.proxy.http", "port", String(port)]);
      await runCommand("gsettings", ["set", "org.gnome.system.proxy.https", "host", host]);
      await runCommand("gsettings", ["set", "org.gnome.system.proxy.https", "port", String(port)]);
      await runCommand("gsettings", [
        "set",
        "org.gnome.system.proxy",
        "ignore-hosts",
        `['${SYSTEM_PROXY_BYPASS.join("','")}']`,
      ]);
    } catch (error) {
      if (isCommandNotFoundError(error)) {
        return;
      }
      throw error;
    }
  }

  async disable(): Promise<void> {
    try {
      await runCommand("gsettings", ["set", "org.gnome.system.proxy", "mode", "none"], {
        allowFailure: true,
      });
    } catch (error) {
      if (isCommandNotFoundError(error)) {
        return;
      }
      throw error;
    }
  }

  async isEnabled(): Promise<boolean> {
    try {
      const result = await runCommand("gsettings", ["get", "org.gnome.system.proxy", "mode"], {
        allowFailure: true,
      });
      return result.stdout.toLowerCase().includes("manual");
    } catch (error) {
      if (isCommandNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }
}

class NoopSystemProxyManager implements SystemProxyManager {
  async enable(_host: string, _port: number): Promise<void> {
    // noop
  }

  async disable(): Promise<void> {
    // noop
  }

  async isEnabled(): Promise<boolean> {
    return false;
  }
}

export function createSystemProxyManager(): SystemProxyManager {
  if (process.platform === "darwin") {
    return new DarwinSystemProxyManager();
  }
  if (process.platform === "win32") {
    return new WindowsSystemProxyManager();
  }
  if (process.platform === "linux") {
    return new LinuxSystemProxyManager();
  }
  return new NoopSystemProxyManager();
}
