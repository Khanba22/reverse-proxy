import { NextResponse } from "next/server";
import { proxyStore } from "@/lib/proxy-store";

export async function GET() {
  const logs = proxyStore.getLogs();
  return NextResponse.json(logs);
}

export async function DELETE() {
  proxyStore.clearLogs();
  return NextResponse.json({ success: true, message: "Logs cleared" });
}
