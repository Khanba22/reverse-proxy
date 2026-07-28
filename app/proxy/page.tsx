"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Send,
  Plus,
  Play,
  Activity,
  Code2,
  Search,
  Clock,
  Terminal,
  Globe,
  Sliders,
} from "lucide-react";

interface CustomHeader {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

interface ProxyConfig {
  targetUrl: string;
  isActive: boolean;
  customHeaders: CustomHeader[];
}

interface RequestLog {
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

const PRESETS = [
  { label: "httpbin.org", url: "https://httpbin.org" },
  { label: "JSONPlaceholder", url: "https://jsonplaceholder.typicode.com" },
  { label: "DummyJSON", url: "https://dummyjson.com" },
  { label: "ReqRes", url: "https://reqres.in" },
];

export default function ProxyDashboard() {
  const [config, setConfig] = useState<ProxyConfig>({
    targetUrl: "https://httpbin.org",
    isActive: true,
    customHeaders: [],
  });

  const [inputUrl, setInputUrl] = useState("https://httpbin.org");
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null);
  const [copiedProxyUrl, setCopiedProxyUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingTarget, setTestingTarget] = useState(false);
  const [targetHealth, setTargetHealth] = useState<{
    ok: boolean;
    status?: number;
    durationMs?: number;
    error?: string;
  } | null>(null);

  // Filters & Tabs
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [inspectorTab, setInspectorTab] = useState<
    "response-body" | "request-body" | "headers" | "curl"
  >("response-body");
  const [activePanel, setActivePanel] = useState<"logs" | "sandbox" | "settings">("logs");

  // Sandbox Playground state
  const [sandboxMethod, setSandboxMethod] = useState("GET");
  const [sandboxPath, setSandboxPath] = useState("/get");
  const [sandboxBody, setSandboxBody] = useState('{\n  "name": "Proxy Test",\n  "active": true\n}');
  const [sandboxHeaders, setSandboxHeaders] = useState('{\n  "X-Custom-Test": "Hello"\n}');
  const [dispatchingSandbox, setDispatchingSandbox] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<any>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/proxy/api/config");
      if (res.ok) {
        const data: ProxyConfig = await res.json();
        setConfig(data);
        setInputUrl(data.targetUrl);
      }
    } catch (e) {
      console.error("Failed to load config", e);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/proxy/api/logs");
      if (res.ok) {
        const data: RequestLog[] = await res.json();
        setLogs(data);
        if (data.length > 0 && !selectedLog) {
          setSelectedLog(data[0]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch logs", e);
    }
  }, [selectedLog]);

  useEffect(() => {
    fetchConfig();
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [fetchConfig, fetchLogs]);

  const saveConfig = async (newPartial: Partial<ProxyConfig>) => {
    setSavingConfig(true);
    try {
      const res = await fetch("/proxy/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPartial),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
        setInputUrl(updated.targetUrl);
      }
    } catch (e) {
      console.error("Failed to update proxy settings", e);
    } finally {
      setSavingConfig(false);
    }
  };

  const testConnection = async (targetToTest?: string) => {
    setTestingTarget(true);
    setTargetHealth(null);
    try {
      const res = await fetch("/proxy/api/test-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: targetToTest || inputUrl }),
      });
      const data = await res.json();
      setTargetHealth(data);
    } catch (e: any) {
      setTargetHealth({ ok: false, error: e.message || "Network error" });
    } finally {
      setTestingTarget(false);
    }
  };

  const clearLogs = async () => {
    try {
      await fetch("/proxy/api/logs", { method: "DELETE" });
      setLogs([]);
      setSelectedLog(null);
    } catch (e) {
      console.error("Failed to clear logs", e);
    }
  };

  const dispatchSandboxRequest = async () => {
    setDispatchingSandbox(true);
    setSandboxResult(null);
    try {
      let parsedHeaders = {};
      try {
        if (sandboxHeaders.trim()) {
          parsedHeaders = JSON.parse(sandboxHeaders);
        }
      } catch {
        alert("Invalid Sandbox Headers JSON");
        setDispatchingSandbox(false);
        return;
      }

      let parsedBody = undefined;
      if (["POST", "PUT", "PATCH", "DELETE"].includes(sandboxMethod)) {
        try {
          parsedBody = sandboxBody.trim() ? JSON.parse(sandboxBody) : undefined;
        } catch {
          parsedBody = sandboxBody;
        }
      }

      const res = await fetch("/proxy/api/test-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: sandboxMethod,
          path: sandboxPath,
          headers: parsedHeaders,
          body: parsedBody,
        }),
      });

      const resultData = await res.json();
      setSandboxResult(resultData);
      fetchLogs();
    } catch (e: any) {
      setSandboxResult({ error: e.message || "Failed to dispatch request" });
    } finally {
      setDispatchingSandbox(false);
    }
  };

  const copyProxyUrl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    navigator.clipboard.writeText(`${origin}/*`);
    setCopiedProxyUrl(true);
    setTimeout(() => setCopiedProxyUrl(false), 2000);
  };

  const generateCurlCommand = (log: RequestLog) => {
    let curl = `curl -X ${log.method} "${log.fullTargetUrl}"`;
    Object.entries(log.requestHeaders).forEach(([k, v]) => {
      if (!["host", "content-length"].includes(k.toLowerCase())) {
        curl += ` \\\n  -H "${k}: ${v}"`;
      }
    });
    if (log.requestBody) {
      const escapedBody = log.requestBody.replace(/"/g, '\\"');
      curl += ` \\\n  -d "${escapedBody}"`;
    }
    return curl;
  };

  const copyCurl = (log: RequestLog) => {
    const cmd = generateCurlCommand(log);
    navigator.clipboard.writeText(cmd);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  // Header management
  const addHeader = () => {
    const newHeader: CustomHeader = {
      id: Date.now().toString(),
      key: "",
      value: "",
      enabled: true,
    };
    const updated = [...config.customHeaders, newHeader];
    saveConfig({ customHeaders: updated });
  };

  const updateHeader = (id: string, key: string, value: string, enabled: boolean) => {
    const updated = config.customHeaders.map((h) =>
      h.id === id ? { ...h, key, value, enabled } : h
    );
    saveConfig({ customHeaders: updated });
  };

  const removeHeader = (id: string) => {
    const updated = config.customHeaders.filter((h) => h.id !== id);
    saveConfig({ customHeaders: updated });
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.fullTargetUrl.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMethod = methodFilter === "ALL" || log.method === methodFilter;
    return matchesSearch && matchesMethod;
  });

  const formatJson = (val: string | null) => {
    if (!val) return "Empty Payload";
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return val;
    }
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "POST":
        return "bg-sky-500/10 text-sky-400 border-sky-500/30";
      case "PUT":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "DELETE":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "PATCH":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
    }
  };

  const getStatusBadgeClass = (status: number) => {
    if (status >= 200 && status < 300) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    if (status >= 300 && status < 400) return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
    if (status >= 400 && status < 500) return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    return "bg-rose-500/20 text-rose-300 border-rose-500/40";
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800/80 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center p-2.5 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl shadow-md shadow-indigo-500/20">
            <ArrowRightLeft className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">Reverse Proxy Control Center</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                /proxy
              </span>
            </div>
            <p className="text-xs text-zinc-400">All domain routes (including /) are forwarded verbatim</p>
          </div>
        </div>

        {/* Live Proxy Controls */}
        <div className="flex items-center gap-4">
          {/* Status Indicator */}
          <button
            onClick={() => saveConfig({ isActive: !config.isActive })}
            className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all duration-200 ${
              config.isActive
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 shadow-sm shadow-emerald-500/10"
                : "bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/20"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {config.isActive && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  config.isActive ? "bg-emerald-500" : "bg-rose-500"
                }`}
              ></span>
            </span>
            {config.isActive ? "Proxy Active" : "Proxy Disabled"}
          </button>

          {/* Proxy URL copy badge */}
          <button
            onClick={copyProxyUrl}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/80 rounded-lg text-zinc-300 transition-colors"
            title="Copy Domain Forwarding Rule"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>Forwarding All Traffic</span>
            {copiedProxyUrl ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </button>

          <button
            onClick={fetchLogs}
            className="p-2 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-lg transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Configuration & Preset Bar */}
      <section className="p-6 bg-gradient-to-b from-zinc-900/90 to-zinc-950 border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 shrink-0 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-indigo-400" />
                Target Destination URL:
              </label>

              <div className="relative flex-1">
                <input
                  type="url"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://api.example.com"
                  className="w-full px-4 py-2.5 text-sm bg-zinc-900 border border-zinc-700/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-zinc-500 font-mono shadow-inner"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => saveConfig({ targetUrl: inputUrl })}
                  disabled={savingConfig || inputUrl === config.targetUrl}
                  className="px-4 py-2.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl shadow-md shadow-indigo-600/20 transition-all"
                >
                  {savingConfig ? "Saving..." : "Set Target"}
                </button>

                <button
                  onClick={() => testConnection()}
                  disabled={testingTarget}
                  className="px-4 py-2.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-xl flex items-center gap-2 transition-all"
                >
                  <Activity className={`w-3.5 h-3.5 ${testingTarget ? "animate-spin text-indigo-400" : ""}`} />
                  Test Connectivity
                </button>
              </div>
            </div>

            {/* Target Health Badge */}
            {targetHealth && (
              <div
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border ${
                  targetHealth.ok
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                {targetHealth.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>
                  {targetHealth.ok
                    ? `Reachable (${targetHealth.status || 200}) - ${targetHealth.durationMs}ms latency`
                    : `Unreachable: ${targetHealth.error || "Connection refused"}`}
                </span>
              </div>
            )}
          </div>

          {/* Presets & Header Settings */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-zinc-500 font-medium mr-1">Quick Presets:</span>
              {PRESETS.map((preset) => (
                <button
                  key={preset.url}
                  onClick={() => {
                    setInputUrl(preset.url);
                    saveConfig({ targetUrl: preset.url });
                    testConnection(preset.url);
                  }}
                  className={`px-3 py-1 rounded-lg border text-xs font-mono transition-all ${
                    config.targetUrl === preset.url
                      ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
              <button
                onClick={() => setActivePanel("logs")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activePanel === "logs"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Live Inspector ({logs.length})
              </button>
              <button
                onClick={() => setActivePanel("sandbox")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activePanel === "sandbox"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                Request Sandbox
              </button>
              <button
                onClick={() => setActivePanel("settings")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activePanel === "settings"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Custom Headers ({config.customHeaders.length})
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 gap-6">
        {/* PANEL: Custom Headers Settings */}
        {activePanel === "settings" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                Injected Forwarding Headers
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                These key-value pairs will be automatically injected or overridden into every request before being forwarded to your target endpoint.
              </p>
            </div>

            <div className="space-y-3">
              {config.customHeaders.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl">
                  No custom headers configured yet. Click below to inject headers (e.g. API Keys, Authorization Tokens).
                </div>
              ) : (
                config.customHeaders.map((header) => (
                  <div key={header.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={header.enabled}
                      onChange={(e) =>
                        updateHeader(header.id, header.key, header.value, e.target.checked)
                      }
                      className="w-4 h-4 rounded accent-indigo-500 bg-zinc-800 border-zinc-700"
                    />
                    <input
                      type="text"
                      placeholder="Header Name (e.g. Authorization)"
                      value={header.key}
                      onChange={(e) =>
                        updateHeader(header.id, e.target.value, header.value, header.enabled)
                      }
                      className="flex-1 px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Header Value (e.g. Bearer token_xxx)"
                      value={header.value}
                      onChange={(e) =>
                        updateHeader(header.id, header.key, e.target.value, header.enabled)
                      }
                      className="flex-1 px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono"
                    />
                    <button
                      onClick={() => removeHeader(header.id)}
                      className="p-2 text-zinc-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={addHeader}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-indigo-300 border border-zinc-700/80 rounded-xl transition-all"
            >
              <Plus className="w-4 h-4" /> Add Custom Header
            </button>
          </div>
        )}

        {/* PANEL: Request Sandbox */}
        {activePanel === "sandbox" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-indigo-400" />
                Request Sandbox & Dispatcher
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Dispatch test requests directly through your domain root routes (<code className="text-indigo-300">/</code> or <code className="text-indigo-300">/anything</code>) to test forwarding behavior immediately.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1">
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Method</label>
                <select
                  value={sandboxMethod}
                  onChange={(e) => setSandboxMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
                  Subpath (e.g. / or /get or /v1/todos/1)
                </label>
                <input
                  type="text"
                  value={sandboxPath}
                  onChange={(e) => setSandboxPath(e.target.value)}
                  placeholder="/get or /post or /v1/todos/1"
                  className="w-full px-4 py-2 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
                  Request Headers (JSON format)
                </label>
                <textarea
                  rows={4}
                  value={sandboxHeaders}
                  onChange={(e) => setSandboxHeaders(e.target.value)}
                  className="w-full p-3 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded-xl text-emerald-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {["POST", "PUT", "PATCH", "DELETE"].includes(sandboxMethod) && (
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
                    Request Payload Body (JSON/Text)
                  </label>
                  <textarea
                    rows={4}
                    value={sandboxBody}
                    onChange={(e) => setSandboxBody(e.target.value)}
                    className="w-full p-3 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded-xl text-amber-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>

            <button
              onClick={dispatchSandboxRequest}
              disabled={dispatchingSandbox}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/25 transition-all"
            >
              <Send className={`w-3.5 h-3.5 ${dispatchingSandbox ? "animate-spin" : ""}`} />
              {dispatchingSandbox ? "Dispatching..." : "Dispatch Through Proxy"}
            </button>

            {sandboxResult && (
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400">Sandbox Dispatch Result</span>
                  <span
                    className={`px-2 py-0.5 text-xs rounded border ${
                      sandboxResult.status >= 200 && sandboxResult.status < 300
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    }`}
                  >
                    HTTP {sandboxResult.status} {sandboxResult.statusText}
                  </span>
                </div>
                <pre className="p-3 bg-zinc-900 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto max-h-60">
                  {formatJson(sandboxResult.body)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* PANEL: Live Logs Inspector */}
        {activePanel === "logs" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Log List */}
            <div className="lg:col-span-5 flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              {/* Filter & Action Controls */}
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                    Incoming Requests ({filteredLogs.length})
                  </span>
                  <button
                    onClick={clearLogs}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Clear History
                  </button>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search path or URL..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    className="px-2 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none"
                  >
                    <option value="ALL">ALL</option>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
              </div>

              {/* Logs List Container */}
              <div className="divide-y divide-zinc-800/60 overflow-y-auto max-h-[600px]">
                {filteredLogs.length === 0 ? (
                  <div className="p-12 text-center text-zinc-500 space-y-2">
                    <Terminal className="w-8 h-8 mx-auto text-zinc-600 stroke-1" />
                    <p className="text-xs">No proxied requests captured yet.</p>
                    <p className="text-[11px] text-zinc-600">
                      Send any request to <code className="text-indigo-400">/</code> or any subpath on this domain.
                    </p>
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    const isSelected = selectedLog?.id === log.id;
                    return (
                      <div
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`p-3.5 cursor-pointer transition-all duration-150 flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-indigo-600/10 border-l-4 border-indigo-500 pl-3"
                            : "hover:bg-zinc-800/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded border ${getMethodBadgeClass(
                              log.method
                            )}`}
                          >
                            {log.method}
                          </span>
                          <span className="text-xs font-mono text-zinc-200 truncate" title={log.path}>
                            {log.path}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-zinc-600" />
                            {log.durationMs}ms
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded border ${getStatusBadgeClass(
                              log.status
                            )}`}
                          >
                            {log.status}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Request Detail Drawer */}
            <div className="lg:col-span-7 flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              {selectedLog ? (
                <div className="flex flex-col h-full">
                  {/* Drawer Header */}
                  <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 text-xs font-bold font-mono rounded-lg border ${getMethodBadgeClass(
                          selectedLog.method
                        )}`}
                      >
                        {selectedLog.method}
                      </span>
                      <div>
                        <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                          {selectedLog.path}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono truncate max-w-xs sm:max-w-md">
                          Forwarded: {selectedLog.fullTargetUrl}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 text-xs font-bold font-mono rounded-lg border ${getStatusBadgeClass(
                          selectedLog.status
                        )}`}
                      >
                        {selectedLog.status} {selectedLog.statusText}
                      </span>
                      <button
                        onClick={() => copyCurl(selectedLog)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/80 rounded-lg transition-colors"
                      >
                        {copiedCurl ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                        <span>{copiedCurl ? "cURL Copied!" : "Copy cURL"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Drawer Inspector Tabs */}
                  <div className="flex items-center px-4 bg-zinc-950/60 border-b border-zinc-800 text-xs">
                    <button
                      onClick={() => setInspectorTab("response-body")}
                      className={`px-3 py-2.5 font-medium border-b-2 transition-colors ${
                        inspectorTab === "response-body"
                          ? "border-indigo-500 text-indigo-300"
                          : "border-transparent text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Response Body
                    </button>
                    <button
                      onClick={() => setInspectorTab("request-body")}
                      className={`px-3 py-2.5 font-medium border-b-2 transition-colors ${
                        inspectorTab === "request-body"
                          ? "border-indigo-500 text-indigo-300"
                          : "border-transparent text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Request Body
                    </button>
                    <button
                      onClick={() => setInspectorTab("headers")}
                      className={`px-3 py-2.5 font-medium border-b-2 transition-colors ${
                        inspectorTab === "headers"
                          ? "border-indigo-500 text-indigo-300"
                          : "border-transparent text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Headers & Meta
                    </button>
                    <button
                      onClick={() => setInspectorTab("curl")}
                      className={`px-3 py-2.5 font-medium border-b-2 transition-colors ${
                        inspectorTab === "curl"
                          ? "border-indigo-500 text-indigo-300"
                          : "border-transparent text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      cURL
                    </button>
                  </div>

                  {/* Drawer Tab Content */}
                  <div className="p-4 flex-1 overflow-y-auto max-h-[500px]">
                    {inspectorTab === "response-body" && (
                      <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                        {formatJson(selectedLog.responseBody)}
                      </pre>
                    )}

                    {inspectorTab === "request-body" && (
                      <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-amber-300 overflow-x-auto whitespace-pre-wrap">
                        {formatJson(selectedLog.requestBody)}
                      </pre>
                    )}

                    {inspectorTab === "headers" && (
                      <div className="space-y-4 text-xs font-mono">
                        <div>
                          <h4 className="text-zinc-400 font-bold uppercase tracking-wider mb-2 text-[11px]">
                            Request Headers Sent
                          </h4>
                          <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800">
                            {Object.entries(selectedLog.requestHeaders).map(([k, v]) => (
                              <div key={k} className="p-2.5 flex justify-between gap-4">
                                <span className="text-indigo-400 font-semibold">{k}</span>
                                <span className="text-zinc-300 break-all text-right">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-zinc-400 font-bold uppercase tracking-wider mb-2 text-[11px]">
                            Response Headers Received
                          </h4>
                          <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800">
                            {Object.entries(selectedLog.responseHeaders).map(([k, v]) => (
                              <div key={k} className="p-2.5 flex justify-between gap-4">
                                <span className="text-emerald-400 font-semibold">{k}</span>
                                <span className="text-zinc-300 break-all text-right">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {inspectorTab === "curl" && (
                      <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-sky-300 overflow-x-auto whitespace-pre-wrap">
                        {generateCurlCommand(selectedLog)}
                      </pre>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-16 text-center text-zinc-500 space-y-2">
                  <Activity className="w-10 h-10 mx-auto text-zinc-700 stroke-1" />
                  <p className="text-xs">Select a request from the left list to inspect details.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
