import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        title = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        title = responseObj.message || responseObj.error || title;
        detail = responseObj.detail;
      }
    } else if (exception instanceof Error) {
      detail = exception.message;
    }

    const problemDetails: ProblemDetails = {
      type: `https://api.aicoaching.com/problems/${status}`,
      title,
      status,
      detail,
      instance: request.url,
    };

    response
      .status(status)
      .header('Content-Type', 'application/problem+json')
      .json(problemDetails);
  }
}
