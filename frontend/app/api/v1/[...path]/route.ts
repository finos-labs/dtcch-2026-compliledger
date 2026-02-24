import { NextResponse, type NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL || "https://dtcc-backend-production.up.railway.app";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, pathSegments: string[]) {
  const targetPath = pathSegments.join("/");
  const targetUrl = `${BACKEND_URL}/v1/${targetPath}${req.nextUrl.search}`;

  const method = req.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await req.text();

  const headers = new Headers(req.headers);
  headers.delete("host");

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("transfer-encoding");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
