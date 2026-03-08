import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import forge from "node-forge";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certificateDir = path.resolve(__dirname, "../../../data/certificates");
const authorityKeyPath = path.join(certificateDir, "polaris-root-ca.key.pem");
const authorityCertPath = path.join(certificateDir, "polaris-root-ca.cert.pem");
const hostCertificateDir = path.join(certificateDir, "hosts");
const authorityCommonName = "Polaris Development Root CA";
const execFileAsync = promisify(execFile);

type ForgeCertificate = forge.pki.Certificate;
type ForgePrivateKey = forge.pki.rsa.PrivateKey;

function fileExists(targetPath: string): Promise<boolean> {
  return readFile(targetPath)
    .then(() => true)
    .catch(() => false);
}

function createSerialNumber(): string {
  const serial = randomBytes(16).toString("hex");
  return `01${serial.slice(2)}`;
}

function toFutureDate(offsetMs: number): Date {
  return new Date(Date.now() + offsetMs);
}

function hostCacheKey(host: string): string {
  return Buffer.from(host.toLowerCase(), "utf8").toString("base64url");
}

function buildDistinguishedName(commonName: string): forge.pki.CertificateField[] {
  return [
    { name: "commonName", value: commonName },
    { shortName: "O", value: "Polaris" },
    { name: "countryName", value: "CN" }
  ];
}

function isIpAddress(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

export class CertificateManager {
  private authority?: { key: ForgePrivateKey; cert: ForgeCertificate };

  async init(): Promise<void> {
    await mkdir(hostCertificateDir, { recursive: true });
    await this.loadOrCreateAuthority();
  }

  isReady(): boolean {
    return Boolean(this.authority);
  }

  getRootCertificatePath(): string {
    return authorityCertPath;
  }

  async getRootCertificatePem(): Promise<string> {
    await this.ensureAuthority();
    return readFile(authorityCertPath, "utf8");
  }

  async isRootCertificateTrusted(): Promise<boolean> {
    await this.ensureAuthority();

    if (!this.authority) {
      return false;
    }

    const thumbprint = this.getRootCertificateThumbprint();

    try {
      if (process.platform === "win32") {
        const command =
          "[System.String]::Join(\"`n\", ((Get-ChildItem Cert:\\CurrentUser\\Root), (Get-ChildItem Cert:\\LocalMachine\\Root) | Select-Object -ExpandProperty Thumbprint))";
        const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], {
          windowsHide: true,
          encoding: "utf8"
        });
        return stdout
          .split(/\r?\n/)
          .map((line) => line.trim().toUpperCase())
          .filter(Boolean)
          .includes(thumbprint);
      }

      if (process.platform === "darwin") {
        const { stdout } = await execFileAsync("security", ["find-certificate", "-a", "-Z"], {
          encoding: "utf8"
        });
        return Array.from(stdout.matchAll(/SHA-1 hash:\s*([A-F0-9]+)/gi))
          .map((match) => match[1].toUpperCase())
          .includes(thumbprint);
      }
    } catch {
      return false;
    }

    return false;
  }

  async getServerCredentials(hostname: string): Promise<{ key: string; cert: string }> {
    const host = hostname.toLowerCase();
    await this.ensureAuthority();

    const cacheKey = hostCacheKey(host);
    const keyPath = path.join(hostCertificateDir, `${cacheKey}.key.pem`);
    const certPath = path.join(hostCertificateDir, `${cacheKey}.cert.pem`);

    if ((await fileExists(keyPath)) && (await fileExists(certPath))) {
      const [key, cert] = await Promise.all([readFile(keyPath, "utf8"), readFile(certPath, "utf8")]);
      return { key, cert };
    }

    const credentials = this.createServerCertificate(host);
    await Promise.all([
      writeFile(keyPath, credentials.key, "utf8"),
      writeFile(certPath, credentials.cert, "utf8")
    ]);
    return credentials;
  }

  private async ensureAuthority(): Promise<void> {
    if (!this.authority) {
      await this.loadOrCreateAuthority();
    }
  }

  private getRootCertificateThumbprint(): string {
    if (!this.authority) {
      throw new Error("Certificate authority is not initialized");
    }

    const asn1 = forge.pki.certificateToAsn1(this.authority.cert);
    const derBytes = forge.asn1.toDer(asn1).getBytes();
    return forge.md.sha1.create().update(derBytes).digest().toHex().toUpperCase();
  }

  private async loadOrCreateAuthority(): Promise<void> {
    if ((await fileExists(authorityKeyPath)) && (await fileExists(authorityCertPath))) {
      const [keyPem, certPem] = await Promise.all([
        readFile(authorityKeyPath, "utf8"),
        readFile(authorityCertPath, "utf8")
      ]);
      this.authority = {
        key: forge.pki.privateKeyFromPem(keyPem),
        cert: forge.pki.certificateFromPem(certPem)
      };
      return;
    }

    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    const subject = buildDistinguishedName(authorityCommonName);
    cert.publicKey = keys.publicKey;
    cert.serialNumber = createSerialNumber();
    cert.validity.notBefore = new Date(Date.now() - 60_000);
    cert.validity.notAfter = toFutureDate(1000 * 60 * 60 * 24 * 365 * 5);
    cert.setSubject(subject);
    cert.setIssuer(subject);
    cert.setExtensions([
      { name: "basicConstraints", cA: true },
      { name: "keyUsage", keyCertSign: true, cRLSign: true, digitalSignature: true },
      { name: "subjectKeyIdentifier" }
    ]);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const certPem = forge.pki.certificateToPem(cert);
    await Promise.all([
      writeFile(authorityKeyPath, keyPem, "utf8"),
      writeFile(authorityCertPath, certPem, "utf8")
    ]);

    this.authority = { key: keys.privateKey, cert };
  }

  private createServerCertificate(host: string): { key: string; cert: string } {
    if (!this.authority) {
      throw new Error("Certificate authority is not initialized");
    }

    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = createSerialNumber();
    cert.validity.notBefore = new Date(Date.now() - 60_000);
    cert.validity.notAfter = toFutureDate(1000 * 60 * 60 * 24 * 397);
    cert.setSubject(buildDistinguishedName(host));
    cert.setIssuer(this.authority.cert.subject.attributes);
    cert.setExtensions([
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
      { name: "extKeyUsage", serverAuth: true },
      {
        name: "subjectAltName",
        altNames: isIpAddress(host) ? [{ type: 7, ip: host }] : [{ type: 2, value: host }]
      },
      { name: "subjectKeyIdentifier" },
      { name: "authorityKeyIdentifier", keyIdentifier: true }
    ]);
    cert.sign(this.authority.key, forge.md.sha256.create());

    return {
      key: forge.pki.privateKeyToPem(keys.privateKey),
      cert: forge.pki.certificateToPem(cert)
    };
  }
}
