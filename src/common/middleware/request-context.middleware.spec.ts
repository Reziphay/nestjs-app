/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { RequestContextMiddleware } from './request-context.middleware';
import type { Response } from 'express';
import type { RequestWithContext } from '../types/request-with-context.type';

type ResponseStub = {
  on: jest.Mock<ResponseStub, [string, () => void]>;
  setHeader: jest.Mock<void, [string, string]>;
  statusCode: number;
};

describe('RequestContextMiddleware', () => {
  it('propagates the request id and emits a structured request log on completion', () => {
    const logRequest = jest.fn();
    const middleware = new RequestContextMiddleware(
      {
        run: (_context: unknown, callback: () => void) => callback(),
      } as any,
      {
        logRequest,
      } as any,
    );

    let finishHandler: (() => void) | undefined;

    const request = {
      get: jest.fn().mockReturnValue('jest-agent'),
      header: jest.fn().mockReturnValue('request-123'),
      ip: '127.0.0.1',
      method: 'GET',
      originalUrl: '/api/v1/health',
      url: '/api/v1/health',
      user: {
        sub: 'user-1',
      },
    } as unknown as RequestWithContext;
    const response: ResponseStub = {
      on: jest.fn((event: string, handler: () => void) => {
        if (event === 'finish') {
          finishHandler = handler;
        }

        return response;
      }),
      setHeader: jest.fn(),
      statusCode: 200,
    };
    const next = jest.fn();

    middleware.use(request, response as unknown as Response, next);
    finishHandler?.();

    expect(request.requestId).toBe('request-123');
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      'request-123',
    );
    expect(next).toHaveBeenCalled();
    expect(logRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/v1/health',
        requestId: 'request-123',
        statusCode: 200,
        userAgent: 'jest-agent',
        userId: 'user-1',
      }),
    );
  });
});
