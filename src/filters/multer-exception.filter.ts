import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter<MulterError> {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    const message = this.mapMulterError(exception);

    const field = (exception as unknown as { field?: string }).field;
    res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      message,
      code: exception.code,
      field,
    });
  }

  private mapMulterError(err: MulterError): string {
    switch (err.code) {
      case 'LIMIT_UNEXPECTED_FILE': {
        const f = (err as unknown as { field?: string }).field;
        return `Campo de arquivo inesperado: ${f || 'desconhecido'}`;
      }
      case 'LIMIT_FILE_SIZE':
        return 'Arquivo excede o tamanho máximo permitido.';
      case 'LIMIT_FILE_COUNT':
        return 'Número de arquivos excede o limite permitido.';
      case 'LIMIT_FIELD_COUNT':
        return 'Número de campos excede o limite permitido.';
      case 'LIMIT_PART_COUNT':
        return 'Número de partes excede o limite permitido.';
      default:
        return err.message || 'Erro ao processar upload com Multer.';
    }
  }
}
