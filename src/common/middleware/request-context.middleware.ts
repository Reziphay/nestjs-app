import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';

import { RequestContextService } from '../context/request-context.service';
import { AppLoggerService } from '../logger/app-logger.service';
import type { RequestWithContext } from '../types/request-with-context.type';

const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly logger: AppLoggerService,
  ) {}

  use(
    request: RequestWithContext,
    response: Response,
    next: NextFunction,
  ): void {
    const requestId = this.resolveRequestId(request.header(REQUEST_ID_HEADER));
    const startedAt = process.hrtime.bigint();

    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    this.requestContext.run({ requestId }, () => {
      response.on('finish', () => {
        const durationMs =
          Number(process.hrtime.bigint() - startedAt) / 1_000_000;

        this.logger.logRequest({
          durationMs,
          ip: request.ip ?? null,
          method: request.method,
          path: request.originalUrl || request.url,
          requestId,
          statusCode: response.statusCode,
          userAgent: request.get('user-agent') ?? null,
          userId: request.user?.sub ?? null,
        });
      });

      next();
    });
  }

  private resolveRequestId(incomingRequestId?: string): string {
    const trimmedRequestId = incomingRequestId?.trim();

    return trimmedRequestId ? trimmedRequestId : randomUUID();
  }
}
