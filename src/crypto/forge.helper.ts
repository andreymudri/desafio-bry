import * as forge from 'node-forge';
import * as fs from 'fs';

export default class ForgeHelper {
  static loadCertificate(
    pfxPath: string,
    alias: string,
    pfxPassword: string,
  ): { key: forge.pki.PrivateKey; cert: forge.pki.Certificate } {
    const pfxBuffer = fs.readFileSync(pfxPath);
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, pfxPassword);

    let privateKey: forge.pki.PrivateKey | undefined;
    let certificate: forge.pki.Certificate | undefined;

    p12.safeContents.forEach((safeContent) => {
      safeContent.safeBags.forEach((safeBag) => {
        // Encontra o alias nos atributos do safeBag
        const attrs = safeBag.attributes as {
          friendlyName?: string[];
        };
        const friendlyName = attrs?.friendlyName?.[0];

        // Se o friendlyName corresponder ao alias fornecido, extrai o par.
        if (friendlyName === alias) {
          if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
            privateKey = safeBag.key as unknown as forge.pki.PrivateKey;
          } else if (safeBag.type === forge.pki.oids.certBag) {
            certificate = safeBag.cert as unknown as forge.pki.Certificate;
          }
        }
      });
    });

    if (!privateKey || !certificate) {
      throw new Error(`Failed to find key and certificate for alias: ${alias}`);
    }

    return { key: privateKey, cert: certificate };
  }

  static signData(
    data: Buffer,
    key: forge.pki.PrivateKey,
    cert: forge.pki.Certificate,
  ) {
    // Usar SHA-512 conforme requisito e assinar com conteúdo anexado
    const p7 = forge.pkcs7.createSignedData();

    // Conteúdo anexado (usar representação binária)
    const fileBinary = data.toString('binary');
    p7.content = forge.util.createBuffer(fileBinary);
    p7.addCertificate(cert);

    p7.addSigner({
      key: key as unknown as forge.pki.rsa.PrivateKey | string,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha512,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentType,
          value: forge.pki.oids.data,
        },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime },
      ],
    });

    p7.sign({ detached: false });

    const asn1 = p7.toAsn1();
    const der = forge.asn1.toDer(asn1).getBytes();
    return Buffer.from(der, 'binary');
  }
}
