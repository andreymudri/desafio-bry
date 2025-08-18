import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UploadedFiles,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { CryptoService } from './crypto.service';
import * as path from 'path';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import FileUploadDto from './dto/FileUploadDto';
import SignRequestDto from './dto/SignRequestDto';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { MulterError } from 'multer';
import { signatureFilesInterceptor } from './interceptors/signature-files.interceptor';

@Controller()
export class CryptoController {
  constructor(private readonly cryptoService: CryptoService) {}

  @Post('signature')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/json; charset=utf-8')
  @UseInterceptors(signatureFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File to be signed, PKCS12 file and its password',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        pfx: { type: 'string', format: 'binary' },
        pfxPassword: { type: 'string', minLength: 6 },
      },
      required: ['file', 'pfx', 'pfxPassword'],
    },
  })
  async signFileCMS(
    @UploadedFiles()
    files: { file?: Express.Multer.File[]; pfx?: Express.Multer.File[] },
    @Body() body: SignRequestDto,
  ) {
    const file = files?.file?.[0];
    const pfx = files?.pfx?.[0];

    if (!file || !pfx || !body?.pfxPassword) {
      throw new BadRequestException('Missing required files or parameters');
    }

    const docPath =
      file?.path ?? path.resolve(__dirname, '../../resources/arquivos/doc.txt');
    const pfxPath = pfx.path;

    const signatureBase64 = await this.cryptoService.signFileCMS(
      docPath,
      pfxPath,
      body.pfxPassword,
    );
    // Return a consistent JSON object
    return { signature: signatureBase64 };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/json; charset=utf-8')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5, parts: 6 },
      fileFilter: (req, file, cb) => {
        const ok = /\.(p7s|txt|pdf|docx?|odt|rtf|bin|dat)$/i.test(
          file.originalname,
        );
        return ok
          ? cb(null, true)
          : cb(
              new MulterError(
                'LIMIT_UNEXPECTED_FILE',
                'file',
              ) as unknown as Error,
              false,
            );
      },
    } as MulterOptions),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File to be verified',
    type: FileUploadDto,
  })
  async verifySignature(@UploadedFile() file: Express.Multer.File) {
    const docPath =
      file?.path ?? path.resolve(__dirname, '../../resources/arquivos/doc.txt');

    const result = await this.cryptoService.verifySignature(docPath);

    return result;
  }
}
