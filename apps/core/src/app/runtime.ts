import { ExtensionHost } from "../modules/extensions/extensionHost";
import { MockService } from "../modules/mock/mockService";
import { CertificateManager } from "../modules/proxy/certificateManager";
import { ProxyEngine } from "../modules/proxy/proxyEngine";
import { ProxyService } from "../modules/proxy/proxyService";
import { RequestService } from "../modules/requests/requestService";
import { StorageAdapter } from "../modules/storage/storageAdapter";

export interface PolarisRuntime {
  storage: StorageAdapter;
  extensionHost: ExtensionHost;
  proxyService: ProxyService;
  mockService: MockService;
  requestService: RequestService;
  certificateManager: CertificateManager;
  proxyEngine: ProxyEngine;
}

export async function createRuntime(): Promise<PolarisRuntime> {
  const storage = new StorageAdapter();
  await storage.init();

  const extensionHost = new ExtensionHost();
  const proxyService = new ProxyService(storage);
  const mockService = new MockService(storage, extensionHost);
  const requestService = new RequestService(storage, mockService, extensionHost);
  const certificateManager = new CertificateManager();
  await certificateManager.init();
  await proxyService.setCertificateInstalled(await certificateManager.isRootCertificateTrusted());
  const proxyEngine = new ProxyEngine(requestService, mockService, certificateManager);

  return {
    storage,
    extensionHost,
    proxyService,
    mockService,
    requestService,
    certificateManager,
    proxyEngine
  };
}
