import { generateKeyPair, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import tls from "node:tls";
import { promisify } from "node:util";
import forge from "node-forge";
import { ensurePolarisDir, getPolarisDataPath, migrateLegacyFile } from "../../app/paths";

const certificateDir = getPolarisDataPath("data", "certificates");
const authorityKeyPath = path.join(certificateDir, "polaris-root-ca.key.pem");
const authorityCertPath = path.join(certificateDir, "polaris-root-ca.cert.pem");
const hostCertificateDir = path.join(certificateDir, "hosts");
const authorityCommonName = "Polaris Development Root CA";
const execFileAsync = promisify(execFile);
const generateKeyPairAsync = promisify(generateKeyPair);
const NOT_BEFORE_OFFSET_MS = 1000 * 60 * 60 * 24;
const CERT_RENEWAL_BUFFER_MS = 1000 * 60 * 60 * 24 * 7;

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

async function safeUnlink(targetPath: string): Promise<void> {
  try {
    await unlink(targetPath);
  } catch {}
}

export class CertificateManager {
  private authority?: { key: ForgePrivateKey; cert: ForgeCertificate };
  private authorityFingerprint = "";
  private secureContextCache = new Map<string, tls.SecureContext>();
  private credentialsCache = new Map<string, { key: string; cert: string }>();
  private pendingCredentials = new Map<string, Promise<{ key: string; cert: string }>>();

  async init(): Promise<void> {
    await ensurePolarisDir("data", "certificates", "hosts");
    await Promise.all([
      migrateLegacyFile("data/certificates/polaris-root-ca.key.pem"),
      migrateLegacyFile("data/certificates/polaris-root-ca.cert.pem")
    ]);
    await this.loadOrCreateAuthority();
    await this.purgeStaleHostCertificates();
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
          '[System.String]::Join("`n", ((Get-ChildItem Cert:\\CurrentUser\\Root), (Get-ChildItem Cert:\\LocalMachine\\Root) | ForEach-Object { $_.Thumbprint }))';
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

  async getSecureContext(hostname: string): Promise<tls.SecureContext> {
    const host = hostname.toLowerCase();
    const cached = this.secureContextCache.get(host);
    if (cached) {
      return cached;
    }

    const credentials = await this.getServerCredentials(host);
    const secureContext = tls.createSecureContext(credentials);
    this.secureContextCache.set(host, secureContext);
    return secureContext;
  }

  async getServerCredentials(hostname: string): Promise<{ key: string; cert: string }> {
    const host = hostname.toLowerCase();
    await this.ensureAuthority();

    const cached = this.credentialsCache.get(host);
    if (cached) {
      return cached;
    }

    const pending = this.pendingCredentials.get(host);
    if (pending) {
      return pending;
    }

    const nextCredentials = this.loadOrCreateCredentials(host).finally(() => {
      this.pendingCredentials.delete(host);
    });
    this.pendingCredentials.set(host, nextCredentials);
    const resolved = await nextCredentials;
    this.credentialsCache.set(host, resolved);
    return resolved;
  }

  private async loadOrCreateCredentials(host: string): Promise<{ key: string; cert: string }> {
    const cacheKey = hostCacheKey(host);
    const keyPath = path.join(hostCertificateDir, `${cacheKey}.key.pem`);
    const certPath = path.join(hostCertificateDir, `${cacheKey}.cert.pem`);

    if ((await fileExists(keyPath)) && (await fileExists(certPath))) {
      const [key, cert] = await Promise.all([readFile(keyPath, "utf8"), readFile(certPath, "utf8")]);
      if (this.isHostCertificateValid(cert)) {
        return { key, cert: this.ensureCertChain(cert) };
      }
      await Promise.all([safeUnlink(keyPath), safeUnlink(certPath)]);
      this.secureContextCache.delete(host);
    }

    const credentials = await this.createServerCertificate(host);
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
      this.authorityFingerprint = this.computeCertFingerprint(this.authority.cert);
      return;
    }

    const { publicKey, privateKey } = await this.generateForgeKeyPairAsync();
    const cert = forge.pki.createCertificate();
    const subject = buildDistinguishedName(authorityCommonName);
    cert.publicKey = publicKey;
    cert.serialNumber = createSerialNumber();
    cert.validity.notBefore = new Date(Date.now() - NOT_BEFORE_OFFSET_MS);
    cert.validity.notAfter = toFutureDate(1000 * 60 * 60 * 24 * 365 * 5);
    cert.setSubject(subject);
    cert.setIssuer(subject);
    cert.setExtensions([
      { name: "basicConstraints", cA: true },
      { name: "keyUsage", keyCertSign: true, cRLSign: true, digitalSignature: true },
      { name: "subjectKeyIdentifier" }
    ]);
    cert.sign(privateKey, forge.md.sha256.create());

    const keyPem = forge.pki.privateKeyToPem(privateKey);
    const certPem = forge.pki.certificateToPem(cert);
    await Promise.all([
      writeFile(authorityKeyPath, keyPem, "utf8"),
      writeFile(authorityCertPath, certPem, "utf8")
    ]);

    this.authority = { key: privateKey, cert };
    this.authorityFingerprint = this.computeCertFingerprint(cert);
  }

  private async createServerCertificate(host: string): Promise<{ key: string; cert: string }> {
    if (!this.authority) {
      throw new Error("Certificate authority is not initialized");
    }

    const { publicKey, privateKey } = await this.generateForgeKeyPairAsync();
    const cert = forge.pki.createCertificate();
    cert.publicKey = publicKey;
    cert.serialNumber = createSerialNumber();
    cert.validity.notBefore = new Date(Date.now() - NOT_BEFORE_OFFSET_MS);
    cert.validity.notAfter = toFutureDate(1000 * 60 * 60 * 24 * 397);
    cert.setSubject(buildDistinguishedName(host));
    cert.setIssuer(this.authority.cert.subject.attributes);
    const issuerKeyIdentifier = forge.pki
      .getPublicKeyFingerprint(this.authority.cert.publicKey, { type: "RSAPublicKey" })
      .getBytes();
    cert.setExtensions([
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
      { name: "extKeyUsage", serverAuth: true },
      {
        name: "subjectAltName",
        altNames: isIpAddress(host) ? [{ type: 7, ip: host }] : [{ type: 2, value: host }]
      },
      { name: "subjectKeyIdentifier" },
      { name: "authorityKeyIdentifier", keyIdentifier: issuerKeyIdentifier }
    ]);
    cert.sign(this.authority.key, forge.md.sha256.create());

    const domainCertPem = forge.pki.certificateToPem(cert);
    const caCertPem = forge.pki.certificateToPem(this.authority.cert);

    return {
      key: forge.pki.privateKeyToPem(privateKey),
      cert: `${domainCertPem}${caCertPem}`
    };
  }

  private async generateForgeKeyPairAsync(): Promise<{ publicKey: forge.pki.rsa.PublicKey; privateKey: ForgePrivateKey }> {
    const { publicKey, privateKey } = await generateKeyPairAsync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    return {
      publicKey: forge.pki.publicKeyFromPem(publicKey),
      privateKey: forge.pki.privateKeyFromPem(privateKey)
    };
  }

  private computeCertFingerprint(cert: ForgeCertificate): string {
    const asn1 = forge.pki.certificateToAsn1(cert);
    const derBytes = forge.asn1.toDer(asn1).getBytes();
    return forge.md.sha1.create().update(derBytes).digest().toHex().toUpperCase();
  }

  private ensureCertChain(certPem: string): string {
    if (!this.authority) {
      return certPem;
    }
    const caCertPem = forge.pki.certificateToPem(this.authority.cert);
    if (certPem.includes(caCertPem.trim())) {
      return certPem;
    }
    return `${certPem}${caCertPem}`;
  }

  private isHostCertificateValid(certPem: string): boolean {
    try {
      const cert = forge.pki.certificateFromPem(certPem);
      const renewalDeadline = new Date(Date.now() + CERT_RENEWAL_BUFFER_MS);
      if (cert.validity.notAfter < renewalDeadline) {
        return false;
      }
      if (this.authority) {
        try {
          return this.authority.cert.verify(cert);
        } catch {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  private async purgeStaleHostCertificates(): Promise<void> {
    try {
      if (!this.authority || !this.authorityFingerprint) {
        return;
      }
      const files = await readdir(hostCertificateDir);
      const certFiles = files.filter((fileName) => fileName.endsWith(".cert.pem"));
      for (const certFile of certFiles) {
        try {
          const certPath = path.join(hostCertificateDir, certFile);
          const certPem = await readFile(certPath, "utf8");
          if (this.isHostCertificateValid(certPem)) {
            continue;
          }
          const keyFile = certFile.replace(/\.cert\.pem$/, ".key.pem");
          await Promise.all([
            safeUnlink(path.join(hostCertificateDir, keyFile)),
            safeUnlink(certPath)
          ]);
        } catch {}
      }
      this.secureContextCache.clear();
      this.credentialsCache.clear();
    } catch {}
  }
}
