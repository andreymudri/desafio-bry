# Desafio Bry — Relatório Técnico do Projeto

Este relatório descreve a evolução do projeto, o código implementado, a arquitetura/estrutura, como buildar e executar, as decisões tomadas, e as principais dificuldades enfrentadas durante o desenvolvimento.

## Visão geral

API em NestJS para assinar arquivos no formato CMS/P7S e verificar assinaturas. Usa node-forge para fazer a manipulação de PKCS#12 e PKCS#7, Multer para upload de arquivos e Swagger para documentação.

Principais endpoints:

- POST /signature — recebe um arquivo comum + um PFX/P12 e a senha. Retornando uma assinatura CMS em Base64 no JSON
- POST /verify — recebe um arquivo (p7s ou outro) e verifica se é uma assinatura válida; retorna status VALIDO/INVALIDO e informações adicionais da assinatura quando disponíveis.

Documentação interativa: <http://localhost:3000/docs>

## Linha do tempo (do primeiro ao último commit)

1. 915b7a9 (2025-08-15) feat: nest project started. no changes
   - Bootstrap do projeto NestJS.

2. 502e574 (2025-08-15) feat: added hash and signDoc endpoints
   - Primeiras rotas de hash/assinatura (protótipo inicial).

3. 8d0789a (2025-08-15) feat: implement file signing and saving functionality
   - Implementação de assinatura e salvamento em disco (função utilitária inicial em `ForgeHelper`).

4. 2e072f2 (2025-08-15) refactor: improve type handling and enhance saveFileToDisk method
   - Refatoração de tipos e melhoria do método de persistência da assinatura.

5. de42240 (2025-08-15) feat: add verifySignature method and endpoint for signature verification
   - Criação do endpoint de verificação de assinatura.

6. 1e99904 (2025-08-17) feat: implement file signing and verification functionality with updated endpoints
   - Consolidação das rotas de assinatura/verificação e ajustes de contrato.

7. 68756f7 (2025-08-17) test: update verifySignature test to use existing resource file
   - Ajustes de testes com recursos já versionados.

8. de22685 (2025-08-18) feat: add end-to-end tests for CryptoController with file signing and verification
   - Testes E2E com Supertest cobrindo assinatura e verificação.

9. 608b0f4 (2025-08-18) feat: add class-transformer and class-validator dependencies
   - Adição de validação de DTOs.

10. 11f9738 (2025-08-18) feat: enhance file upload handling with Multer configuration and error filtering
    - Limites de upload e filtros por extensão com Multer; interceptor dedicado para múltiplos campos.

11. 1888000 (2025-08-18) feat: refactor signFileCMS to use SignRequestDto and enhance file upload validation
    - Uso de DTO para senha do PFX e validações.

12. 8cd498a (2025-08-18) feat: update CryptoController and service to return JSON response for signature and improve error handling
    - Resposta padronizada em JSON e tratamento de erros mais robusto.

13. 6b3ca66 (2025-08-18) feat: enhance CryptoService error handling and refactor file signing methods for better async support
    - Mapeamento de erros de domínio para PKCS#12 (senha inválida, PFX corrompido, alias inexistente) e refatorações assíncronas.

14. 9481d55 (2025-08-18) feat: add Swagger documentation setup and create SignatureFormDto for file signing
    - Configuração do Swagger e DTOs com `@nestjs/swagger`.

15. b78cef1 (2025-08-18) feat: add Dockerfile, .dockerignore, and Docker Compose configuration for application setup
    - Conteinerização multi-stage e Compose básico.

16. 57c64da (2025-08-18) (tag: v0.0.1) chore: correct Dockerfile stage naming and improve README formatting
    - Correções no Dockerfile e documentação inicial; marca v0.0.1.

17. bc39aae (2025-08-18) feat: add CI and release workflow for automated testing and deployment
    - Automação de testes/release (conforme mensagem de commit).

18. 7755e87 (2025-08-18) (HEAD, tag: v0.0.2) test(e2e): generate signed file during test to avoid git-ignored fixture and fix CI
    - Geração da assinatura durante os testes para não depender de artefatos ignorados no `.gitignore`; marca v0.0.2.

## Arquitetura e decisões de projeto

- Plataforma: NestJS(Express).
- Criptografia: node-forge para PKCS#12 (PFX/P12) e PKCS#7 (CMS/P7S).
- Uploads: Multer com limites (10 MB por arquivo) e filtros por extensão; uso de diretório temporário do SO.
- Validação: `class-validator`/`class-transformer` com `ValidationPipe` global (whitelist + transform).
- Erros de upload: `MulterExceptionFilter` mapeia códigos para mensagens mais claras em português.
- Documentação: Swagger (`/docs`) com DTOs anotados para upload multipart.
- Respostas: JSON consistente e sanitizado; evita vazar mensagens internas de bibliotecas.
- Testes: E2E com Jest + Supertest; geração on-the-fly de arquivo assinado para validação.
- Conteinerização: Docker multi-stage (deps/build/final), execução como usuário não-root; Compose expõe porta 3000.

Racionais:

- Os erros de PKCS#12 são traduzidos para exceções de domínio, facilitando mensagens HTTP coerentes.
- Uploads em campos separados (`file` e `pfx`) deixam o contrato explícito e fácil de documentar (Swagger).

## Estrutura do projeto (resumo)

- `src/`
  - `main.ts` — bootstrap Nest, pipes globais, filtro de Multer e Swagger.
  - `app.module.ts` — módulo raiz; registra Multer e controllers/providers.
  - `crypto/`
    - `crypto.controller.ts` — rotas `/signature` e `/verify` (multipart + validação).
    - `crypto.service.ts` — assinar (`signFileCMS`) e verificar (`verifySignature`).
    - `forge.helper.ts` — carregar PFX, assinar dados (CMS), verificar CMS, salvar arquivo assinado.
    - `dto/` — `SignatureFormDto`, `SignRequestDto`, `FileUploadDto` para Swagger/validação.
    - `interceptors/signature-files.interceptor.ts` — Multer configurado para campos `file` e `pfx`.
  - `filters/multer-exception.filter.ts` — formato de erro amigável para uploads.
- `resources/`
  - `arquivos/doc.txt` — arquivo exemplo.
  - `pkcs12/certificado_teste_hub.pfx` — PFX de teste.
  - `assinados/` — saída das assinaturas gravadas (quando aplicável). arquivos nesta pasta serão ignorados pelo git
- Testes: `test/crypto.e2e-spec.ts`, `test/app.e2e-spec.ts`.
- Docker: `Dockerfile` (multi-stage) e `compose.yaml`.

## Endpoints e contratos

### POST /signature

- Consome `multipart/form-data` com campos:
  - `file` (binary) — arquivo a ser assinado.
  - `pfx` (binary) — arquivo PKCS#12 com chave privada.
  - `pfxPassword` (string, min 6) — senha do PFX.
- Resposta 200 (application/json):
  - `{ "signature": "<BASE64_CMS>" }`
- Erros comuns:
  - 400 Bad Request (campos ausentes/invalidos; erro Multer com mensagem amigável).
  - 422 Unprocessable Entity (PFX corrompido, alias não encontrado, falha ao gerar assinatura).

### POST /verify

- Consome `multipart/form-data` com campo:
  - `file` (binary) — arquivo a ser verificado (p7s ou outro binário).
- Resposta 200 (application/json):
  - `{ "status": "VALIDO" | "INVALIDO", "infos"?: { signerName?, signingTime?, documentHash?, hashName? } }`
  - Em falha de leitura ou parsing, retorna `{ status: "INVALIDO" }` (sanitizado).

Observações:

- O método de assinatura usa CMS embedado (não destacado). A verificação extrai metadados quando disponíveis.

## Como rodar localmente

Pré-requisitos: Node.js 22+, npm.

Instalação e execução (desenvolvimento):

```powershell
npm ci
npm run start:dev
```

Aplicação em <http://localhost:3000> e Swagger em <http://localhost:3000/docs>.

Testes (inclui E2E):

```powershell
npm run test
npm run test:e2e
```

## Como rodar com Docker

Usando Docker Compose:

```powershell
docker compose up --build
```

Depois, acesse <http://localhost:3000> e <http://localhost:3000/docs>.

Imagem manual (opcional):

```powershell
docker build -t desafio-bry .
docker run --rm -p 3000:3000 desafio-bry
```

Notas de Docker:

- Multi-stage (deps/build/final) para imagem menor e separação de dependências.
- Executa como usuário não-root.
- `resources/` é copiado para a imagem, permitindo testes com o PFX de exemplo.

## Dificuldades e como foram tratadas

- PKCS#12 (PFX) e node-forge
  - Tipagem imprecisa do forge em TS; uso controlado de `any` em pontos necessários e wrappers de domínio para erros.
  - Variações de armazenamento de `friendlyName` e `localKeyId` em bolsas; foi implementado uma combinação identica por alias, por localKeyId e implementado um fallback quando há apenas 1 par chave/cert.
  - Mapeamento explícito de erros: senha inválida, DER inválido/corrompido, alias inexistente.

- Assinatura e verificação CMS
  - Conversões binário/Base64 cuidadosas para manter interoperabilidade e evitar corrupção em I/O.
  - Verificação de confiança de certificado utilizando artefato
  - Extração resiliente de metadados (CN, signingTime, algoritmo de hash) dos atributos autenticados.

- Uploads e UX de erros
  - Limites estritos de tamanho/quantidade em Multer, filtros por extensão e interceptor de campos.
  - Filtro global para padronizar mensagens de erro de upload em português.

- Testes e CI
  - E2E gera a assinatura durante o teste para não depender de artefato ignorado pelo Git, tornando o pipeline reprodutível.

- Docker e permissões
  - Execução como usuário `node` e `chown` nos assets para evitar problemas de escrita em `resources/assinados`.

## Referências rápidas

- Swagger: <http://localhost:3000/docs>
- Endpoints: `/signature`, `/verify`
- Recursos de exemplo: `resources/arquivos/doc.txt`, `resources/pkcs12/certificado_teste_hub.pfx`

---
