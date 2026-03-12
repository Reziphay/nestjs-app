import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

type ErrorBody = {
  code: string;
  message: string;
  details: Record<string, unknown>;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorBody = this.normalizeException(exception);

    response.status(status).json({
      success: false,
      error: {
        ...errorBody,
        details: {
          path: request.url,
          timestamp: new Date().toISOString(),
          ...errorBody.details,
        },
      },
    });
  }

  private normalizeException(exception: unknown): ErrorBody {
    if (!(exception instanceof HttpException)) {
      return {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        details: {},
      };
    }

    const response = exception.getResponse();

    if (typeof response === 'string') {
      return {
        code: this.getErrorCode(exception.getStatus()),
        message: response,
        details: {},
      };
    }

    if (Array.isArray((response as { message?: unknown }).message)) {
      return {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          fields: (response as { message: unknown[] }).message,
        },
      };
    }

    const typedResponse = response as {
      code?: string;
      message?: string;
      details?: Record<string, unknown>;
      error?: string;
    };

    return {
      code: typedResponse.code ?? this.getErrorCode(exception.getStatus()),
      message:
        typedResponse.message ??
        typedResponse.error ??
        'Request could not be processed',
      details: typedResponse.details ?? {},
    };
  }

  private getErrorCode(status: number): string {
    switch (status as HttpStatus) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'HTTP_ERROR';
    }
  }
}
