import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type ApiEnvelope<T> = {
  success: true;
  data: T;
  meta: Record<string, unknown>;
};

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiEnvelope<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiEnvelope<T>> {
    return next.handle().pipe(
      map((payload) => {
        if (
          payload !== null &&
          typeof payload === 'object' &&
          'success' in (payload as Record<string, unknown>)
        ) {
          return payload as unknown as ApiEnvelope<T>;
        }

        if (
          payload !== null &&
          typeof payload === 'object' &&
          ('data' in (payload as Record<string, unknown>) ||
            'meta' in (payload as Record<string, unknown>))
        ) {
          const typedPayload = payload as {
            data?: T;
            meta?: Record<string, unknown>;
          };

          return {
            success: true,
            data: typedPayload.data as T,
            meta: typedPayload.meta ?? {},
          };
        }

        return {
          success: true,
          data: payload,
          meta: {},
        };
      }),
    );
  }
}
