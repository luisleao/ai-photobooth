# Local Scripts

Use esta pasta para scripts de desenvolvimento local, seed de dados, verificacoes manuais e tarefas auxiliares.

Scripts devem documentar:

- Variaveis de ambiente esperadas.
- Entradas e saidas.
- Arquivos que podem ser criados ou modificados.
- Dependencias externas, quando houver.

## Scripts atuais

- `printer.js`: sincroniza `events/${eventId}/prints`, usando `PHOTOBOOTH_EVENT_ID`; imprime automaticamente pedidos `type=main` com `pdfkit`/`pdf-to-printer`, baixa pedidos `type=stickers` para `scripts/pending`, monitora `scripts/printed` e notifica o participante via WhatsApp quando o arquivo impresso aparece.
- `clearGenerated.js`: remove as saidas locais de `server/public/generated`.

## Ambiente

O loader da aplicacao busca variaveis em `.env` na raiz e em `scripts/.env`. O arquivo `scripts/.env` pode ser uma copia local do `.env` principal para permitir executar `node printer.js` diretamente dentro de `/scripts`; ele e ignorado pelo git.

- `PRINT_MAIN_ENABLED`: quando `true`, esta maquina imprime automaticamente a foto principal.
- `PRINT_STICKERS_ENABLED`: quando `true`, esta maquina baixa sticker sheets para `scripts/pending`.
