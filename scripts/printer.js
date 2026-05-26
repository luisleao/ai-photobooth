#!/usr/bin/env node

const fs = require('node:fs');
const {
  PENDING_DIR,
  PRINTED_DIR,
  ensurePrintDirectories,
  notifyPrintedFile,
  syncPrintQueueToLocalPending,
} = require('../server/src/services/printQueue');

const POLL_INTERVAL_MS = Number(process.env.PRINTER_POLL_INTERVAL_MS || 3000);

let scanning = false;
const loggedPrinted = new Set(listFilesSafe(PRINTED_DIR));

async function start() {
  await ensurePrintDirectories();

  console.log(`[printer] Monitorando fila pendente: ${PENDING_DIR}`);
  console.log(`[printer] Monitorando arquivos impressos: ${PRINTED_DIR}`);
  console.log(`[printer] Intervalo de verificacao: ${POLL_INTERVAL_MS}ms`);

  await scanQueues();
  const interval = setInterval(scanQueues, POLL_INTERVAL_MS);

  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n[printer] Monitor encerrado.');
    process.exit(0);
  });
}

async function scanQueues() {
  if (scanning) {
    return;
  }

  scanning = true;

  try {
    const sync = await syncPrintQueueToLocalPending();

    if (sync.downloaded) {
      console.log(`[printer] ${sync.downloaded} arquivo(s) baixado(s) para pending.`);
    }

    if (sync.printed) {
      console.log(`[printer] ${sync.printed} imagem(ns) principal(is) enviada(s) para impressao.`);
    }

    if (sync.mainErrors) {
      console.log(`[printer] ${sync.mainErrors} erro(s) ao imprimir foto principal. A fila de stickers continua sendo sincronizada.`);
    }

    if (sync.stickerErrors) {
      console.log(`[printer] ${sync.stickerErrors} erro(s) ao baixar sticker sheet.`);
    }

    if (sync.mainDisabled) {
      console.log(`[printer] Impressao local da foto principal desativada (${sync.mainDisabled} item(ns) ignorado(s)).`);
    }

    if (sync.stickersDisabled) {
      console.log(`[printer] Impressao local de sticker sheets desativada (${sync.stickersDisabled} item(ns) ignorado(s)).`);
    }

    if (sync.skipped) {
      console.log(`[printer] Sincronizacao remota ignorada: ${sync.reason}.`);
    }

    const printedFiles = listFilesSafe(PRINTED_DIR);

    for (const filename of printedFiles) {
      if (loggedPrinted.has(filename)) {
        continue;
      }

      loggedPrinted.add(filename);
      console.log(`[printer] Arquivo detectado em printed: ${filename}`);

      const result = await notifyPrintedFile(filename);

      if (result.notified) {
        console.log(`[printer] Participante notificado para a impressao ${result.printId}.`);
      } else {
        console.log(`[printer] Notificacao nao enviada: ${result.reason || 'sem destino'}.`);
      }
    }
  } catch (error) {
    console.error('[printer] Falha ao sincronizar fila:', error.message || error);
  } finally {
    scanning = false;
  }
}

function listFilesSafe(directory) {
  try {
    return fs.readdirSync(directory).filter((filename) => isFile(`${directory}/${filename}`));
  } catch (error) {
    return [];
  }
}

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
}

start().catch((error) => {
  console.error('[printer] Falha ao iniciar monitor:', error.message || error);
  process.exit(1);
});
