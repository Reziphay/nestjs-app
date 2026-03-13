import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

import type { RequestWithContext } from '../types/request-with-context.type';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  requestId?: string;
  timestamp: string;
}

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<
  T,
  SuccessEnvelope<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessEnvelope<T>> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithContext | undefined>();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        requestId: request?.requestId,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
