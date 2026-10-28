import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const req = ctx.getRequest<any>();
    const url = req?.url || '';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: any[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const respObj = exceptionResponse as Record<string, any>;
        message = respObj.message || exception.message;
        if (Array.isArray(respObj.message)) {
          errors = respObj.message;
          message = errors[0] || 'Validation error';
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Official IndiSell Connector contract: { ok: false, error: "..." }
    if (url.includes('/indisell/connector')) {
      return response.status(status).json({
        ok: false,
        error: message,
      });
    }

    // Official IndiSell Storefront Bridge contract: { error: "..." }
    if (url.includes('/checkout/session') || url.includes('/checkout/verify')) {
      return response.status(status).json({
        error: message,
      });
    }

    response.status(status).json({
      success: false,
      message,
      errors: errors.length > 0 ? errors : [message],
    });
  }
}
