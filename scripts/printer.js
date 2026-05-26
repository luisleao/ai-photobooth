#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = __dirname;
const PENDING_DIR = path.join(ROOT_DIR, 'pending');
const PRINTED_DIR = path.join(ROOT_DIR, 'printed');
const POLL_INTERVAL_MS = Number(process.env.PRINTER_POLL_INTERVAL_MS || 1000);

fs.mkdirSync(PENDING_DIR, { recursive: true });
fs.mkdirSync(PRINTED_DIR, { recursive: true });

const knownPending = new Set(listFiles(PENDING_DIR));
const loggedPrinted = new Set(listFiles(PRINTED_DIR));

console.log(`[printer] Monitorando fila pendente: ${PENDING_DIR}`);
console.log(`[printer] Monitorando arquivos impressos: ${PRINTED_DIR}`);
console.log(`[printer] Intervalo de verificacao: ${POLL_INTERVAL_MS}ms`);

const interval = setInterval(scanQueues, POLL_INTERVAL_MS);

process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('\n[printer] Monitor encerrado.');
  process.exit(0);
});

function scanQueues() {
  listFiles(PENDING_DIR).forEach((filename) => {
    knownPending.add(filename);
  });

  listFiles(PRINTED_DIR).forEach((filename) => {
    if (loggedPrinted.has(filename)) {
      return;
    }

    loggedPrinted.add(filename);

    const origin = knownPending.has(filename)
      ? 'movido de pending para printed'
      : 'detectado em printed';

    console.log(`[printer] Arquivo ${origin}: ${filename}`);
  });
}

function listFiles(directory) {
  return fs.readdirSync(directory).filter((filename) => isFile(path.join(directory, filename)));
}

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
}
