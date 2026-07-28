import { NextRequest } from "next/server";
import { handleProxyRequest } from "@/lib/proxy-handler";

type RouteParams = { params: Promise<{ path?: string[] }> };

async function proxy(req: NextRequest, context: RouteParams) {
  const { path } = await context.params;
  const pathSuffix = path && path.length > 0 ? `/${path.join("/")}` : "";
  return handleProxyRequest(req, pathSuffix);
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
