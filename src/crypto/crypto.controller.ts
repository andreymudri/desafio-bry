import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { CryptoService } from './crypto.service';
import * as path from 'path';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import FileUploadDto from './dto/FileUploadDto';

@Controller()
export class CryptoController {
  constructor(private readonly cryptoService: CryptoService) {}

  @Post('file-hash')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File to be hashed',
    type: FileUploadDto,
  })
  async getCryptoResume(@UploadedFile() file: Express.Multer.File) {
    const docPath =
      file?.path ?? path.resolve(__dirname, '../../resources/arquivos/doc.txt');

    return this.cryptoService.getDocHash(docPath);
  }

  @Post('sign-file')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File to be signed',
    type: FileUploadDto,
  })
  signFile(@UploadedFile() file: Express.Multer.File) {
    const docPath =
      file?.path ?? path.resolve(__dirname, '../../resources/arquivos/doc.txt');

    const savedPath = this.cryptoService.signFile(docPath);

    return { message: `File signed successfully to ${savedPath}` };
  }

  @Post('verify')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File to be verified',
    type: FileUploadDto,
  })
  verifySignature(@UploadedFile() file: Express.Multer.File) {
    const docPath =
      file?.path ?? path.resolve(__dirname, '../../resources/arquivos/doc.txt');

    const isValid = this.cryptoService.verifySignature(docPath);

    return isValid;
  }
}
