import { NextRequest, NextResponse } from "next/server";
import { proxyStore, RequestLog } from "@/lib/proxy-store";

// Hop-by-hop headers to omit during proxy forwarding
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

export async function handleProxyRequest(req: NextRequest, pathSuffix: string = "") {
  const pathname = req.nextUrl?.pathname || "";

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/proxy") ||
    pathname === "/favicon.ico" ||
    pathSuffix.startsWith("/_next") ||
    pathSuffix.startsWith("/proxy") ||
    pathSuffix === "/favicon.ico"
  ) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const startTime = performance.now();
  const logId = Math.random().toString(36).substring(2, 10);
  const timestamp = new Date().toISOString();

  const config = proxyStore.getConfig();

  if (!config.isActive) {
    const durationMs = Math.round(performance.now() - startTime);
    const log: RequestLog = {
      id: logId,
      timestamp,
      method: req.method,
      path: pathSuffix || "/",
      fullTargetUrl: config.targetUrl ? `${config.targetUrl}${pathSuffix}` : "Disabled",
      requestHeaders: extractHeaders(req.headers),
      requestBody: null,
      status: 503,
      statusText: "Service Unavailable",
      responseHeaders: { "content-type": "application/json" },
      responseBody: JSON.stringify({ error: "Proxy service is currently disabled in UI" }),
      durationMs,
      error: "Proxy Disabled",
    };
    proxyStore.addLog(log);

    return NextResponse.json(
      { error: "Proxy is currently disabled. Enable it in the dashboard UI." },
      { status: 503 }
    );
  }

  if (!config.targetUrl) {
    const durationMs = Math.round(performance.now() - startTime);
    const log: RequestLog = {
      id: logId,
      timestamp,
      method: req.method,
      path: pathSuffix || "/",
      fullTargetUrl: "None",
      requestHeaders: extractHeaders(req.headers),
      requestBody: null,
      status: 400,
      statusText: "Bad Request",
      responseHeaders: { "content-type": "application/json" },
      responseBody: JSON.stringify({ error: "No target URL set" }),
      durationMs,
      error: "No Target URL",
    };
    proxyStore.addLog(log);

    return NextResponse.json(
      { error: "No Target URL configured. Please set a target URL in the dashboard." },
      { status: 400 }
    );
  }

  // Construct target URL including query parameters
  const urlObj = new URL(req.url);
  const search = urlObj.search;
  const targetPath = pathSuffix.startsWith("/") ? pathSuffix : `/${pathSuffix}`;
  const fullTargetUrl = `${config.targetUrl}${targetPath}${search}`;

  // Forward incoming headers
  const forwardingHeaders = new Headers();
  const loggedReqHeaders: Record<string, string> = {};

  req.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    loggedReqHeaders[key] = value;

    if (!HOP_BY_HOP_HEADERS.has(lowerKey)) {
      forwardingHeaders.set(key, value);
    }
  });

  // Inject Custom Headers configured in UI
  if (config.customHeaders && config.customHeaders.length > 0) {
    config.customHeaders.forEach((h) => {
      if (h.enabled && h.key.trim()) {
        forwardingHeaders.set(h.key.trim(), h.value);
        loggedReqHeaders[h.key.trim()] = h.value;
      }
    });
  }

  // Set standard X-Forwarded headers
  const host = req.headers.get("host") || "";
  forwardingHeaders.set("X-Forwarded-Host", host);
  forwardingHeaders.set("X-Forwarded-Proto", urlObj.protocol.replace(":", ""));

  // Extract body for methods with body payload
  let reqBodyBuffer: ArrayBuffer | undefined = undefined;
  let reqBodyText: string | null = null;

  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase())) {
    try {
      reqBodyBuffer = await req.arrayBuffer();
      if (reqBodyBuffer.byteLength > 0) {
        const decoder = new TextDecoder("utf-8");
        reqBodyText = decoder.decode(reqBodyBuffer);
      }
    } catch {
      reqBodyText = null;
    }
  }

  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: forwardingHeaders,
      body: reqBodyBuffer && reqBodyBuffer.byteLength > 0 ? reqBodyBuffer : undefined,
      redirect: "manual",
    };

    const targetRes = await fetch(fullTargetUrl, fetchOptions);
    const durationMs = Math.round(performance.now() - startTime);

    // Extract response headers
    const resHeaders = new Headers();
    const loggedResHeaders: Record<string, string> = {};

    targetRes.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      loggedResHeaders[key] = value;

      if (!HOP_BY_HOP_HEADERS.has(lowerKey) && lowerKey !== "content-encoding") {
        resHeaders.set(key, value);
      }
    });

    const resBuffer = await targetRes.arrayBuffer();
    let resBodyText: string | null = null;

    try {
      const decoder = new TextDecoder("utf-8");
      resBodyText = decoder.decode(resBuffer);
    } catch {
      resBodyText = "[Binary / Non-UTF8 Content]";
    }

    // Log complete telemetry
    const log: RequestLog = {
      id: logId,
      timestamp,
      method: req.method,
      path: targetPath + search,
      fullTargetUrl,
      requestHeaders: loggedReqHeaders,
      requestBody: reqBodyText,
      status: targetRes.status,
      statusText: targetRes.statusText,
      responseHeaders: loggedResHeaders,
      responseBody: resBodyText,
      durationMs,
    };
    proxyStore.addLog(log);

    return new Response(resBuffer, {
      status: targetRes.status,
      statusText: targetRes.statusText,
      headers: resHeaders,
    });
  } catch (err: unknown) {
    const durationMs = Math.round(performance.now() - startTime);
    const errorMsg = err instanceof Error ? err.message : "Target fetch failed";

    const log: RequestLog = {
      id: logId,
      timestamp,
      method: req.method,
      path: targetPath + search,
      fullTargetUrl,
      requestHeaders: loggedReqHeaders,
      requestBody: reqBodyText,
      status: 502,
      statusText: "Bad Gateway",
      responseHeaders: { "content-type": "application/json" },
      responseBody: JSON.stringify({ error: errorMsg, fullTargetUrl }),
      durationMs,
      error: errorMsg,
    };
    proxyStore.addLog(log);

    return NextResponse.json(
      {
        error: "Failed to forward request to target URL",
        details: errorMsg,
        targetUrl: fullTargetUrl,
      },
      { status: 502 }
    );
  }
}

function extractHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}
