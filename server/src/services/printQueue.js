const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const PDFDocument = require('pdfkit');
const { print } = require('pdf-to-printer');
const {
  FieldValue,
  Timestamp,
  downloadStorageFile,
  getEventRef,
  isFirebaseConfigured,
} = require('./firebaseAdmin');
const { STICKER_SHEET_FILENAME } = require('./generatedImages');
const { sendWhatsAppText, toWhatsAppAddress } = require('./twilioWhatsApp');

const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');
const PRINT_QUEUE_ROOT = process.env.PRINT_QUEUE_ROOT || path.join(PROJECT_ROOT, 'scripts');
const PENDING_DIR = process.env.PRINT_QUEUE_PENDING_ROOT || path.join(PRINT_QUEUE_ROOT, 'pending');
const PRINTED_DIR = process.env.PRINT_QUEUE_PRINTED_ROOT || path.join(PRINT_QUEUE_ROOT, 'printed');
const PRINTINGS_DIR = process.env.PRINTINGS_ROOT || path.join(PRINT_QUEUE_ROOT, 'printings');
const PRINTER_NAME = process.env.PRINTER_NAME || 'PRINTER';
const TESTING = String(process.env.TESTING || process.env.PRINTER_TESTING || '').toLowerCase() === 'true';
const PRINT_MAIN_ENABLED = readBooleanEnv('PRINT_MAIN_ENABLED', true);
const PRINT_STICKERS_ENABLED = readBooleanEnv('PRINT_STICKERS_ENABLED', true);

async function ensurePrintDirectories() {
  await Promise.all([
    fs.mkdir(PENDING_DIR, { recursive: true }),
    fs.mkdir(PRINTED_DIR, { recursive: true }),
    fs.mkdir(PRINTINGS_DIR, { recursive: true }),
  ]);
}

async function syncPrintQueueToLocalPending() {
  if (!isFirebaseConfigured()) {
    return {
      skipped: true,
      reason: 'firebase-not-configured',
      downloaded: 0,
      printed: 0,
      mainErrors: 0,
      stickerErrors: 0,
      mainDisabled: 0,
      stickersDisabled: 0,
    };
  }

  await ensurePrintDirectories();

  const snap = await getEventRef()
    .collection('prints')
    .where('status', 'in', ['pending', 'waiting-file'])
    .limit(25)
    .get();
  let downloaded = 0;
  let printed = 0;
  let mainErrors = 0;
  let stickerErrors = 0;
  let mainDisabled = 0;
  let stickersDisabled = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const file = await resolvePrintFile(data);

    if (!file || !file.storagePath) {
      continue;
    }

    if (data.type === 'main') {
      if (!PRINT_MAIN_ENABLED) {
        mainDisabled += 1;
        continue;
      }

      try {
        const ok = await printMainImage({
          printId: doc.id,
          data,
          file,
        });

        if (ok) {
          printed += 1;
          await markPrintDone(doc.ref, doc.id, data, 'printed');
        }
      } catch (error) {
        mainErrors += 1;
        console.error(`[printer] Falha ao imprimir foto principal ${doc.id}:`, error.message || error);
        await doc.ref.set({
          status: 'print-error',
          printError: publicError(error),
          updatedAt: Timestamp.now(),
        }, { merge: true });
      }

      continue;
    }

    if (!PRINT_STICKERS_ENABLED) {
      stickersDisabled += 1;
      continue;
    }

    const pendingFilename = sanitizeFilename(data.pendingFilename || `${doc.id}-${path.basename(file.storagePath)}`);
    const localPath = path.join(PENDING_DIR, pendingFilename);

    try {
      await fs.access(localPath);
    } catch (error) {
      try {
        await downloadStorageFile({
          storagePath: file.storagePath,
          localPath,
        });
        downloaded += 1;
      } catch (downloadError) {
        stickerErrors += 1;
        console.error(`[printer] Falha ao baixar sticker sheet ${doc.id}:`, downloadError.message || downloadError);
        await doc.ref.set({
          status: 'queue-error',
          queueError: publicError(downloadError),
          updatedAt: Timestamp.now(),
        }, { merge: true });
        continue;
      }
    }

    await doc.ref.set({
      file,
      status: 'queued',
      pendingFilename,
      localPendingPath: path.relative(PROJECT_ROOT, localPath),
      queuedAt: data.queuedAt || Timestamp.now(),
      updatedAt: Timestamp.now(),
    }, { merge: true });
  }

  return {
    skipped: false,
    downloaded,
    printed,
    mainErrors,
    stickerErrors,
    mainDisabled,
    stickersDisabled,
    pendingDir: PENDING_DIR,
  };
}

async function notifyPrintedFile(filename) {
  if (!isFirebaseConfigured()) {
    return {
      skipped: true,
      reason: 'firebase-not-configured',
    };
  }

  const printRef = await findPrintRefByFilename(filename);

  if (!printRef) {
    return {
      notified: false,
      reason: 'print-document-not-found',
    };
  }

  const snap = await printRef.get();

  if (!snap.exists) {
    return {
      notified: false,
      reason: 'print-document-not-found',
    };
  }

  const data = snap.data();

  if (data.status === 'printed' && data.notifiedAt) {
    return {
      notified: false,
      reason: 'already-notified',
    };
  }

  await markPrintDone(printRef, snap.id, data, 'printed', filename);

  return {
    notified: Boolean(getParticipantAddress(data)),
    printId: snap.id,
  };
}

async function markPrintDocumentStatus(printId, status, updatedBy) {
  const printRef = getEventRef().collection('prints').doc(printId);
  const snap = await printRef.get();

  if (!snap.exists) {
    return {
      ok: false,
      reason: 'print-document-not-found',
    };
  }

  if (status === 'printed') {
    const data = snap.data();

    if (data.status === 'printed' && data.notifiedAt) {
      return {
        ok: true,
        printId: snap.id,
        status,
        alreadyPrinted: true,
      };
    }

    await markPrintDone(printRef, snap.id, data, 'printed');
    return {
      ok: true,
      printId: snap.id,
      status,
    };
  }

  await printRef.set({
    status,
    updatedAt: Timestamp.now(),
    updatedBy,
    manualStatusChange: true,
  }, { merge: true });

  return {
    ok: true,
    printId: snap.id,
    status,
  };
}

async function printMainImage({
  printId,
  data,
  file,
}) {
  console.log('[printer] Imprimindo imagem principal:', printId);
  const imageUrl = file.signedUrl || file.url || file.final || '';

  if (!imageUrl) {
    console.log('[printer] Pedido sem URL assinada:', printId);
    return false;
  }

  const pdfPath = path.join(PRINTINGS_DIR, `${sanitizeFilename(printId)}.pdf`);
  const imageBuffer = await downloadPublicFile(imageUrl);

  await createMainPrintPdf({
    pdfPath,
    imageBuffer,
    title: printId,
  });

  if (TESTING) {
    console.log('[printer] TESTING=true, PDF gerado sem enviar para impressora:', pdfPath);
    return true;
  }

  const options = {
    printer: PRINTER_NAME,
    printDialog: false,
    paperSize: process.env.PRINTER_PAPER_SIZE || '(6x4)',
    silent: true,
    orientation: process.env.PRINTER_ORIENTATION || 'portrait',
    scale: 'fit',
  };

  await print(pdfPath, options);
  return true;
}

async function createMainPrintPdf({
  pdfPath,
  imageBuffer,
  title,
}) {
  await fs.mkdir(path.dirname(pdfPath), { recursive: true });

  if (fsSync.existsSync(pdfPath)) {
    await fs.rm(pdfPath, { force: true });
  }

  const widthCm = Number(process.env.MAIN_PRINT_WIDTH_CM || 10);
  const heightCm = Number(process.env.MAIN_PRINT_HEIGHT_CM || 15);
  const doc = new PDFDocument({
    size: [cmToPoints(widthCm), cmToPoints(heightCm)],
    layout: 'portrait',
    margins: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
  });

  doc.info.Title = title;

  const stream = doc.pipe(fsSync.createWriteStream(pdfPath));

  doc.image(imageBuffer, 0, 0, {
    fit: [doc.page.width, doc.page.height],
    align: 'center',
    valign: 'center',
  });
  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function markPrintDone(printRef, printId, data, status, printedFilename) {
  const to = getParticipantAddress(data);
  const now = Timestamp.now();
  let notifiedAt = null;
  let notificationError = null;

  if (to) {
    try {
      await sendWhatsAppText(
        toWhatsAppAddress(to),
        data.type === 'main'
          ? 'Sua imagem principal foi impressa e ja pode ser retirada na estacao do photobooth.'
          : 'Seus stickers estao impressos e ja podem ser retirados na estacao do photobooth.',
      );
      notifiedAt = now;
    } catch (error) {
      notificationError = error.message || 'Falha ao enviar notificacao WhatsApp.';
      console.error(`[printer] Falha ao notificar impressao ${printId}:`, notificationError);
    }
  }

  await printRef.set({
    status,
    printedAt: now,
    notifiedAt,
    notificationError,
    printedFilename: printedFilename || null,
    printCountedAt: data.printCountedAt || now,
    updatedAt: now,
  }, { merge: true });

  if (!data.printCountedAt) {
    await incrementPrintedCounters(data, now);
  }
}

async function resolvePrintFile(printDoc) {
  if (printDoc.file && printDoc.file.storagePath) {
    return printDoc.file;
  }

  if (!printDoc.imageId) {
    return null;
  }

  const imageSnap = await getEventRef()
    .collection('images')
    .doc(printDoc.imageId)
    .get();

  if (!imageSnap.exists) {
    return null;
  }

  const imageData = imageSnap.data();

  if (printDoc.type === 'main') {
    const main = imageData.outputs && imageData.outputs['01-figurinha-principal'];
    return main && main.files ? main.files.find((item) => item.type === 'print-png') : null;
  }

  return imageData.stickerSheet || null;
}

async function incrementPrintedCounters(data, now) {
  const cleanType = data.type === 'main' ? 'main' : 'stickers';
  const key = cleanType === 'main' ? 'mainPrinted' : 'stickersPrinted';
  const printStats = {
    totalPrinted: FieldValue.increment(1),
  };
  printStats[key] = FieldValue.increment(1);

  const writes = [
    getEventRef().set({
      updatedAt: now,
      stats: {
        printCompleted: FieldValue.increment(1),
        prints: printStats,
      },
    }, { merge: true }),
  ];

  if (data.profileId) {
    writes.push(getEventRef()
      .collection('profiles')
      .doc(data.profileId)
      .set({
        updatedAt: now,
        stats: {
          prints: printStats,
        },
      }, { merge: true }));
  }

  await Promise.all(writes);
}

async function findPrintRefByFilename(filename) {
  const byFilename = await getEventRef()
    .collection('prints')
    .where('pendingFilename', '==', filename)
    .limit(1)
    .get();

  if (!byFilename.empty) {
    return byFilename.docs[0].ref;
  }

  const printId = inferPrintIdFromFilename(filename);

  if (!printId) {
    return null;
  }

  return getEventRef().collection('prints').doc(printId);
}

async function downloadPublicFile(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Falha ao baixar arquivo para impressao: HTTP ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function getParticipantAddress(data = {}) {
  const profile = data.profile || {};

  return profile.whatsAppAddress || profile.phoneNumber || '';
}

function inferPrintIdFromFilename(filename) {
  const text = String(filename || '');

  if (text.endsWith(`-${STICKER_SHEET_FILENAME}`)) {
    return text.slice(0, -1 * (`-${STICKER_SHEET_FILENAME}`).length);
  }

  return '';
}

function sanitizeFilename(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180) || `print-${Date.now()}.png`;
}

function cmToPoints(value) {
  return value * 28.3465;
}

function readBooleanEnv(name, fallback) {
  const raw = process.env[name];

  if (raw === undefined || raw === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(raw).toLowerCase());
}

function publicError(error) {
  return {
    code: error.code || 'print_error',
    message: error.message || 'Falha de impressao.',
  };
}

module.exports = {
  PENDING_DIR,
  PRINTED_DIR,
  ensurePrintDirectories,
  markPrintDocumentStatus,
  notifyPrintedFile,
  syncPrintQueueToLocalPending,
};
