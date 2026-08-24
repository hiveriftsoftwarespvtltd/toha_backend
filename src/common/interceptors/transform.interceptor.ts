import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: any;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((res) => {
        if (res && typeof res === 'object' && 'success' in res && 'data' in res) {
          return res;
        }

        let data = res;
        let message = 'Operation successful';
        let meta = undefined;

        if (res && typeof res === 'object') {
          if ('data' in res && ('meta' in res || 'message' in res)) {
            data = res.data;
            message = res.message || message;
            meta = res.meta;
          }
        }

        const responseObj: Response<T> = {
          success: true,
          message,
          data,
        };

        if (meta !== undefined) {
          responseObj.meta = meta;
        }

        return responseObj;
      }),
    );
  }
}
