import { Injectable, LoggerService } from '@nestjs/common';
import { inspect } from 'node:util';

import { RequestContextService } from '../context/request-context.service';

type StructuredLogLevel = 'debug' | 'error' | 'info' | 'verbose' | 'warn';

type HttpRequestLogInput = {
  durationMs: number;
  ip: string | null;
  method: string;
  path: string;
  requestId?: string;
  statusCode: number;
  userAgent: string | null;
  userId: string | null;
};

@Injectable()
export class AppLoggerService implements LoggerService {
  constructor(private readonly requestContext: RequestContextService) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.writeApplicationLog('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const [stack, context] = this.extractErrorParams(optionalParams);

    this.writeStructuredLog('error', {
      context,
      event: 'application',
      message: this.normalizeValue(message),
      stack,
    });
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.writeApplicationLog('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.writeApplicationLog('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.writeApplicationLog('verbose', message, optionalParams);
  }

  logRequest(input: HttpRequestLogInput): void {
    const level: StructuredLogLevel =
      input.statusCode >= 500
        ? 'error'
        : input.statusCode >= 400
          ? 'warn'
          : 'info';

    this.writeStructuredLog(level, {
      ...input,
      durationMs: Number(input.durationMs.toFixed(1)),
      event: 'http_request',
    });
  }

  private writeApplicationLog(
    level: StructuredLogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    this.writeStructuredLog(level, {
      context: this.extractContext(optionalParams),
      event: 'application',
      message: this.normalizeValue(message),
    });
  }

  private writeStructuredLog(
    level: StructuredLogLevel,
    payload: Record<string, unknown>,
  ): void {
    const entry = {
      level,
      timestamp: new Date().toISOString(),
      requestId:
        typeof payload['requestId'] === 'string'
          ? payload['requestId']
          : (this.requestContext.getRequestId() ?? undefined),
      ...payload,
    };
    const serializedEntry = JSON.stringify(entry);

    if (level === 'error') {
      process.stderr.write(`${serializedEntry}\n`);
      return;
    }

    process.stdout.write(`${serializedEntry}\n`);
  }

  private extractContext(optionalParams: unknown[]): string | undefined {
    const candidate = optionalParams.at(-1);

    return typeof candidate === 'string' ? candidate : undefined;
  }

  private extractErrorParams(
    optionalParams: unknown[],
  ): [string | undefined, string | undefined] {
    const stack =
      typeof optionalParams[0] === 'string' ? optionalParams[0] : undefined;
    const context =
      typeof optionalParams[1] === 'string'
        ? optionalParams[1]
        : this.extractContext(optionalParams.slice(1));

    return [stack, context];
  }

  private normalizeValue(value: unknown): unknown {
    if (value == null) {
      return value;
    }

    if (
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      typeof value === 'string'
    ) {
      return value;
    }

    if (value instanceof Error) {
      return {
        message: value.message,
        name: value.name,
        stack: value.stack,
      };
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return inspect(value, {
        breakLength: Infinity,
        depth: 5,
      });
    }
  }
}
