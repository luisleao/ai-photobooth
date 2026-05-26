# AI Photobooth Agents Guide

Este repositório abriga uma aplicação Node.js com Express para um photobooth com captura local, geração de cards e testes de impressão lenticular.

## Estrutura

- `/server`: servidor Express e backends da aplicação.
- `/server/src`: codigo do servidor, rotas e servicos.
- `/server/public`: arquivos publicos servidos pelo Express.
- `/server/public/photobooth`: interface publica do photobooth em `/photobooth/`.
- `/server/public/generator`: interface publica para gerar a figurinha principal e as dez figurinhas menores em `/generator/`.
- `/server/public/manager.html`: interface de gestao em `/manager` com Firebase Auth.
- `/server/public/generated`: saidas geradas localmente. Este diretorio nao deve ser versionado.
- `/scripts`: scripts locais para desenvolvimento, seed de dados, testes manuais e utilitarios.

## Funcionalidades atuais

- `GET /health`: endpoint simples de saude do servidor.
- `GET /photobooth/`: pagina publica que abre a camera local, captura duas fotos em sequencia e prepara uma tirinha.
- `GET /generator/`: pagina publica para enviar uma imagem base por arquivo ou webcam, preencher parametros da figurinha principal e gerar as onze imagens.
- `GET /manager`: interface autenticada por Firebase Auth para listar imagens geradas, participantes, tempos de geracao, controlar impressoes, filtrar a fila por status e ampliar stickers.
- `GET /api/photobooth/image-prompts`: lista as onze imagens geradas e seus formatos de saida.
- `POST /api/photobooth/generate-image`: gera uma unica imagem por vez, mantendo todas as saidas no mesmo `runId`; usado pela interface para exibir progresso incremental.
- `POST /api/photobooth/generate-images`: recebe uma imagem base e parametros da figurinha principal, entao salva as imagens em `/server/public/generated/<runId>`.
- `POST /api/photobooth/cards`: devolve um PDF letter com fundo branco e paginas de calibragem A/B focadas em lente `50 LPI`.
- `POST /api/photobooth/whatsapp`: webhook da Twilio para mensagens WhatsApp e imagens.
- `POST /api/photobooth/manager/prints`: cria pedidos de impressao via interface autenticada.
- `POST /api/photobooth/manager/images/:imageId/regenerate`: dispara uma nova geracao para uma imagem recebida e reenvia os resultados via WhatsApp.
- `POST /api/photobooth/manager/images/:imageId/stickers/:outputId/resend`: reenvia uma figurinha especifica via WhatsApp a partir do zoom no manager.

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
- `scripts/pending/<id>-figurinhas-grid-3-5x6.png`: copia local da folha enviada para a fila de impressao. No fluxo web, o arquivo ainda pode ser copiado ao final da geracao; no fluxo WhatsApp, ele entra automaticamente na fila local assim que a folha fica pronta.

O servico usa OpenAI por padrao e exige `OPENAI_API_KEY` no ambiente ou no arquivo local `.env`. A geracao usa a Images API `images.edit` com `OPENAI_IMAGE_MODEL`, padrao `gpt-image-1.5`, `background=transparent` e `output_format=png`. O modo placeholder local so deve ser usado explicitamente com `IMAGE_GENERATION_MODE=mock`, para validar a interface, os prompts, os nomes de arquivo e o pipeline de exportacao sem custo de IA.

A etapa de IA usa a Images API com `images.edit` e a imagem enviada como referencia. Os prompts ficam em `/server/src/services/worldCupImagePrompts.js`; o pipeline de geracao e exportacao fica em `/server/src/services/generatedImages.js`.

A interface `/generator/` permite escolher entre upload de arquivo ou captura pela webcam. Ela mantem a lista vazia ate o clique em gerar; depois monta os onze itens com loader e um item separado no fim para o `sticker-sheet`, gera primeiro o recorte principal com camiseta de jogo do Brasil, compoe a figurinha `10x15` com `sharp` e usa uma versao reduzida desse recorte como imagem de referencia para disparar as outras dez imagens em paralelo. A imagem base e reduzida para JPEG com lado maximo configuravel antes de ser enviada ao provider de IA, diminuindo o custo de tokens de imagem; os padroes atuais sao `OPENAI_SOURCE_IMAGE_MAX_SIZE=1024` e `OPENAI_SOURCE_IMAGE_QUALITY=82`.

A interface tambem possui um botao para limpar `/server/public/generated`, acionando a mesma rotina disponivel pelo script `npm run generated:clear`.

As figurinhas secundarias devem manter a mesma linguagem visual entre si: caricatura 3D expressiva no mesmo pacote visual de `O Grito de Gol` e `O Sufoco dos Penaltis`. As figurinhas `Hexa` e `GOOOOOOOL` pedem os textos `HEXAAAAA` e `GOOOOOOOL` diretamente na geracao, sem camada programatica extra para evitar duplicacao. A folha `3.5x6` inclui apenas `O Grito de Gol`, `O Sufoco dos Penaltis`, `Pedindo o VAR`, `O Hexa Vem`, `Cartao Vermelho`, `Hexa`, `GOOOOOOOL` e `Tristeza Pos-Jogo`.

Os prompts nao devem adicionar acessorios que nao existam na foto original, exceto quando a figurinha pedir isso explicitamente, como o oculos tipografico de `O Hexa Vem`. Mencoes a preservar oculos sao sempre condicionais: se a imagem principal nao tiver oculos, nenhuma figurinha deve inventar oculos, com excecao de `O Hexa Vem`. A figurinha `Hexa` nao deve inventar oculos tematico ou oculos com texto.

Em `O Hexa Vem`, o oculos tipografico deve ter exatamente a palavra `HEXA`, sem numeral, pontuacao, letras extras, hastes laterais visiveis ou elementos que parecam caracteres adicionais.

Quando a foto original tiver acessorios reais, eles devem manter estilo, material, cor, formato, tamanho e posicao. A fidelidade do rosto tem prioridade sobre embelezamento, pose ou estilo: nao alterar idade aparente, proporcoes faciais, tom de pele, nariz, boca, olhos, sobrancelhas, sorriso, cabelo ou caracteristicas unicas.

Quando a imagem principal exibir numero na camiseta, as figurinhas secundarias devem preservar o mesmo numero visivel na camiseta, sem remover, trocar, esconder, mover ou duplicar.
Quando o campo de numero estiver vazio, a imagem principal e as figurinhas secundarias nao devem inventar nenhum numero na camiseta.

Os parametros de composicao da figurinha principal podem vir da interface ou do ambiente. A interface `/generator/` tambem permite ajustar visualmente a area da pessoa com arraste e handles de redimensionamento, salvando a configuracao no `localStorage` do navegador para as proximas geracoes.

- `MAIN_CARD_COMPOSITION`: JSON unico com os defaults de composicao, por exemplo `{"background":"#000d25","imageLeft":90,"imageTop":82,"imageWidth":990,"imageHeight":1485,"imageFit":"contain"}`.
- `MAIN_CARD_BACKGROUND`: cor do fundo, padrao `#000d25`.
- `MAIN_CARD_BACKGROUND_IMAGE_PATH`: caminho alternativo para a imagem de fundo, caso nao use `server/assets/background.png`.
- `MAIN_CARD_IMAGE_LEFT` e `MAIN_CARD_IMAGE_TOP`: posicao do recorte dentro do card.
- `MAIN_CARD_IMAGE_WIDTH` e `MAIN_CARD_IMAGE_HEIGHT`: tamanho do recorte antes do overlay.
- `MAIN_CARD_IMAGE_FIT`: modo de ajuste do `sharp`, padrao `contain`.
- `MAIN_CARD_OVERLAY_PATH`: caminho alternativo para o overlay, caso nao use `server/assets/mask.png`.

## Fila de impressao local

O Firestore usa a raiz `/events/meta-20260528`. A mesma raiz e usada no Storage como `events/meta-20260528`.

O fluxo WhatsApp usa apenas tres colecoes no evento: `profiles`, `images` e `prints`. `profiles` usa como ID o MD5 do telefone com o prefixo `whatsapp:` removido, seguindo a funcao `limpaNumero` do projeto de referencia. `images` usa como ID o SID da mensagem recebida e guarda todos os parametros recebidos no webhook em `webhookParams`. `prints` guarda os pedidos de impressao e o tipo (`main` ou `stickers`). Os arquivos originais, fontes reduzidas, imagens geradas e folha de impressao sao enviados para o Storage dentro de `events/meta-20260528/images/<messageSid>/`.

O documento `/events/meta-20260528` possui `printLimitPerProfile`, que limita quantos pacotes cada participante pode enviar para geracao/impressao. Cada perfil em `profiles` possui `unlimited`, salvo como `false` por padrao; quando `true`, o limite do evento nao e aplicado para aquele participante. O evento e cada perfil acumulam contadores em `stats`, incluindo fotos recebidas, fotos geradas, tempos totais de geracao e impressoes concluidas de `main` e `stickers`.

O script `scripts/printer.js` sincroniza documentos `prints` pendentes do Firestore. Impressoes `main` sao automaticas: o script baixa a imagem principal, monta um PDF 10x15 com `pdfkit` e imprime usando `pdf-to-printer`, seguindo o padrao do `cartoon-printer` do projeto de referencia. Impressoes `stickers` sao manuais: o script baixa a folha PNG para `/scripts/pending` e monitora `/scripts/printed`; quando o arquivo aparece em `/scripts/printed`, ele marca o documento como `printed` e envia uma notificacao WhatsApp.

O loader de ambiente busca `.env` na raiz do projeto e tambem em `/scripts/.env`, permitindo executar o monitor a partir da pasta `/scripts`. Os arquivos `.env` sao ignorados pelo git. Use `PRINT_MAIN_ENABLED` e `PRINT_STICKERS_ENABLED` para definir se a maquina local imprime a foto principal e/ou sincroniza sticker sheets. Erros da impressao principal, como sistema operacional sem suporte no `pdf-to-printer`, nao devem interromper o download dos sticker sheets.

## WhatsApp e Twilio

Ao receber uma imagem pelo WhatsApp em `/api/photobooth/whatsapp`, o backend salva os dados de perfil do WhatsApp em `profiles`, registra todos os parametros recebidos em `images/<messageSid>`, baixa a midia da Twilio, salva uma copia local, gera uma versao JPEG reduzida para a OpenAI e inicia o processo diretamente, sem enviar mensagens textuais de progresso. A figurinha principal e gerada primeiro, enviada pelo WhatsApp como PNG composto com overlay e tambem colocada automaticamente em `prints` com `type=main`. Para o envio via WhatsApp, o backend cria uma copia PNG reduzida da principal para evitar rejeicao por tamanho de midia, mantendo o PNG grande para impressao.

As figurinhas secundarias sao geradas em paralelo e enviadas individualmente em WebP `512x512`, sem texto de legenda. Ao finalizar a folha `figurinhas-grid-3-5x6.png`, o backend tambem cria automaticamente um pedido `prints/<messageSid>_stickers`; nao ha mensagem de confirmacao para imprimir. Mensagens WhatsApp de texto sao usadas apenas quando a foto principal ou a folha de stickers forem marcadas como impressas.

Cada documento `images/<messageSid>` guarda `generation.lastDurationMs`, `generation.lastReceivedToCompletedMs`, tentativas e ultimo status. Os agregados em `stats.generation` permitem calcular o tempo medio geral e por participante, exibidos no `/manager`. O manager tambem permite regerar uma imagem recebida; a nova geracao substitui as saidas exibidas, reenvia os arquivos pelo WhatsApp e recoloca `main` e `stickers` na fila de impressao. A fila lateral do manager mostra pendentes por padrao e possui filtro por status; as miniaturas de stickers abrem uma visualizacao ampliada ao clique e o modal de zoom permite reenviar a figurinha via WhatsApp.

Variaveis principais:

- `PHOTOBOOTH_EVENT_ID`: id do evento no Firestore, padrao `meta-20260528`.
- `PHOTOBOOTH_STORAGE_ROOT`: raiz no Storage, padrao `events/meta-20260528`.
- `PHOTOBOOTH_PRINT_LIMIT_PER_PROFILE`: valor inicial de `printLimitPerProfile` quando o documento do evento ainda nao tiver esse campo.
- `WHATSAPP_MAIN_IMAGE_MAX_SIZE`: lado maximo da copia PNG da imagem principal enviada pelo WhatsApp.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` ou `TWILIO_MESSAGING_SERVICE_SID`.
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_STORAGE_BUCKET`.
- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_APP_ID`, `FIREBASE_MESSAGING_SENDER_ID`: config publica usada por `/manager`.
- `PRINTER_NAME`, `PRINTER_PAPER_SIZE`, `PRINTER_ORIENTATION` e `PRINTER_TESTING`: configuram a impressao automatica da imagem principal.
- `PRINT_MAIN_ENABLED` e `PRINT_STICKERS_ENABLED`: ligam ou desligam, por maquina, a impressao local da principal e a sincronizacao dos sticker sheets.

No prototipo atual, o PDF de calibragem usa apenas frames sinteticos A/B. As fotos capturadas continuam disponiveis na interface para as proximas etapas, mas nao entram nesse teste.

## Comandos

- `npm install`: instala dependencias.
- `npm start`: inicia o servidor Express.
- `npm run dev`: inicia o servidor Express em modo local.
- `npm run printer`: inicia o monitor local da fila de impressao.
- `npm run generated:clear`: limpa `/server/public/generated`.
- `npm run check`: valida sintaxe dos arquivos principais do servidor.

## Convencoes

- Mantenha arquivos publicos dentro de `/server/public`.
- Evite colocar logica de negocio dentro dos arquivos estaticos quando ela pertencer ao backend.
- Servicos reutilizaveis devem ficar em `/server/src/services`.
- Scripts locais devem ficar em `/scripts` e documentar entradas, saidas e efeitos colaterais.
- Arquivos gerados, como PDFs temporarios, nao devem ser versionados por padrao.
