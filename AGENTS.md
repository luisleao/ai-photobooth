# AI Photobooth Agents Guide

Este repositório abriga uma aplicação Node.js com Express para um photobooth com captura local, geração de cards e testes de impressão lenticular.

## Estrutura

- `/server`: servidor Express e backends da aplicação.
- `/server/src`: codigo do servidor, rotas e servicos.
- `/server/public`: arquivos publicos servidos pelo Express.
- `/server/public/photobooth`: interface publica do photobooth em `/photobooth/`.
- `/scripts`: scripts locais para desenvolvimento, seed de dados, testes manuais e utilitarios.

## Funcionalidades atuais

- `GET /health`: endpoint simples de saude do servidor.
- `GET /photobooth/`: pagina publica que abre a camera local, captura duas fotos em sequencia e prepara uma tirinha.
- `POST /api/photobooth/cards`: devolve um PDF letter com fundo branco e paginas de calibragem A/B focadas em lente `50 LPI`.

## Fluxo do photobooth

1. A pagina solicita permissao da camera local via `navigator.mediaDevices.getUserMedia`.
2. O participante informa um nome e tira duas fotos com contagem regressiva entre elas.
3. A interface mostra a tirinha de dois frames.
4. A pagina pode gerar um PDF de calibragem A/B sem usar imagens capturadas.
5. O backend monta um PDF em tamanho letter com bandas A/B programaticas.

## Teste lenticular 50 LPI

O prototipo considera uma lente de `50 LPI` e uma impressora de `300 DPI`. Cada card usa dois frames sinteticos A/B, entao a largura de cada subfaixa impressa e calculada como:

```text
300 / (50 * 2) = 3 pixels
```

O backend rasteriza a arte lenticular em `600 DPI` com `sharp` e embute cada variacao uma unica vez no PDF gerado com `pdfkit`. O alvo fisico continua sendo a lente `50 LPI`; a rasterizacao mais alta ajuda a reduzir suavizacao e reamostragem do driver. O PDF atual gera duas paginas:

- `50 LPI phase test`: seis bandas grandes em 50 LPI com deslocamentos de fase `0` a `5` pixels.
- `50 LPI pitch sweep`: sete bandas grandes em `48`, `49`, `49.5`, `50`, `50.5`, `51` e `52 LPI`.

As opcoes incluem bandas largas, cores fortes, letras A/B, marcadores de posicao, cruz central e reguas de alinhamento para tornar a alternancia mais obvia durante a calibragem. Isso permite imprimir em escala 100% e comparar qual fase, escala e direcao se alinham melhor com a lente lenticular disponivel. A calibragem final ainda deve ser feita com impressora, papel, orientacao da lente e escala de impressao reais.

## Geracao de imagem por IA

A etapa de IA deve entrar antes da composicao do card. O contrato esperado e um servico que receba os frames, dados do participante e parametros criativos, e retorne uma imagem final para a area interna do card ou duas variacoes sincronizadas para a lente lenticular.

No prototipo atual, o PDF de calibragem usa apenas frames sinteticos A/B. As fotos capturadas continuam disponiveis na interface para as proximas etapas, mas nao entram nesse teste.

## Comandos

- `npm install`: instala dependencias.
- `npm start`: inicia o servidor Express.
- `npm run dev`: inicia o servidor Express em modo local.
- `npm run check`: valida sintaxe dos arquivos principais do servidor.

## Convencoes

- Mantenha arquivos publicos dentro de `/server/public`.
- Evite colocar logica de negocio dentro dos arquivos estaticos quando ela pertencer ao backend.
- Servicos reutilizaveis devem ficar em `/server/src/services`.
- Scripts locais devem ficar em `/scripts` e documentar entradas, saidas e efeitos colaterais.
- Arquivos gerados, como PDFs temporarios, nao devem ser versionados por padrao.
