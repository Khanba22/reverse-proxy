import { NextRequest } from "next/server";
import { handleProxyRequest } from "@/lib/proxy-handler";

async function proxy(req: NextRequest) {
  return handleProxyRequest(req, "/");
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
