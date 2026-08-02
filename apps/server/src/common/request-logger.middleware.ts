import { Injectable, NestMiddleware } from "@nestjs/common";
import chalk from "chalk";
import type { NextFunction, Request, Response } from "express";

const METHOD_COLORS: Record<string, chalk.Chalk> = {
  GET: chalk.cyan,
  POST: chalk.green,
  PUT: chalk.yellow,
  PATCH: chalk.yellow,
  DELETE: chalk.red,
};

function colorMethod(method: string): string {
  const color = METHOD_COLORS[method] ?? chalk.white;
  return color.bold(method.padEnd(6));
}

function colorStatus(status: number): string {
  if (status >= 500) return chalk.red.bold(String(status));
  if (status >= 400) return chalk.yellow.bold(String(status));
  if (status >= 300) return chalk.cyan.bold(String(status));
  return chalk.green.bold(String(status));
}

// Logs every endpoint hit on the server (method, path, status, timing)
// in color so it's easy to eyeball in the `pnpm dev:server` terminal
// which routes are actually being called during sync.
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();

    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const time = chalk.gray(new Date().toISOString());
      const path = chalk.bold(req.originalUrl);
      const duration = chalk.gray(`${ms.toFixed(1)}ms`);
      console.log(`${time} ${colorMethod(req.method)} ${path} ${colorStatus(res.statusCode)} ${duration}`);
    });

    next();
  }
}
