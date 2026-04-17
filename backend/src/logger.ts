import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "settlementguard", version: "0.3.0" },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss.l", ignore: "pid,hostname,service,version" },
    },
  }),
});

export function childLogger(correlationId: string, context: Record<string, unknown> = {}) {
  return logger.child({ correlationId, ...context });
}
