import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CryptoController } from './crypto/crypto.controller';
import { CryptoService } from './crypto/crypto.service';
import { MulterModule } from '@nestjs/platform-express';
import * as os from 'os';

@Module({
  imports: [
    MulterModule.register({
      dest: os.tmpdir(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB default
        files: 2,
        fields: 10,
        parts: 12,
      },
    }),
  ],
  controllers: [AppController, CryptoController],
  providers: [AppService, CryptoService],
})
export class AppModule {}
