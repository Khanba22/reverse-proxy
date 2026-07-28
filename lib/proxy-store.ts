export interface CustomHeader {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface ProxyConfig {
  targetUrl: string;
  isActive: boolean;
  customHeaders: CustomHeader[];
}

export interface RequestLog {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  fullTargetUrl: string;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  status: number;
  statusText: string;
  responseHeaders: Record<string, string>;
  responseBody: string | null;
  durationMs: number;
  error?: string;
}

class ProxyStore {
  private config: ProxyConfig = {
    targetUrl: "https://httpbin.org",
    isActive: true,
    customHeaders: [
      { id: "1", key: "X-Forwarded-By", value: "Reverse-Proxy-UI", enabled: true },
    ],
  };

  private logs: RequestLog[] = [];
  private maxLogs = 100;

  getConfig(): ProxyConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<ProxyConfig>): ProxyConfig {
    if (newConfig.targetUrl !== undefined) {
      let url = newConfig.targetUrl.trim();
      if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://${url}`;
      }
      this.config.targetUrl = url.replace(/\/+$/, "");
    }

    if (newConfig.isActive !== undefined) {
      this.config.isActive = newConfig.isActive;
    }

    if (newConfig.customHeaders !== undefined) {
      this.config.customHeaders = newConfig.customHeaders;
    }

    return this.getConfig();
  }

  addLog(log: RequestLog): void {
    this.logs.unshift(log);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
  }

  getLogs(): RequestLog[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}

// Preserve store instance across HMR in development
const globalForProxy = globalThis as unknown as {
  proxyStore: ProxyStore | undefined;
};

export const proxyStore = globalForProxy.proxyStore ?? new ProxyStore();

if (process.env.NODE_ENV !== "production") {
  globalForProxy.proxyStore = proxyStore;
}
