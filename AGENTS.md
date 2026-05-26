# AI Photobooth Agents Guide

Este repositório abriga uma aplicação Node.js com Express para um photobooth com captura local, geração de cards e testes de impressão lenticular.

## Estrutura

- `/server`: servidor Express e backends da aplicação.
- `/server/src`: codigo do servidor, rotas e servicos.
- `/server/public`: arquivos publicos servidos pelo Express.
- `/server/public/photobooth`: interface publica do photobooth em `/photobooth/`.
- `/server/public/generator`: interface publica para gerar a figurinha principal e as dez figurinhas menores em `/generator/`.
- `/server/public/generated`: saidas geradas localmente. Este diretorio nao deve ser versionado.
- `/scripts`: scripts locais para desenvolvimento, seed de dados, testes manuais e utilitarios.

## Funcionalidades atuais

- `GET /health`: endpoint simples de saude do servidor.
- `GET /photobooth/`: pagina publica que abre a camera local, captura duas fotos em sequencia e prepara uma tirinha.
- `GET /generator/`: pagina publica para enviar uma imagem base por arquivo ou webcam, preencher parametros da figurinha principal e gerar as onze imagens.
- `GET /api/photobooth/image-prompts`: lista as onze imagens geradas e seus formatos de saida.
- `POST /api/photobooth/generate-image`: gera uma unica imagem por vez, mantendo todas as saidas no mesmo `runId`; usado pela interface para exibir progresso incremental.
- `POST /api/photobooth/generate-images`: recebe uma imagem base e parametros da figurinha principal, entao salva as imagens em `/server/public/generated/<runId>`.
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

O gerador cria onze imagens a partir de uma imagem base:

- `01-figurinha-principal.png`: imagem principal em `1181x1772` pixels, equivalente a 10x15 cm a 300 DPI. Ela e composta com `sharp` usando uma cor base, o fundo `server/assets/background.png`, a imagem recortada gerada pela IA em plano medio, da camiseta para cima, e o overlay `server/assets/mask.png`.
- `02` a `11`: figurinhas menores salvas em PNG `1024x1024` e WebP `512x512`.
- `figurinhas-grid-3-5x6.png`: folha PNG em `1050x1800` pixels, equivalente a 3.5x6 polegadas a 300 DPI, com oito figurinhas selecionadas em duas colunas, sem bordas, guias ou reticula de grade.
- `scripts/pending/<runId>-figurinhas-grid-3-5x6.png`: copia local da folha enviada para a fila de impressao.

O servico usa OpenAI por padrao e exige `OPENAI_API_KEY` no ambiente ou no arquivo local `.env`. A geracao usa a Images API `images.edit` com `OPENAI_IMAGE_MODEL`, padrao `gpt-image-1.5`, `background=transparent` e `output_format=png`. O modo placeholder local so deve ser usado explicitamente com `IMAGE_GENERATION_MODE=mock`, para validar a interface, os prompts, os nomes de arquivo e o pipeline de exportacao sem custo de IA.

A etapa de IA usa a Images API com `images.edit` e a imagem enviada como referencia. Os prompts ficam em `/server/src/services/worldCupImagePrompts.js`; o pipeline de geracao e exportacao fica em `/server/src/services/generatedImages.js`.

A interface `/generator/` permite escolher entre upload de arquivo ou captura pela webcam. Ela mantem a lista vazia ate o clique em gerar; depois monta os onze itens com loader e um item separado no fim para o `sticker-sheet`, gera primeiro o recorte principal com camiseta de jogo do Brasil, compoe a figurinha `10x15` com `sharp` e usa uma versao reduzida desse recorte como imagem de referencia para disparar as outras dez imagens em paralelo. A imagem base e reduzida para JPEG com lado maximo configuravel antes de ser enviada ao provider de IA, diminuindo o custo de tokens de imagem; os padroes atuais sao `OPENAI_SOURCE_IMAGE_MAX_SIZE=1024` e `OPENAI_SOURCE_IMAGE_QUALITY=82`.

As figurinhas secundarias devem manter a mesma linguagem visual entre si: caricatura 3D expressiva no mesmo pacote visual de `O Grito de Gol` e `O Sufoco dos Penaltis`. As figurinhas `Hexa` e `GOOOOOOOL` pedem os textos `HEXAAAAA` e `GOOOOOOOL` diretamente na geracao, sem camada programatica extra para evitar duplicacao. A folha `3.5x6` inclui apenas `O Grito de Gol`, `O Sufoco dos Penaltis`, `Pedindo o VAR`, `O Hexa Vem`, `Cartao Vermelho`, `Hexa`, `GOOOOOOOL` e `Tristeza Pos-Jogo`.

Os prompts nao devem adicionar acessorios que nao existam na foto original, exceto quando a figurinha pedir isso explicitamente, como o oculos tipografico de `O Hexa Vem`. Mencoes a preservar oculos sao sempre condicionais: se a imagem principal nao tiver oculos, nenhuma figurinha deve inventar oculos, com excecao de `O Hexa Vem`. A figurinha `Hexa` nao deve inventar oculos tematico ou oculos com texto.

Em `O Hexa Vem`, o oculos tipografico deve ter exatamente a palavra `HEXA`, sem numeral, pontuacao, letras extras, hastes laterais visiveis ou elementos que parecam caracteres adicionais.

Quando a foto original tiver acessorios reais, eles devem manter estilo, material, cor, formato, tamanho e posicao. A fidelidade do rosto tem prioridade sobre embelezamento, pose ou estilo: nao alterar idade aparente, proporcoes faciais, tom de pele, nariz, boca, olhos, sobrancelhas, sorriso, cabelo ou caracteristicas unicas.

Quando a imagem principal exibir numero na camiseta, as figurinhas secundarias devem preservar o mesmo numero visivel na camiseta, sem remover, trocar, esconder, mover ou duplicar.

Os parametros de composicao da figurinha principal podem vir da interface ou do ambiente. A interface `/generator/` tambem permite ajustar visualmente a area da pessoa com arraste e handles de redimensionamento, salvando a configuracao no `localStorage` do navegador para as proximas geracoes.

- `MAIN_CARD_COMPOSITION`: JSON unico com os defaults de composicao, por exemplo `{"background":"#000d25","imageLeft":90,"imageTop":82,"imageWidth":990,"imageHeight":1485,"imageFit":"contain"}`.
- `MAIN_CARD_BACKGROUND`: cor do fundo, padrao `#000d25`.
- `MAIN_CARD_BACKGROUND_IMAGE_PATH`: caminho alternativo para a imagem de fundo, caso nao use `server/assets/background.png`.
- `MAIN_CARD_IMAGE_LEFT` e `MAIN_CARD_IMAGE_TOP`: posicao do recorte dentro do card.
- `MAIN_CARD_IMAGE_WIDTH` e `MAIN_CARD_IMAGE_HEIGHT`: tamanho do recorte antes do overlay.
- `MAIN_CARD_IMAGE_FIT`: modo de ajuste do `sharp`, padrao `contain`.
- `MAIN_CARD_OVERLAY_PATH`: caminho alternativo para o overlay, caso nao use `server/assets/mask.png`.

## Fila de impressao local

Quando a folha `3.5x6` e gerada, o backend copia o PNG para `/scripts/pending` com o `runId` no nome. O script `scripts/printer.js` monitora `/scripts/pending` e `/scripts/printed`; quando um arquivo aparece em `/scripts/printed`, ele registra um `console.log`. A integracao real com impressora deve ser adicionada posteriormente.

No prototipo atual, o PDF de calibragem usa apenas frames sinteticos A/B. As fotos capturadas continuam disponiveis na interface para as proximas etapas, mas nao entram nesse teste.

## Comandos

- `npm install`: instala dependencias.
- `npm start`: inicia o servidor Express.
- `npm run dev`: inicia o servidor Express em modo local.
- `npm run printer`: inicia o monitor local da fila de impressao.
- `npm run check`: valida sintaxe dos arquivos principais do servidor.

## Convencoes

- Mantenha arquivos publicos dentro de `/server/public`.
- Evite colocar logica de negocio dentro dos arquivos estaticos quando ela pertencer ao backend.
- Servicos reutilizaveis devem ficar em `/server/src/services`.
- Scripts locais devem ficar em `/scripts` e documentar entradas, saidas e efeitos colaterais.
- Arquivos gerados, como PDFs temporarios, nao devem ser versionados por padrao.
