import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { method = "GET", path = "", headers = {}, body = null } = await request.json();

    const host = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    
    // Construct local proxy destination URL (root path)
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const proxyUrl = `${protocol}://${host}${cleanPath}`;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body && ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())
        ? (typeof body === "string" ? body : JSON.stringify(body))
        : undefined,
    };

    const res = await fetch(proxyUrl, fetchOptions);
    const text = await res.text();

    return NextResponse.json({
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      body: text,
      proxyUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to execute test request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
