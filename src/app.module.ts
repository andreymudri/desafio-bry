import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CryptoController } from './crypto/crypto.controller';
import { CryptoService } from './crypto/crypto.service';
import { MulterModule } from '@nestjs/platform-express';
import * as os from 'os';

@Module({
  imports: [MulterModule.register({ dest: os.tmpdir() })],
  controllers: [AppController, CryptoController],
  providers: [AppService, CryptoService],
})
export class AppModule {}
