# Desafio prático - Desenvolvedor back-end Node.JS

Este é um roteiro das atividades do desafio para vaga de Desenvolvedor NodeJS. O
desafio consiste em 5 etapas, sendo elas: obtenção do resumo criptográfico (hash) de um
arquivo, geração de uma assinatura digital, verificação de uma assinatura digital, criação de uma
API REST e a escrita de um relatório.
O objetivo é avaliar o candidato no uso das tecnologias indicadas e das boas práticas de
programação considerando o nível esperado (estágio, júnior, pleno ou sênior). A
implementação é livre, use sua criatividade!
IMPORTANTE: confirmar sistema operacional solicitado: Windows ou Linux
Qualquer dúvida envie um e-mail para <darlan@bry.com.br>

Observações:
● É fácil encontrar trechos de códigos de exemplo para este fim na Internet;
● Você pode se basear nestes códigos, mas espera-se que o sistema final entregue seja
robusto e estável, o que normalmente não é o caso de códigos de exemplo;
● Utilize seu conhecimento e os métodos adequados para garantir esta robustez e
estabilidade;
● Comentários em código e tratamentos de erro são bem-vindos;
● Utilize a linguagem Node.JS versão 20.x em diante;
● Utilizar a biblioteca de criptografia Forge;
● Utilizar o framework NestJS para a criação da API REST;
● Criar testes unitários utilizando Jest para o código das etapas 1, 2 e 3;
● É desejável o uso do NPM ou PNPM para gestão de dependências;
● Caso não consiga concluir todas as etapas, entregue-o mesmo assim;
● No fim deste roteiro há alguns links úteis para ajudar.
● Artefatos para uso no desafio disponíveis neste link.

Entregáveis ao final do desafio:
● Arquivo compactado projeto (código fonte, incluindo os testes unitários) por email ou no
seu repositório GIT de preferência;
● Arquivo assinado da etapa 2;
● README com informações relevantes para execução do projeto;
● Relatório em PDF (descrever como implementou o código, dificuldades, etc)

Etapa 1 - Obtenção do resumo criptográfico

Aqui a tarefa é bem simples, pois basta obter o resumo criptográfico do conteúdo de um
documento. Note que o documento deve ser o arquivo doc.txt, que está na pasta
resources/arquivos/.
Os pontos a serem verificados para essa etapa ser considerada concluída, são os seguintes:
● Obter o resumo criptográfico do documento, especificado na descrição dessa etapa,
usando o algoritmo de resumo criptográfico conhecido por SHA-512;
● Anexar ao desafio um documento contendo o resultado do resumo criptográfico em
hexadecimal.

Etapa 2 - Realizar uma assinatura digital

Essa etapa é um pouco mais complexa, pois será necessário implementar um método
para gerar assinaturas digitais. O padrão de assinatura digital adotado será o Cryptographic
Message Syntax (CMS).
A assinatura CMS deverá ser do tipo attached, isto é, o documento/conteúdo assinado
deverá estar anexado na estrutura da própria assinatura.
Esse padrão usa a linguagem ASN.1, que é uma notação em binário, assim não será
possível ler o resultado obtido sem o auxílio de alguma ferramenta. Caso tenha interesse de ver
a estrutura da assinatura gerada, utilize a ferramenta ASN.1 Javacript Decoder.
Para realizar esta etapa, você fará uso do artefato contido em “resources/pkcs12/”. O
arquivo no padrão PKCS12 possui o certificado e a respectiva chave privada. Primeiramente,
você deve extrair a chave privada e o certificado deste arquivo PKCS12. O alias para obter o
certificado é “e2618a8b-20de-4dd2-b209-70912e3177f4” e a senha para obter a chave privada é
“bry123456”.
Com os dados do assinante prontos, utilize as classes e métodos da biblioteca de
criptografia indicada para preparar e gerar uma assinatura. O arquivo a ser assinado é o mesmo
da primeira etapa.
Os pontos a serem verificados para essa etapa ser considerada concluída, são os seguintes:
● Gerar uma assinatura digital usando o algoritmo de resumo criptográfico SHA-512 e o
algoritmo assimétrico RSA;

● Assinar o arquivo resources/doc.txt;
● Gravar a assinatura em disco com a extensão “.p7s”.

Etapa 3 - Verificar a assinatura gerada

A terceira etapa deste desafio consiste na verificação da assinatura que você gerou no
passo dois, utilizando classes e métodos da biblioteca de criptografia.
Os pontos a serem verificados nesta etapa, são os seguintes:
● Verificar a integridade da assinatura, retornando true ou false no resultado.
● Verificar a confiança do certificado utilizando os artefatos em “resources/cadeia/”.
● Imprimir algumas informações relevantes do certificado do signatário.

Etapa 4 - API REST

Na última etapa deste desafio, deverá ser implementado uma API Rest reutilizando o
código criado nas etapas anteriores. Será necessário implementar dois endpoints, conforme
descrição abaixo:

1. /signature/
   a. A requisição deve ser no formato multipart/form-data. No corpo da requisição
   deve conter:
   i. o arquivo a ser assinado;
   ii. o arquivo PKCS12 (possui o certificado e chave privada);
   iii. um parâmetro informando a senha do arquivo PKCS12
   b. Retornar no corpo da resposta a assinatura CMS codificada em Base64.
2. /verify/
   a. A requisição deve ser no formato multipart/form-data. No corpo da requisição
   deve conter:
   i. Arquivo assinado (padrão CMS attached)
   b. Deve retornar no corpo da resposta JSON:
   i. Status (obrigatório)
3. "VALIDO", caso a verificação da assinatura retorne true;

4. “INVALIDO”, caso a verificação da assinatura retorne false;
   ii. Infos (opcional)
5. Nome do signatário (atributo CN do certificado)
6. Data da assinatura (atributo signingTime)
7. Hash do documento (atributo encapContentInfo) no formato
   hexadecimal
8. Nome do algoritmo de hash (atributo digestAlgorithm)

Para auxiliar nos testes da implementação, recomendamos o uso do software Postman,
que possui uma interface simples para configurar uma requisição.
Os pontos a serem verificados nesta etapa, são os seguintes:
● Start do servidor sem erros;
● Endpoints conseguem receber dados e retornar uma resposta;
● Tratamento de erros;
● Informações adicionais na verificação da assinatura.

Etapa 5 - Relatório das Atividades

Após concluir todas as etapas práticas, é hora de relatar os acontecimentos. Neste
relatório, descrever o código implementado, estrutura do projeto, como buildar/rodar o código,
decisões de projeto e demais informações que julgar relevante. Descrever também as
dificuldades encontradas durante a resolução das etapas durante o desafio.
Obs: caso não conclua todas as etapas práticas, escreva um relatório mesmo assim (descrevendo
o que foi feito e o que não foi feito), isso acaba ajudando no momento da avaliação.

Etapa 6 (OPCIONAL) - Distribuição do código

Distribuir o código através de um pipeline simples para publicar o executável/binário, por
exemplo na aba de releases do Github ou Gitlab.

Links úteis

● O que é uma assinatura digital?

o Assinatura digital: descubra o que é e como funciona

● O que é um certificado digital?

o Certificado digital: o que é e como funciona? Aprenda como usar

● ASN.1 Javacript Decoder

o <https://lapo.it/asn1js>

● NestJS:

o <https://nestjs.com>
● Forge (biblioteca de criptografia):

o <https://github.com/digitalbazaar/forge>

● NPM e PNPM (gerência de dependências):
o <https://www.npmjs.com>
o <https://pnpm.io>
● Jest (biblioteca para testes)
o <https://jestjs.io>
● RFC 5652 Assinatura CMS:

o RFC 5652 - Cryptographic Message Syntax (CMS)
