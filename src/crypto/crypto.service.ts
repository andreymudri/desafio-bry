import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { createHash } from 'crypto';
import * as path from 'path';
import ForgeHelper from './forge.helper';

@Injectable()
export class CryptoService {
  async getDocHash(docPath: string): Promise<string> {
    const hash = createHash('sha512');
    return new Promise((resolve, reject) => {
      // Cria uma stream para não carregar o arquivo todo de uma vez em memória
      const stream = fs.createReadStream(docPath);

      stream.on('data', (chunk: Buffer) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  signFile(docPath: string) {
    // Caminho para o PKCS#12 fornecido no repositório
    const pfxPath = path.resolve(
      __dirname,
      '../../resources/pkcs12/certificado_teste_hub.pfx',
    );
    // Valores informados no enunciado
    const alias = 'e2618a8b-20de-4dd2-b209-70912e3177f4';
    const pfxPassword = 'bry123456';

    const { key, cert } = ForgeHelper.loadCertificate(
      pfxPath,
      alias,
      pfxPassword,
    );
    const data = fs.readFileSync(docPath);

    const signedData = ForgeHelper.signData(data, key, cert);
    // save signedData to a file in the filesystem
    return ForgeHelper.saveFileToDisk(signedData);
  }
}
