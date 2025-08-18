import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as fs from 'fs';
import { createHash } from 'crypto';
import * as path from 'path';
import ForgeHelper, {
  Pkcs12AliasNotFoundError,
  Pkcs12CorruptedError,
  Pkcs12InvalidPasswordError,
} from './forge.helper';

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

  async signFile(docPath: string) {
    // Caminho para o PKCS#12 fornecido no repositório
    const pfxPath = path.resolve(
      __dirname,
      '../../resources/pkcs12/certificado_teste_hub.pfx',
    );
    // Valores informados no desafio
    const alias = 'e2618a8b-20de-4dd2-b209-70912e3177f4';
    const pfxPassword = 'bry123456';

    const { key, cert } = await ForgeHelper.loadCertificate(
      pfxPath,
      alias,
      pfxPassword,
    );
    const data = await fs.promises.readFile(docPath);

    const signedData = ForgeHelper.signData(data, key, cert);
    // Salva o conteúdo assinado em um arquivo no sistema de arquivos
    return ForgeHelper.saveFileToDisk(signedData);
  }

  async signFileCMS(
    docPath: string,
    pfxPath: string,
    pfxPassword: string,
  ): Promise<string> {
    try {
      // Carrega chave e certificado do PKCS#12 fornecido. Alias é opcional; passe string vazia
      const { key, cert } = await ForgeHelper.loadCertificate(
        pfxPath,
        '',
        pfxPassword,
      );

      const data = await fs.promises.readFile(docPath);

      const signedBase64 = ForgeHelper.signData(data, key, cert);

      // Saneamento básico: garante que é Base64 tentando decodificar e recodificar
      const buf = Buffer.from(signedBase64, 'base64');
      if (!buf.length) throw new Error('SIGNATURE_GENERATION_FAILED');
      return buf.toString('base64');
    } catch (err) {
      if (err instanceof Pkcs12InvalidPasswordError) {
        throw new BadRequestException('Senha do PFX inválida');
      }
      if (err instanceof Pkcs12CorruptedError) {
        throw new UnprocessableEntityException('PFX corrompido ou inválido');
      }
      if (err instanceof Pkcs12AliasNotFoundError) {
        throw new UnprocessableEntityException('Alias inexistente no PFX');
      }
      // Evita vazar mensagens internas do forge
      throw new UnprocessableEntityException('Falha ao gerar assinatura');
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
      if (result.issuerName) infos.issuer = String(result.issuerName);
      if (result.serialNumberHex)
        infos.serialNumber = String(result.serialNumberHex);
      if (typeof result.trusted === 'boolean')
        infos.trustedChain = result.trusted ? 'true' : 'false';

      return {
        status,
        infos: Object.keys(infos).length ? infos : undefined,
      };
    } catch {
      // Em falha de leitura/verificação, retorna uma resposta inválida sanitizada
      return { status: 'INVALIDO' };
    }
  }
}
