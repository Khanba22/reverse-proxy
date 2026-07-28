import { NextRequest, NextResponse } from "next/server";
import { handleProxyRequest } from "@/lib/proxy-handler";

type RouteParams = { params: Promise<{ path?: string[] }> };

async function proxy(req: NextRequest, context: RouteParams) {
  const { path } = await context.params;

  if (path && path.length > 0) {
    const firstSegment = path[0];
    if (
      firstSegment === "_next" ||
      firstSegment === "proxy" ||
      firstSegment === "favicon.ico"
    ) {
      return new NextResponse("Not Found", { status: 404 });
    }
  }

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
