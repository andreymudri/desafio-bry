import { ApiProperty } from '@nestjs/swagger';

export default class FileUploadDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file!: Express.Multer.File;
}
