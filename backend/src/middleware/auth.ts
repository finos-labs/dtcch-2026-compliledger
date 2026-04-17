import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../logger";

const STATIC_BEARER_TOKEN = process.env.API_BEARER_TOKEN;
const JWT_SECRET = process.env.SG_JWT_SECRET;
const JWT_ISSUER = process.env.SG_JWT_ISSUER;
const JWT_AUDIENCE = process.env.SG_JWT_AUDIENCE || "settlementguard-api";

export type AuthScope =
  | "sg:intents:write"
  | "sg:anchor:write"
  | "sg:verify:read"
  | "sg:reasoning:read"
  | "sg:admin";

export interface AuthenticatedRequest extends Request {
  authContext?: {
    subject: string;
    scopes: string[];
    method: "bearer" | "jwt";
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }

  const token = header.slice(7);

  if (JWT_SECRET && token !== STATIC_BEARER_TOKEN) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as jwt.JwtPayload;

      const rawScopes: unknown = decoded.scope ?? decoded.scopes ?? [];
      const scopes = Array.isArray(rawScopes)
        ? (rawScopes as string[])
        : typeof rawScopes === "string"
        ? rawScopes.split(" ")
        : [];

      req.authContext = {
        subject: decoded.sub ?? "unknown",
        scopes,
        method: "jwt",
      };

      logger.debug({ subject: decoded.sub, scopes }, "JWT authentication successful");
      next();
      return;
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "JWT verification failed");
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
  }

  if (STATIC_BEARER_TOKEN) {
    if (token !== STATIC_BEARER_TOKEN) {
      res.status(401).json({ error: "Invalid bearer token" });
      return;
    }
    req.authContext = { subject: "static-token-client", scopes: ["sg:admin"], method: "bearer" };
    next();
    return;
  }

  res.status(500).json({ error: "Server authentication is not configured" });
}

export function requireScope(scope: AuthScope) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const ctx = req.authContext;
    if (!ctx) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (ctx.scopes.includes("sg:admin") || ctx.scopes.includes(scope)) {
      next();
      return;
    }
    logger.warn({ subject: ctx.subject, required: scope, has: ctx.scopes }, "Insufficient scope");
    res.status(403).json({ error: `Insufficient scope. Required: ${scope}` });
  };
}

export function guardStartup(): void {
  const hasStatic = Boolean(STATIC_BEARER_TOKEN);
  const hasJWT = Boolean(JWT_SECRET);

  if (!hasStatic && !hasJWT) {
    const msg =
      "FATAL: No authentication configured. Set API_BEARER_TOKEN (static) or SG_JWT_SECRET (JWT). Refusing to start.";
    logger.fatal(msg);
    process.exit(1);
  }

  if (hasStatic) {
    logger.info("Auth: static bearer token enabled");
  }
  if (hasJWT) {
    logger.info({ issuer: JWT_ISSUER, audience: JWT_AUDIENCE }, "Auth: JWT verification enabled");
  }
}
