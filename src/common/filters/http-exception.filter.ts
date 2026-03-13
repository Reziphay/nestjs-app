import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

import type { RequestWithContext } from '../types/request-with-context.type';

type ErrorPayload = {
  message: string;
  code: string;
  details?: unknown;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithContext>();

    const status = this.getStatus(exception);
    const error = this.normalizeError(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} failed: ${error.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      success: false,
      error,
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return HttpStatus.CONFLICT;
      }

      return HttpStatus.BAD_REQUEST;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private normalizeError(exception: unknown): ErrorPayload {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return {
          message: response,
          code: this.httpStatusToCode(exception.getStatus()),
        };
      }

      if (typeof response === 'object' && response !== null) {
        const payload = response as Record<string, unknown>;
        const message = payload['message'];

        return {
          message:
            typeof message === 'string'
              ? message
              : Array.isArray(message)
                ? message.join(', ')
                : exception.message,
          code:
            typeof payload['errorCode'] === 'string'
              ? payload['errorCode']
              : this.httpStatusToCode(exception.getStatus()),
          details: payload,
        };
      }
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          message: 'A unique constraint would be violated by this operation.',
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          details: exception.meta,
        };
      }

      return {
        message: 'A database constraint prevented the request from succeeding.',
        code: 'DATABASE_ERROR',
        details: exception.meta,
      };
    }

    return {
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    };
  }

  private httpStatusToCode(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 429:
        return 'TOO_MANY_REQUESTS';
      default:
        return 'HTTP_ERROR';
    }
  }
}
