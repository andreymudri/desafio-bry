import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UploadedFiles,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { CryptoService } from './crypto.service';
import * as path from 'path';
import {
  FileInterceptor,
  FileFieldsInterceptor,
} from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import FileUploadDto from './dto/FileUploadDto';

@Controller()
export class CryptoController {
  constructor(private readonly cryptoService: CryptoService) {}

  @Post('signature')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
      { name: 'pfx', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File to be signed, PKCS12 file and its password',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        pfx: { type: 'string', format: 'binary' },
        pfxPassword: { type: 'string' },
      },
      required: ['file', 'pfx', 'pfxPassword'],
    },
  })
  async signFileCMS(
    @UploadedFiles()
    files: { file?: Express.Multer.File[]; pfx?: Express.Multer.File[] },
    @Body('pfxPassword') pfxPassword: string,
  ) {
    const file = files?.file?.[0];
    const pfx = files?.pfx?.[0];

    if (!file || !pfx || !pfxPassword) {
      throw new BadRequestException('Missing required files or parameters');
    }

    const docPath =
      file?.path ?? path.resolve(__dirname, '../../resources/arquivos/doc.txt');
    const pfxPath = pfx.path;

    const signatureBase64 = await this.cryptoService.signFileCMS(
      docPath,
      pfxPath,
      pfxPassword,
    );

    // Return the Base64 CMS signature in the response body
    return signatureBase64;
  }

  @Post('verify')
  @UseInterceptors(FileInterceptor('file'))
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
