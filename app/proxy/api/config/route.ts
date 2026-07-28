import { NextResponse } from "next/server";
import { proxyStore } from "@/lib/proxy-store";

export async function GET() {
  const config = proxyStore.getConfig();
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updated = proxyStore.updateConfig(body);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON configuration payload" },
      { status: 400 }
    );
  }
}
