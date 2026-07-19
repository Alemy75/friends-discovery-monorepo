import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Last-resort safety net for Prisma errors that escape a service's own
 * handling (e.g. a race that slips past an existing pre-check). Maps the
 * common "known request" error codes to sane HTTP statuses without leaking
 * query/constraint details to the client.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let httpException: HttpException;
    switch (exception.code) {
      case 'P2002':
        httpException = new ConflictException('Resource already exists');
        break;
      case 'P2025':
        httpException = new NotFoundException('Resource not found');
        break;
      default:
        httpException = new InternalServerErrorException('Internal server error');
        break;
    }

    response.status(httpException.getStatus()).json(httpException.getResponse());
  }
}
