import { NextResponse } from "next/server";
import { proxyStore } from "@/lib/proxy-store";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const targetUrl = body.targetUrl || proxyStore.getConfig().targetUrl;

    if (!targetUrl) {
      return NextResponse.json({ ok: false, error: "Target URL is not configured" }, { status: 400 });
    }

    const start = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "ReverseProxy-HealthCheck/1.0",
      },
    }).finally(() => clearTimeout(timeoutId));

    const durationMs = Math.round(performance.now() - start);

    return NextResponse.json({
      ok: res.ok || res.status < 500,
      status: res.status,
      statusText: res.statusText,
      durationMs,
      targetUrl,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to reach target URL";
    return NextResponse.json(
      {
        ok: false,
        error: errorMsg,
      },
      { status: 502 }
    );
  }
}
