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

  async signFileCMS(
    docPath: string,
    pfxPath: string,
    pfxPassword: string,
  ): Promise<string> {
    try {
      // Load key and cert from provided PKCS#12. Alias is optional; pass empty string
      const { key, cert } = ForgeHelper.loadCertificate(
        pfxPath,
        '',
        pfxPassword,
      );

      const data = await fs.promises.readFile(docPath);

      const signedBase64 = ForgeHelper.signData(data, key, cert);

      // Basic sanitization: ensure it's base64 by attempting decode and re-encode
      const buf = Buffer.from(signedBase64, 'base64');
      if (!buf.length) throw new Error('SIGNATURE_GENERATION_FAILED');
      return buf.toString('base64');
    } catch {
      // Avoid leaking internal forge messages
      throw new Error('Could not generate signature');
    }
  }

  async verifySignature(docPath: string) {
    try {
      const data = await fs.promises.readFile(docPath);

      const result = ForgeHelper.verifySignedData(data);

      const status = result.valid ? 'VALIDO' : 'INVALIDO';

      const infos: Partial<Record<string, string>> = {};
      if (result.signerName) infos.signerName = String(result.signerName);
      if (result.signingTime) infos.signingTime = String(result.signingTime);
      if (result.documentHashHex)
        infos.documentHash = String(result.documentHashHex);
      if (result.digestAlgorithmName)
        infos.hashName = String(result.digestAlgorithmName);

      return {
        status,
        infos: Object.keys(infos).length ? infos : undefined,
      };
    } catch {
      // On read/verify failure, return a sanitized invalid response
      return { status: 'INVALIDO' };
    }
  }
}
