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
    const req = context.switchToHttp().getRequest();
    const url = req?.url || '';

    // Bypass transformation for IndiSell connector & storefront checkout bridge to strictly adhere to IndiSell SDK contract
    if (
      url.includes('/indisell') ||
      url.includes('/checkout/session') ||
      url.includes('/checkout/verify')
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      map((res) => {
        if (res && typeof res === 'object' && ('ok' in res || 'checkoutSessionId' in res)) {
          return res;
        }

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
