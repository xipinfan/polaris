import { randomUUID } from "node:crypto";
import type {
  RequestFilters,
  RunRequestInput,
  SaveRequestInput
} from "@polaris/shared-contracts";
import type { RequestRecord, SavedRequest } from "@polaris/shared-types";
import { ExtensionHost } from "../extensions/extensionHost";
import { MockService } from "../mock/mockService";
import { StorageAdapter } from "../storage/storageAdapter";
import { normalizeBody } from "../../shared/normalizeBody";
import {
  normalizeCapturedBody,
  parseSearchParamsRecord,
} from "../../shared/requestParsing";

function parseQuery(url: string) {
  const parsed = new URL(url);
  return parseSearchParamsRecord(parsed.searchParams);
}

async function readResponseBody(response: Response): Promise<unknown> {
  const headers = Object.fromEntries(response.headers.entries());
  const buffer = Buffer.from(await response.arrayBuffer());
  return normalizeCapturedBody(buffer, headers);
}

export class RequestService {
  constructor(
    private readonly storage: StorageAdapter,
    private readonly mockService: MockService,
    private readonly extensionHost: ExtensionHost
  ) {}

  list(filters?: RequestFilters): RequestRecord[] {
    const requests = this.storage.getRequests();
    if (!filters) {
      return requests;
    }

    const filtered = requests.filter((item) => {
      const keywordMatch =
        !filters.keyword ||
        item.url.includes(filters.keyword) ||
        JSON.stringify(item.requestBody ?? "").includes(filters.keyword);
      const methodMatch = !filters.method || item.method === filters.method.toUpperCase();
      const statusMatch = !filters.statusCode || item.statusCode === filters.statusCode;
      const hostMatch = !filters.host || item.host === filters.host;
      return keywordMatch && methodMatch && statusMatch && hostMatch;
    });

    return typeof filters.limit === "number" ? filtered.slice(0, filters.limit) : filtered;
  }

  getById(id: string): RequestRecord | undefined {
    return this.storage.getRequests().find((item) => item.id === id);
  }

  async capture(record: RequestRecord): Promise<void> {
    await this.extensionHost.emit("onRequestCaptured", record);
    await this.storage.appendRequest(record);
  }

  async clear(): Promise<void> {
    await this.storage.clearRequests();
  }

  listSaved(): SavedRequest[] {
    return this.storage.getSavedRequests();
  }

  getSavedById(id: string): SavedRequest | undefined {
    return this.listSaved().find((item) => item.id === id);
  }

  async save(input: SaveRequestInput): Promise<SavedRequest> {
    const sourceRecord = input.requestId ? this.getById(input.requestId) : undefined;
    if (!sourceRecord && !input.url) {
      throw new Error("Request source or manual request body is required");
    }

    const payload: SavedRequest = {
      id: randomUUID(),
      name: input.name,
      method: (input.method ?? sourceRecord?.method ?? "GET").toUpperCase(),
      url: input.url ?? sourceRecord!.url,
      headers: input.headers ?? sourceRecord?.requestHeaders ?? {},
      query: input.query ?? (sourceRecord ? sourceRecord.requestQuery : {}),
      body: normalizeBody(input.body ?? sourceRecord?.requestBody),
      tags: input.tags ?? [],
      sourceType: sourceRecord ? "captured" : "manual",
      sourceRequestId: sourceRecord?.id,
      updatedAt: new Date().toISOString()
    };

    await this.extensionHost.emit("beforeRequestSave", payload);
    await this.storage.setSavedRequests([payload, ...this.listSaved()]);
    await this.extensionHost.emit("afterRequestSave", payload);
    return payload;
  }

  async updateSaved(id: string, input: SaveRequestInput): Promise<SavedRequest> {
    const existing = this.getSavedById(id);
    if (!existing) {
      throw new Error("Saved request not found");
    }

    const nextItem: SavedRequest = {
      ...existing,
      ...input,
      method: (input.method ?? existing.method).toUpperCase(),
      body: normalizeBody(input.body ?? existing.body),
      updatedAt: new Date().toISOString()
    };

    await this.storage.setSavedRequests(this.listSaved().map((item) => (item.id === id ? nextItem : item)));
    return nextItem;
  }

  async removeSaved(id: string): Promise<void> {
    await this.storage.setSavedRequests(this.listSaved().filter((item) => item.id !== id));
  }

  private async performRequest(input: RunRequestInput, source: "proxy" | "debug"): Promise<RequestRecord> {
    const requestUrl = new URL(input.url);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      requestUrl.searchParams.set(key, value);
    }

    const mockRule = await this.mockService.match(input.method, requestUrl.toString());
    const startedAt = Date.now();

    if (mockRule) {
      await this.mockService.registerHit(mockRule.id);
      const record: RequestRecord = {
        id: randomUUID(),
        method: input.method.toUpperCase(),
        url: requestUrl.toString(),
        host: requestUrl.host,
        path: requestUrl.pathname,
        statusCode: mockRule.responseStatus,
        duration: Date.now() - startedAt,
        requestHeaders: input.headers ?? {},
        requestQuery: parseSearchParamsRecord(requestUrl.searchParams),
        requestBody: normalizeBody(input.body),
        responseHeaders: mockRule.responseHeaders,
        responseBody: mockRule.responseBody,
        createdAt: new Date().toISOString(),
        source,
        secure: requestUrl.protocol === "https:"
      };
      await this.capture(record);
      return record;
    }

    await this.extensionHost.emit("beforeRequestReplay", input);

    const response = await fetch(requestUrl, {
      method: input.method.toUpperCase(),
      headers: input.headers,
      body: input.body && input.method.toUpperCase() !== "GET" ? JSON.stringify(input.body) : undefined
    });

    const responseBody = await readResponseBody(response);
    const record: RequestRecord = {
      id: randomUUID(),
      method: input.method.toUpperCase(),
      url: requestUrl.toString(),
      host: requestUrl.host,
      path: requestUrl.pathname,
      statusCode: response.status,
      duration: Date.now() - startedAt,
      requestHeaders: input.headers ?? {},
      requestQuery: parseSearchParamsRecord(requestUrl.searchParams),
      requestBody: normalizeBody(input.body),
      responseHeaders: Object.fromEntries(response.headers.entries()),
      responseBody: normalizeBody(responseBody),
      createdAt: new Date().toISOString(),
      source,
      secure: requestUrl.protocol === "https:"
    };

    await this.capture(record);
    await this.extensionHost.emit("afterRequestReplay", record);
    return record;
  }

  async replayRequest(id: string): Promise<RequestRecord> {
    const captured = this.getById(id);
    if (captured) {
      return this.performRequest(
        {
          method: captured.method,
          url: captured.url,
          headers: captured.requestHeaders,
          query: captured.requestQuery,
          body: captured.requestBody
        },
        "debug"
      );
    }

    const saved = this.getSavedById(id);
    if (!saved) {
      throw new Error("Request not found");
    }

    return this.performRequest(
      {
        method: saved.method,
        url: saved.url,
        headers: saved.headers,
        query: saved.query,
        body: saved.body
      },
      "debug"
    );
  }

  async run(input: RunRequestInput): Promise<RequestRecord> {
    return this.performRequest(input, "debug");
  }

  buildCurl(record: RequestRecord | SavedRequest): string {
    const headers = Object.entries("requestHeaders" in record ? record.requestHeaders : record.headers)
      .map(([key, value]) => `-H "${key}: ${value}"`)
      .join(" ");
    const body = "requestBody" in record ? record.requestBody : record.body;
    const payload = body ? ` --data '${typeof body === "string" ? body : JSON.stringify(body)}'` : "";
    return `curl -X ${record.method} "${record.url}" ${headers}${payload}`.trim();
  }

  hydrateManualInput(id: string): RunRequestInput | undefined {
    const captured = this.getById(id);
    if (captured) {
      return {
        method: captured.method,
        url: captured.url,
        headers: captured.requestHeaders,
        query: parseQuery(captured.url),
        body: captured.requestBody
      };
    }

    const saved = this.getSavedById(id);
    if (!saved) {
      return undefined;
    }

    return {
      method: saved.method,
      url: saved.url,
      headers: saved.headers,
      query: saved.query,
      body: saved.body
    };
  }
}
