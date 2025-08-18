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

19. ccc8134 (2025-08-18) feat: enhance signature verification with additional certificate details and trust validation; marca v0.0.3.
