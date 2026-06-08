const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const {
  FieldValue,
  Timestamp,
  getEventId,
  getEventRef,
  isFirebaseConfigured,
  uploadFileToStorage,
} = require('./firebaseAdmin');
const {
  MAIN_IMAGE_ID,
  IMAGE_SPECS,
  buildPromptForSpec,
  getImageSpecSummaries,
} = require('./worldCupImagePrompts');
const {
  runWithTwilioConfig,
  sendWhatsAppMedia,
  toWhatsAppAddress,
} = require('./twilioWhatsApp');

const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');
const GENERATED_ROOT = path.resolve(__dirname, '..', '..', 'public', 'generated');
const MAIN_CARD_BACKGROUND_IMAGE_PATH = process.env.MAIN_CARD_BACKGROUND_IMAGE_PATH
  || path.join(SERVER_ROOT, 'assets', 'background.png');
const MAIN_CARD_OVERLAY_PATH = process.env.MAIN_CARD_OVERLAY_PATH
  || path.join(SERVER_ROOT, 'assets', 'mask.png');
const PRINT_QUEUE_ROOT = process.env.PRINT_QUEUE_ROOT || path.join(PROJECT_ROOT, 'scripts');
const PRINT_QUEUE_PENDING_ROOT = process.env.PRINT_QUEUE_PENDING_ROOT || path.join(PRINT_QUEUE_ROOT, 'pending');
const PRINT_QUEUE_PRINTED_ROOT = process.env.PRINT_QUEUE_PRINTED_ROOT || path.join(PRINT_QUEUE_ROOT, 'printed');
const MAIN_PRINT_SIZE = {
  width: 1181,
  height: 1772,
  density: 300,
};
const STICKER_SHEET_SIZE = {
  width: 1050,
  height: 1800,
  density: 300,
};
const STICKER_SHEET_HEADER = {
  left: 54,
  top: 34,
  height: 112,
  gap: 34,
};
const STICKER_SHEET_FILENAME = 'figurinhas-grid-3-5x6.png';
const STICKER_SHEET_SPEC_IDS = [
  '02-grito-de-gol',
  '03-sufoco-dos-penaltis',
  '04-pedindo-o-var',
  '06-hexa-vem',
  '07-cartao-vermelho',
  '10-hexa',
  '11-goooooool',
  '08-tristeza-pos-jogo',
];
const SMALL_PNG_SIZE = 1024;
const SMALL_WEBP_SIZE = 512;
const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5';
const OPENAI_IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'high';
const OPENAI_IMAGE_SIZE_MAIN = process.env.OPENAI_IMAGE_SIZE_MAIN || '1024x1536';
const OPENAI_IMAGE_SIZE_STICKER = process.env.OPENAI_IMAGE_SIZE_STICKER || '1024x1024';
const OPENAI_SOURCE_IMAGE_MAX_SIZE = readIntegerEnv('OPENAI_SOURCE_IMAGE_MAX_SIZE', 1024, 320, 1600);
const OPENAI_SOURCE_IMAGE_QUALITY = readIntegerEnv('OPENAI_SOURCE_IMAGE_QUALITY', 82, 60, 95);
const DEFAULT_AUTO_PRINT_ON_GENERATION = readBooleanEnv('PHOTOBOOTH_AUTO_PRINT_ON_GENERATION', false);
const OPTIMIZED_SOURCE_FILENAME = 'source-openai.jpg';
const SECONDARY_SOURCE_FILENAME = 'source-secondary.png';
const MAIN_SUBJECT_FILENAME = '01-figurinha-principal-subject.png';
const MAIN_CARD_COMPOSITION_ENV = readJsonEnv('MAIN_CARD_COMPOSITION');
const MAIN_COMPOSITE_ENV_DEFAULTS = {
  background: process.env.MAIN_CARD_BACKGROUND || MAIN_CARD_COMPOSITION_ENV.background || '#000d25',
  imageLeft: readIntegerEnv('MAIN_CARD_IMAGE_LEFT', readIntegerValue(MAIN_CARD_COMPOSITION_ENV.imageLeft, 90, -1000, 3000), -1000, 3000),
  imageTop: readIntegerEnv('MAIN_CARD_IMAGE_TOP', readIntegerValue(MAIN_CARD_COMPOSITION_ENV.imageTop, 82, -1000, 3000), -1000, 3000),
  imageWidth: readIntegerEnv('MAIN_CARD_IMAGE_WIDTH', readIntegerValue(MAIN_CARD_COMPOSITION_ENV.imageWidth, 990, 100, 3000), 100, 3000),
  imageHeight: readIntegerEnv('MAIN_CARD_IMAGE_HEIGHT', readIntegerValue(MAIN_CARD_COMPOSITION_ENV.imageHeight, 1485, 100, 4000), 100, 4000),
  imageFit: normalizeFit(process.env.MAIN_CARD_IMAGE_FIT || MAIN_CARD_COMPOSITION_ENV.imageFit || 'contain'),
};

async function generateWorldCupImages({
  sourceImage,
  params = {},
  queueStickerSheet = true,
}) {
  const source = parseImageDataUrl(sourceImage);
  const optimizedSource = await optimizeSourceForOpenAI(source.buffer);

  const runId = createRunId(params.participantName);
  const outputDir = path.join(GENERATED_ROOT, runId);
  await fs.mkdir(outputDir, { recursive: true });

  await saveSourceImagesIfNeeded({
    outputDir,
    sourceBuffer: source.buffer,
    optimizedSourceBuffer: optimizedSource.buffer,
  });

  const provider = createImageProvider({
    sourceBuffer: optimizedSource.buffer,
    sourceMimeType: optimizedSource.mimeType,
    params,
  });
  const mainSpec = getMainImageSpec();
  const secondarySpecs = IMAGE_SPECS.filter((spec) => spec.id !== mainSpec.id);
  const mainOutput = await generateAndSaveImage({
    provider,
    outputDir,
    spec: mainSpec,
    params,
    runId,
    queueStickerSheet,
  });
  const secondarySource = await loadSecondarySourceFromRun(outputDir);
  const secondaryProvider = createImageProvider({
    sourceBuffer: secondarySource.buffer,
    sourceMimeType: secondarySource.mimeType,
    params,
  });
  const secondaryOutputs = await Promise.all(secondarySpecs.map((spec) => generateAndSaveImage({
    provider: secondaryProvider,
    outputDir,
    spec,
    params,
    runId,
    queueStickerSheet,
  })));

  return {
    runId,
    mode: provider.mode,
    source: `/generated/${runId}/source.png`,
    outputs: [mainOutput, ...secondaryOutputs],
  };
}

async function generateWorldCupImage({
  sourceImage,
  params = {},
  specId,
  runId,
  queueStickerSheet = true,
}) {
  const spec = findImageSpec(specId);
  const requestedRunId = normalizeRunId(runId);
  const safeRunId = requestedRunId || createRunId(params.participantName);
  const outputDir = path.join(GENERATED_ROOT, safeRunId);

  if (!sourceImage && !requestedRunId) {
    throw clientError('missing_source_image', 'Envie uma imagem base para iniciar a geracao.');
  }

  await fs.mkdir(outputDir, { recursive: true });

  const source = sourceImage ? parseImageDataUrl(sourceImage) : null;
  const optimizedSource = source
    ? await optimizeSourceForOpenAI(source.buffer)
    : await loadSecondarySourceFromRun(outputDir);

  if (source) {
    await saveSourceImagesIfNeeded({
      outputDir,
      sourceBuffer: source.buffer,
      optimizedSourceBuffer: optimizedSource.buffer,
    });
  }

  const provider = createImageProvider({
    sourceBuffer: optimizedSource.buffer,
    sourceMimeType: optimizedSource.mimeType,
    params,
  });

  return {
    runId: safeRunId,
    mode: provider.mode,
    source: `/generated/${safeRunId}/source.png`,
    output: await generateAndSaveImage({
      provider,
    outputDir,
    spec,
    params,
    runId: safeRunId,
    queueStickerSheet,
  }),
  };
}

async function clearGeneratedImages() {
  await fs.mkdir(GENERATED_ROOT, { recursive: true });

  const entries = await fs.readdir(GENERATED_ROOT);
  await Promise.all(entries.map((entry) => (
    fs.rm(path.join(GENERATED_ROOT, entry), {
      recursive: true,
      force: true,
    })
  )));

  return {
    deletedEntries: entries.length,
    generatedDir: path.relative(PROJECT_ROOT, GENERATED_ROOT),
  };
}

async function persistGeneratorImageResult({
  result,
  params = {},
  durationMs = null,
}) {
  if (!isFirebaseConfigured() || !result || !result.runId) {
    return {
      persisted: false,
      reason: isFirebaseConfigured() ? 'missing-result' : 'firebase-not-configured',
    };
  }

  const runId = normalizeRunId(result.runId);

  if (!runId) {
    return {
      persisted: false,
      reason: 'invalid-run-id',
    };
  }

  const imageId = `generator-${runId}`;
  const imageRef = getEventRef().collection('images').doc(imageId);
  const imageSnap = await imageRef.get();
  const isNew = !imageSnap.exists;
  const now = Timestamp.now();
  const outputDir = path.join(GENERATED_ROOT, runId);
  const outputs = normalizeResultOutputs(result);
  const uploadedOutputs = {};
  let stickerSheet = null;

  for (const output of outputs) {
    const uploadedFiles = [];

    for (const file of output.files || []) {
      const localPath = path.join(outputDir, file.name);

      try {
        await fs.access(localPath);
      } catch (error) {
        uploadedFiles.push(file);
        continue;
      }

      const upload = await uploadFileToStorage({
        localPath,
        destination: `images/${imageId}/generated/${file.name}`,
        contentType: contentTypeForGeneratedFile(file),
        metadata: {
          imageId,
          outputId: output.id,
          fileType: file.type || '',
          source: 'generator',
        },
      });

      const uploadedFile = {
        ...file,
        ...upload,
      };

      if (file.type === 'sticker-sheet') {
        stickerSheet = uploadedFile;
      } else {
        uploadedFiles.push(uploadedFile);
      }
    }

    uploadedOutputs[output.id] = {
      id: output.id,
      title: output.title,
      kind: output.kind,
      status: 'ready',
      provider: output.provider || result.mode || '',
      prompt: output.prompt || '',
      files: uploadedFiles,
      updatedAt: now,
    };
  }

  const source = await buildGeneratorSourceRecord({
    imageId,
    runId,
    outputDir,
  });
  const cleanParams = sanitizeGeneratorParams(params);
  const profileName = cleanParams.participantName || 'Gerador';
  const payload = {
    imageId,
    runId,
    eventId: getEventId(),
    sourceType: 'generator',
    status: 'completed',
    accepted: true,
    profileId: '',
    profile: {
      profileName,
      phoneNumber: '',
      whatsAppAddress: '',
      waId: '',
    },
    params: cleanParams,
    generatedPublicPath: `/generated/${runId}/`,
    updatedAt: now,
    latestGeneratedAt: now,
    generation: {
      active: false,
      lastStatus: 'completed',
      lastTrigger: 'generator',
      lastRequestedBy: 'generator',
      lastCompletedAt: now,
    },
    outputs: uploadedOutputs,
  };

  if (isNew) {
    payload.createdAt = now;
  }

  if (durationMs !== null && Number.isFinite(Number(durationMs))) {
    payload.generation.lastDurationMs = Math.max(0, Number(durationMs));
  }

  if (source) {
    payload.source = source;
  }

  if (stickerSheet) {
    payload.stickerSheet = stickerSheet;
  }

  await imageRef.set(payload, { merge: true });

  if (isNew) {
    await getEventRef().set({
      updatedAt: now,
      stats: {
        photosGenerated: FieldValue.increment(1),
      },
    }, { merge: true });
  }

  await ensureGeneratorAutoPrintRequests({
    imageRef,
    imageId,
    imageData: payload,
    uploadedOutputs,
    stickerSheet,
    now,
  });

  return {
    persisted: true,
    imageId,
    isNew,
  };
}

async function ensureGeneratorAutoPrintRequests({
  imageRef,
  imageId,
  imageData,
  uploadedOutputs,
  stickerSheet,
  now,
}) {
  const printAutomation = await ensureEventPrintAutomationConfig();
  const tasks = [];

  if (printAutomation.autoPrintMainOnReady) {
    const mainOutput = uploadedOutputs[MAIN_IMAGE_ID]
      || Object.values(uploadedOutputs).find((output) => output && output.kind === 'main')
      || null;
    const mainFile = mainOutput && Array.isArray(mainOutput.files)
      ? mainOutput.files.find((file) => file && file.type === 'print-png')
      : null;

    if (mainFile) {
      tasks.push(createGeneratorPrintRequest({
        imageRef,
        imageId,
        imageData,
        type: 'main',
        source: 'generator-automatic-main',
        file: mainFile,
        now,
      }));
    }
  }

  if (printAutomation.autoPrintStickerSheetOnReady && stickerSheet) {
    tasks.push(createGeneratorPrintRequest({
      imageRef,
      imageId,
      imageData,
      type: 'stickers',
      source: 'generator-automatic-stickers',
      file: stickerSheet,
      now,
    }));
  }

  if (printAutomation.autoSendStickerSheetPackOnReady && stickerSheet) {
    tasks.push(sendGeneratorStickerSheetPackByWhatsApp({
      imageRef,
      imageData,
      stickerSheetFile: stickerSheet,
      printAutomation,
      now,
    }));
  }

  await Promise.all(tasks);
}

async function sendGeneratorStickerSheetPackByWhatsApp({
  imageRef,
  imageData = {},
  stickerSheetFile = {},
  printAutomation = {},
  now,
}) {
  const destination = normalizeConfiguredWhatsAppNumber(printAutomation.stickerSheetPackWhatsAppTo);
  const mediaUrl = stickerSheetFile.signedUrl || stickerSheetFile.url || '';

  if (!destination || !mediaUrl) {
    return;
  }

  try {
    const twilioConfig = await loadCurrentEventTwilioConfig();
    const message = await runWithTwilioConfig(twilioConfig, () => sendWhatsAppMedia(destination, {
      body: buildStickerSheetPackMessage({
        imageData,
        mediaUrl,
      }),
      mediaUrl,
    }));

    await imageRef.set({
      updatedAt: now,
      stickerSheetPackDelivery: {
        status: 'sent',
        to: destination,
        messageSid: message.sid || '',
        mediaUrl,
        source: 'generator-sticker-pack',
        sentAt: now,
      },
    }, { merge: true });
  } catch (error) {
    console.error('[generator] failed to send sticker sheet pack', error);
    await imageRef.set({
      updatedAt: now,
      stickerSheetPackDelivery: {
        status: 'failed',
        to: destination,
        mediaUrl,
        source: 'generator-sticker-pack',
        error: publicError(error),
        failedAt: now,
      },
    }, { merge: true });
  }
}

async function loadCurrentEventTwilioConfig() {
  if (!isFirebaseConfigured()) {
    return {};
  }

  const snap = await getEventRef().get();
  const data = snap.exists ? snap.data() || {} : {};

  return data.twilio || {};
}

function normalizeConfiguredWhatsAppNumber(value) {
  const text = String(value || '').trim();

  return text ? toWhatsAppAddress(text) : '';
}

function buildStickerSheetPackMessage({
  imageData = {},
  mediaUrl = '',
}) {
  const profile = imageData.profile || {};
  const params = imageData.params || {};

  return [
    'Pack de stickers pronto para impressao.',
    `Nome: ${profile.profileName || params.participantName || '-'}`,
    `Telefone: ${profile.phoneNumber || params.participantPhone || params.phoneNumber || '-'}`,
    `Imagem: ${mediaUrl || '-'}`,
  ].join('\n');
}

function publicError(error) {
  return {
    code: error.code || 'sticker_pack_whatsapp_failed',
    message: error.publicMessage || error.message || 'Falha ao enviar pack de stickers por WhatsApp.',
  };
}

async function createGeneratorPrintRequest({
  imageRef,
  imageId,
  imageData,
  type,
  source,
  file,
  now,
}) {
  const cleanType = type === 'main' ? 'main' : 'stickers';
  const printId = `${imageId}_${cleanType}`;
  const printRef = getEventRef().collection('prints').doc(printId);
  const printSnap = await printRef.get();
  const isNew = !printSnap.exists;
  const pendingFilename = cleanType === 'stickers' && file && file.storagePath
    ? buildPrintPendingFilename(printId, file.storagePath, now)
    : null;
  const profile = imageData.profile || {};

  await printRef.set({
    printId,
    imageId,
    profileId: '',
    type: cleanType,
    mode: cleanType === 'main' ? 'automatic' : 'manual-folder',
    profile: {
      phoneNumber: '',
      whatsAppAddress: '',
      profileName: profile.profileName || 'Gerador',
      waId: '',
    },
    file,
    status: file && file.storagePath ? 'pending' : 'waiting-file',
    pendingFilename,
    localPendingPath: null,
    queuedAt: null,
    source,
    requestedBy: 'generator',
    requestedAt: now,
    requestCount: FieldValue.increment(1),
    printedAt: null,
    notifiedAt: null,
    notificationError: null,
    printedFilename: null,
    printCountedAt: null,
    updatedAt: now,
  }, { merge: true });

  await imageRef.set({
    updatedAt: now,
    prints: {
      [cleanType]: {
        printId,
        status: file && file.storagePath ? 'pending' : 'waiting-file',
        requestedAt: now,
        requestCount: FieldValue.increment(1),
      },
    },
  }, { merge: true });

  if (isNew) {
    const printStats = {
      totalRequested: FieldValue.increment(1),
    };
    printStats[cleanType === 'main' ? 'mainRequested' : 'stickersRequested'] = FieldValue.increment(1);

    await getEventRef().set({
      updatedAt: now,
      stats: {
        printRequested: FieldValue.increment(1),
        prints: printStats,
      },
    }, { merge: true });
  }
}

async function saveSourceImagesIfNeeded({
  outputDir,
  sourceBuffer,
  optimizedSourceBuffer,
}) {
  const sourcePath = path.join(outputDir, 'source.png');
  const optimizedSourcePath = path.join(outputDir, OPTIMIZED_SOURCE_FILENAME);

  try {
    await fs.access(sourcePath);
  } catch (error) {
    await sharp(sourceBuffer).rotate().png({ compressionLevel: 9 }).toFile(sourcePath);
  }

  try {
    await fs.access(optimizedSourcePath);
  } catch (error) {
    await fs.writeFile(optimizedSourcePath, optimizedSourceBuffer);
  }
}

function withPublicFileUrls(output, runId) {
  return {
    ...output,
    files: output.files.map((file) => ({
      ...file,
      url: `/generated/${runId}/${file.name}`,
    })),
  };
}

function normalizeResultOutputs(result = {}) {
  if (Array.isArray(result.outputs)) {
    return result.outputs;
  }

  if (result.output) {
    return [result.output];
  }

  return [];
}

async function buildGeneratorSourceRecord({
  imageId,
  runId,
  outputDir,
}) {
  const sourcePath = path.join(outputDir, 'source.png');
  const optimizedPath = path.join(outputDir, OPTIMIZED_SOURCE_FILENAME);
  const source = {};

  try {
    await fs.access(sourcePath);
    const upload = await uploadFileToStorage({
      localPath: sourcePath,
      destination: `images/${imageId}/source/source.png`,
      contentType: 'image/png',
      metadata: {
        imageId,
        source: 'generator',
      },
    });

    source.originalLocalPath = path.relative(PROJECT_ROOT, sourcePath);
    source.originalUrl = `/generated/${runId}/source.png`;
    source.originalStorage = upload;
  } catch (error) {
    // Source is optional for resumed generator runs created before persistence existed.
  }

  try {
    await fs.access(optimizedPath);
    const upload = await uploadFileToStorage({
      localPath: optimizedPath,
      destination: `images/${imageId}/source/${OPTIMIZED_SOURCE_FILENAME}`,
      contentType: 'image/jpeg',
      metadata: {
        imageId,
        source: 'generator',
        optimizedFor: 'openai-images',
      },
    });

    source.optimizedLocalPath = path.relative(PROJECT_ROOT, optimizedPath);
    source.optimizedUrl = `/generated/${runId}/${OPTIMIZED_SOURCE_FILENAME}`;
    source.optimizedStorage = upload;
  } catch (error) {
    // Optimized source is optional when only generated outputs are available.
  }

  return Object.keys(source).length ? source : null;
}

function sanitizeGeneratorParams(params = {}) {
  const output = {};

  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null) {
      continue;
    }

    const text = String(value).trim();

    if (text) {
      output[key] = text;
    }
  }

  return output;
}

function contentTypeForGeneratedFile(file = {}) {
  if (file.type === 'webp' || String(file.name || '').endsWith('.webp')) {
    return 'image/webp';
  }

  if (String(file.name || '').endsWith('.jpg') || String(file.name || '').endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  return 'image/png';
}

async function generateAndSaveImage({
  provider,
  outputDir,
  spec,
  params,
  runId,
  queueStickerSheet = true,
}) {
  const prompt = buildPromptForSpec(spec, params);
  const generated = await provider.generate({
    spec,
    prompt,
  });
  const saved = await saveGeneratedImage({
    outputDir,
    spec,
    imageBuffer: generated.buffer,
    params,
    queueStickerSheet,
  });

  return withPublicFileUrls({
    id: spec.id,
    title: spec.title,
    kind: spec.kind,
    prompt,
    provider: generated.provider,
    files: saved,
  }, runId);
}

async function saveGeneratedImage({
  outputDir,
  spec,
  imageBuffer,
  params,
  queueStickerSheet = true,
}) {
  if (spec.kind === 'main') {
    return saveMainCompositeImage({
      outputDir,
      spec,
      imageBuffer,
      params,
    });
  }

  const pngName = `${spec.filename}.png`;
  const webpName = `${spec.filename}.webp`;
  const stickerPng = await createStickerPngBuffer({
    imageBuffer,
    spec,
  });

  await fs.writeFile(path.join(outputDir, pngName), stickerPng);

  await sharp(stickerPng)
    .resize(SMALL_WEBP_SIZE, SMALL_WEBP_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90 })
    .toFile(path.join(outputDir, webpName));

  const files = [
    {
      type: 'png',
      name: pngName,
      width: SMALL_PNG_SIZE,
      height: SMALL_PNG_SIZE,
    },
    {
      type: 'webp',
      name: webpName,
      width: SMALL_WEBP_SIZE,
      height: SMALL_WEBP_SIZE,
    },
  ];
  const stickerSheet = await createStickerSheetIfReady(outputDir, {
    params,
    queueStickerSheet,
  });

  if (stickerSheet) {
    files.push(stickerSheet);
  }

  return files;
}

async function createStickerPngBuffer({
  imageBuffer,
  spec,
}) {
  const base = await sharp(imageBuffer)
    .rotate()
    .resize(SMALL_PNG_SIZE, SMALL_PNG_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return base;
}

async function createStickerSheetIfReady(outputDir, {
  params = {},
  queueStickerSheet = true,
} = {}) {
  const stickerSpecs = STICKER_SHEET_SPEC_IDS
    .map((id) => IMAGE_SPECS.find((spec) => spec.id === id))
    .filter(Boolean);
  const stickerPaths = stickerSpecs.map((spec) => path.join(outputDir, `${spec.filename}.png`));

  try {
    await Promise.all(stickerPaths.map((filePath) => fs.access(filePath)));
  } catch (error) {
    return null;
  }

  const columns = 2;
  const rows = Math.ceil(stickerSpecs.length / columns);
  const margin = 54;
  const gridTop = STICKER_SHEET_HEADER.top + STICKER_SHEET_HEADER.height + STICKER_SHEET_HEADER.gap;
  const columnGap = 34;
  const rowGap = 28;
  const cellWidth = (STICKER_SHEET_SIZE.width - margin * 2 - columnGap * (columns - 1)) / columns;
  const cellHeight = (STICKER_SHEET_SIZE.height - gridTop - margin - rowGap * (rows - 1)) / rows;
  const imageSize = Math.floor(Math.min(cellWidth, cellHeight) * 0.98);
  const headerLayer = createStickerSheetHeaderLayer(params);
  const stickerLayers = await Promise.all(stickerPaths.map(async (filePath, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = Math.round(margin + column * (cellWidth + columnGap) + (cellWidth - imageSize) / 2);
    const top = Math.round(gridTop + row * (cellHeight + rowGap) + (cellHeight - imageSize) / 2);
    const input = await sharp(filePath)
      .resize(imageSize, imageSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    return {
      input,
      left,
      top,
      blend: 'over',
    };
  }));
  const sheetPath = path.join(outputDir, STICKER_SHEET_FILENAME);

  await sharp({
    create: {
      width: STICKER_SHEET_SIZE.width,
      height: STICKER_SHEET_SIZE.height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([headerLayer, ...stickerLayers])
    .withMetadata({ density: STICKER_SHEET_SIZE.density })
    .png({ compressionLevel: 9 })
    .toFile(sheetPath);

  const printQueue = queueStickerSheet
    ? await copyStickerSheetToPendingQueue({
      outputDir,
      sheetPath,
    })
    : {
      queued: false,
      reason: 'queue-disabled',
    };

  return {
    type: 'sticker-sheet-3.5x6',
    name: STICKER_SHEET_FILENAME,
    width: STICKER_SHEET_SIZE.width,
    height: STICKER_SHEET_SIZE.height,
    density: STICKER_SHEET_SIZE.density,
    printQueue,
  };
}

function createStickerSheetHeaderLayer(params = {}) {
  const width = STICKER_SHEET_SIZE.width - STICKER_SHEET_HEADER.left * 2;
  const name = truncateLabel(normalizeHeaderText(
    params.participantName || params.profileName,
    'Participante',
  ), 36);
  const phone = getMaskedParticipantPhone(params);
  const phoneLabel = phone || 'Telefone nao informado';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${STICKER_SHEET_HEADER.height}" viewBox="0 0 ${width} ${STICKER_SHEET_HEADER.height}">
      <rect x="0" y="0" width="${width}" height="${STICKER_SHEET_HEADER.height}" rx="0" fill="#b8f36b"/>
      <text x="${width / 2}" y="46" fill="#000000" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" text-anchor="middle">${escapeXml(name)}</text>
      <text x="${width / 2}" y="84" fill="#000000" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" text-anchor="middle">${escapeXml(phoneLabel)}</text>
    </svg>
  `;

  return {
    input: Buffer.from(svg),
    left: STICKER_SHEET_HEADER.left,
    top: STICKER_SHEET_HEADER.top,
    blend: 'over',
  };
}

function truncateLabel(value, maxLength) {
  const text = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function maskParticipantPhone(value) {
  const text = normalizePhoneForHeader(value);

  if (!text) {
    return '';
  }

  return `${text.slice(0, -8)}****-${text.slice(-4)}`;
}

function getMaskedParticipantPhone(params = {}) {
  const candidates = [
    params.phoneNumber,
    params.participantPhone,
    params.whatsAppAddress,
    params.waId,
    params.from,
  ];

  for (const candidate of candidates) {
    const masked = maskParticipantPhone(candidate);

    if (masked) {
      return masked;
    }
  }

  return '';
}

function normalizePhoneForHeader(value) {
  const raw = String(value || '')
    .trim()
    .replace(/^whatsapp:/i, '');

  if (!raw || /^[a-f0-9]{32}$/i.test(raw)) {
    return '';
  }

  const digits = raw.replace(/\D/g, '');

  if (digits.length < 9) {
    return '';
  }

  return raw.startsWith('+') ? `+${digits}` : digits;
}

function normalizeHeaderText(value, fallback) {
  const text = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .'-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!/[A-Za-z0-9]/.test(text)) {
    return fallback;
  }

  return text;
}

async function ensureStickerSheetForRun(runId, {
  params = {},
  queueStickerSheet = true,
} = {}) {
  const outputDir = getGeneratedRunDirectory(runId);
  const stickerSheet = await createStickerSheetIfReady(outputDir, {
    params,
    queueStickerSheet,
  });

  if (!stickerSheet) {
    throw clientError('sticker_sheet_not_ready', 'Grid de figurinhas ainda nao esta pronto.');
  }

  return withPublicFileUrls({
    id: 'sticker-sheet',
    title: 'Sticker Sheet',
    kind: 'sheet',
    prompt: '',
    provider: 'sharp',
    files: [stickerSheet],
  }, runId).files[0];
}

async function copyStickerSheetToPendingQueue({
  outputDir,
  sheetPath,
}) {
  const runId = path.basename(outputDir);
  const pendingName = `${runId}-${STICKER_SHEET_FILENAME}`;
  const pendingPath = path.join(PRINT_QUEUE_PENDING_ROOT, pendingName);
  const markerPath = path.join(outputDir, `${STICKER_SHEET_FILENAME}.queued`);

  try {
    await fs.access(markerPath);
    return {
      pendingName,
      queued: false,
      reason: 'already-queued',
    };
  } catch (error) {
    // The grid has not entered the local print queue for this run yet.
  }

  await fs.mkdir(PRINT_QUEUE_PENDING_ROOT, { recursive: true });
  await fs.copyFile(sheetPath, pendingPath);
  await fs.writeFile(markerPath, `${new Date().toISOString()}\n${pendingName}\n`);

  return {
    pendingName,
    queued: true,
  };
}

async function saveMainCompositeImage({
  outputDir,
  spec,
  imageBuffer,
  params,
}) {
  const layout = await getMainCompositeLayout(params);
  const name = `${spec.filename}.png`;
  const filePath = path.join(outputDir, name);
  const subjectPath = path.join(outputDir, MAIN_SUBJECT_FILENAME);
  const secondarySourcePath = path.join(outputDir, SECONDARY_SOURCE_FILENAME);
  const cardBackground = await sharp(MAIN_CARD_BACKGROUND_IMAGE_PATH)
    .resize(MAIN_PRINT_SIZE.width, MAIN_PRINT_SIZE.height, {
      fit: 'fill',
    })
    .png()
    .toBuffer();
  const overlay = await sharp(MAIN_CARD_OVERLAY_PATH)
    .resize(MAIN_PRINT_SIZE.width, MAIN_PRINT_SIZE.height, {
      fit: 'fill',
    })
    .png()
    .toBuffer();
  const subject = await sharp(imageBuffer)
    .rotate()
    .resize(layout.imageWidth, layout.imageHeight, {
      fit: layout.imageFit,
      position: 'center',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await fs.writeFile(subjectPath, subject);

  await sharp(imageBuffer)
    .rotate()
    .resize(OPENAI_SOURCE_IMAGE_MAX_SIZE, OPENAI_SOURCE_IMAGE_MAX_SIZE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9 })
    .toFile(secondarySourcePath);

  await sharp({
    create: {
      width: MAIN_PRINT_SIZE.width,
      height: MAIN_PRINT_SIZE.height,
      channels: 4,
      background: layout.background,
    },
  })
    .composite([
      {
        input: cardBackground,
        left: 0,
        top: 0,
        blend: 'over',
      },
      {
        input: subject,
        left: layout.imageLeft,
        top: layout.imageTop,
        blend: 'over',
      },
      {
        input: overlay,
        left: 0,
        top: 0,
        blend: 'over',
      },
    ])
    .withMetadata({ density: MAIN_PRINT_SIZE.density })
    .png({ compressionLevel: 9 })
    .toFile(filePath);

  return [
    {
      type: 'print-png',
      name,
      width: MAIN_PRINT_SIZE.width,
      height: MAIN_PRINT_SIZE.height,
      density: MAIN_PRINT_SIZE.density,
    },
    {
      type: 'subject-png',
      name: MAIN_SUBJECT_FILENAME,
      width: layout.imageWidth,
      height: layout.imageHeight,
    },
  ];
}

async function composeMainCardFromSubject({
  subjectBuffer,
  composition = {},
}) {
  const layout = await getMainCompositeLayout(composition);
  const cardBackground = await sharp(MAIN_CARD_BACKGROUND_IMAGE_PATH)
    .resize(MAIN_PRINT_SIZE.width, MAIN_PRINT_SIZE.height, {
      fit: 'fill',
    })
    .png()
    .toBuffer();
  const overlay = await sharp(MAIN_CARD_OVERLAY_PATH)
    .resize(MAIN_PRINT_SIZE.width, MAIN_PRINT_SIZE.height, {
      fit: 'fill',
    })
    .png()
    .toBuffer();
  const subject = await sharp(subjectBuffer)
    .rotate()
    .resize(layout.imageWidth, layout.imageHeight, {
      fit: layout.imageFit,
      position: 'center',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const buffer = await sharp({
    create: {
      width: MAIN_PRINT_SIZE.width,
      height: MAIN_PRINT_SIZE.height,
      channels: 4,
      background: layout.background,
    },
  })
    .composite([
      {
        input: cardBackground,
        left: 0,
        top: 0,
        blend: 'over',
      },
      {
        input: subject,
        left: layout.imageLeft,
        top: layout.imageTop,
        blend: 'over',
      },
      {
        input: overlay,
        left: 0,
        top: 0,
        blend: 'over',
      },
    ])
    .withMetadata({ density: MAIN_PRINT_SIZE.density })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    buffer,
    layout,
  };
}

function createImageProvider({
  sourceBuffer,
  sourceMimeType,
  params,
}) {
  const mode = getImageGenerationMode();

  if (mode === 'mock') {
    return {
      mode: 'mock',
      generate: (request) => generatePlaceholder({
        ...request,
        sourceBuffer,
        sourceMimeType,
        params,
      }),
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    throw configurationError();
  }

  return {
    mode: 'openai',
    generate: (request) => generateWithOpenAI({
      ...request,
      sourceBuffer,
      sourceMimeType,
    }),
  };
}

function getImageGenerationMode() {
  return String(process.env.IMAGE_GENERATION_MODE || 'openai').trim().toLowerCase();
}

function getImageGenerationStatus() {
  const mode = getImageGenerationMode();

  return {
    mode,
    provider: mode === 'mock' ? 'placeholder' : 'openai',
    configured: mode === 'mock' || Boolean(process.env.OPENAI_API_KEY),
    imageApi: 'images.edit',
    imageModel: OPENAI_IMAGE_MODEL,
    imageQuality: OPENAI_IMAGE_QUALITY,
    sourceImageMaxSize: OPENAI_SOURCE_IMAGE_MAX_SIZE,
    sourceImageQuality: OPENAI_SOURCE_IMAGE_QUALITY,
    mainComposite: {
      backgroundImage: path.basename(MAIN_CARD_BACKGROUND_IMAGE_PATH),
      overlay: path.basename(MAIN_CARD_OVERLAY_PATH),
      ...MAIN_COMPOSITE_ENV_DEFAULTS,
    },
    stickerSheet: {
      filename: STICKER_SHEET_FILENAME,
      width: STICKER_SHEET_SIZE.width,
      height: STICKER_SHEET_SIZE.height,
      density: STICKER_SHEET_SIZE.density,
      columns: 2,
      items: STICKER_SHEET_SPEC_IDS.length,
    },
    printQueue: {
      pendingDir: path.relative(PROJECT_ROOT, PRINT_QUEUE_PENDING_ROOT),
      printedDir: path.relative(PROJECT_ROOT, PRINT_QUEUE_PRINTED_ROOT),
    },
  };
}

async function getMainCompositionConfig() {
  const config = await getMainCompositeDefaults();

  return {
    printSize: MAIN_PRINT_SIZE,
    backgroundImageUrl: '/api/photobooth/main-card-background',
    overlayImageUrl: '/api/photobooth/main-card-overlay',
    defaults: config.defaults,
    source: config.source,
    firestore: config.firestore,
  };
}

async function saveMainCompositionConfig(value = {}, updatedBy = 'generator') {
  if (!isFirebaseConfigured()) {
    throw serviceUnavailableError(
      'firebase_not_configured',
      'Firebase Admin nao configurado para salvar a composicao.',
    );
  }

  const defaults = normalizeMainComposition(value);
  const now = Timestamp.now();

  await getEventRef().set({
    eventId: getEventId(),
    mainComposition: defaults,
    mainCompositionUpdatedAt: now,
    mainCompositionUpdatedBy: updatedBy,
    updatedAt: now,
  }, { merge: true });

  return getMainCompositionConfig();
}

function getMainCompositionAssetPath(kind) {
  if (kind === 'background') {
    return MAIN_CARD_BACKGROUND_IMAGE_PATH;
  }

  if (kind === 'overlay') {
    return MAIN_CARD_OVERLAY_PATH;
  }

  throw clientError('invalid_main_card_asset', 'Asset da figurinha principal invalido.');
}

function getGeneratedRunDirectory(runId) {
  const safeRunId = normalizeRunId(runId);

  if (!safeRunId) {
    throw clientError('invalid_run_id', 'Run ID invalido.');
  }

  return path.join(GENERATED_ROOT, safeRunId);
}

function getGeneratedFilePath(runId, filename) {
  const cleanFilename = path.basename(String(filename || ''));

  if (!cleanFilename) {
    throw clientError('invalid_generated_file', 'Arquivo gerado invalido.');
  }

  return path.join(getGeneratedRunDirectory(runId), cleanFilename);
}

function configurationError() {
  const error = new Error('OPENAI_API_KEY is required for image generation.');
  error.statusCode = 503;
  error.code = 'openai_not_configured';
  error.publicMessage = 'OPENAI_API_KEY nao configurada. Defina a chave no ambiente ou use IMAGE_GENERATION_MODE=mock apenas para teste local.';
  return error;
}

async function generateWithOpenAI({
  spec,
  prompt,
  sourceBuffer,
  sourceMimeType,
}) {
  const { default: OpenAI, toFile } = await import('openai');
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const extension = getImageExtension(sourceMimeType);
  const imageFile = await toFile(sourceBuffer, `source.${extension}`, {
    type: sourceMimeType,
  });
  const request = {
    image: [imageFile],
    prompt: [
      prompt,
      'Output requirement: return a real PNG with a real transparent alpha channel.',
      'Identity preservation is the highest priority: preserve the source person face shape, apparent age, skin tone, nose, mouth, lips, teeth if visible, cheeks, eyes, eyebrows, hairline, hair, facial hair, expression, and unique facial features. Do not beautify, reshape, slim, age, de-age, symmetrize, or turn the person into a different face.',
      'For the main card image, the result must look like a real professional photograph, not CGI, not a 3D render, not an AI influencer portrait, not an illustration, and not airbrushed beauty retouching.',
      'Preserve the exact original hair color, roots, length, volume, texture, curls/waves/straightness, parting, flyaway hairs, haircut, and hairline. Do not restyle, recolor, smooth, add volume, or simplify the hair.',
      'Keep natural skin texture, subtle pores, expression lines, asymmetry, and real facial character. Avoid waxy or plastic skin, overly smooth faces, generic model faces, standardized expressions, and enlarged eyes.',
      'For the main card image, preserve the source expression, mouth shape, teeth, lips, cheeks, eyes, and facial proportions. Do not change the mouth, teeth, lips, cheeks, or eyes to make the person look happier, more posed, more commercial, or more generic.',
      'If the source image contains a clear foreground group, preserve the exact real people from the source with a maximum of three people. One source person means one output person; two source people means two output people; three source people means three output people. Never invent, duplicate, remove, merge, or add extra people.',
      'For every real person included, preserve each individual face separately. Avoid generic model faces, stock-photo faces, plastic skin, standardized expressions, enlarged eyes, or any face that would not be recognizable side by side with the original.',
      'Preserve all existing accessories exactly as they appear in the source image: same style, material, shape, size, color, and position. Do not restyle, recolor, simplify, remove, or replace real earrings, rings, bracelets, watches, necklaces, piercings, hats, or glasses.',
      'For the main card image, if the source person wears real glasses, preserve the exact glasses as identity-critical: frame shape, lens proportions, bridge, temples, thickness, transparent lenses, position on the face, and the exact color map of each frame part. If the glasses are bicolor, split-color, asymmetric, or have different colors on upper/lower rims, left/right sides, bridge, or temples, keep each part in its original color. Never convert bicolor glasses into a single-color frame, never remove dark/black sections, and never replace them with generic sporty glasses.',
      'Do not draw, simulate, or include a checkerboard/checkered transparency preview pattern.',
      'Do not include any background, backdrop, card frame, border, logo, watermark, or extra text.',
      'Use the same shirt pattern for every generated image: a plain generic Brazil soccer shirt with a yellow body, green V-neck collar, and green sleeve cuffs. The collar must be visibly V-shaped, not round.',
      'The shirt must be completely free of branding and numbers. Do not include Nike, swoosh marks, check marks, manufacturer logos, team crests, sponsor logos, CBF crests, stars, shields, letters, digits, jersey numbers, or any brand-like symbol on clothing.',
      'Even if the source image or form parameters include a jersey number, remove it and render plain yellow fabric instead. Do not add any number, digits, letters, text, badge, emblem, patch, or decorative symbol to the shirt.',
      'The Brazil shirt color rules apply only to clothing, never to real glasses. Do not recolor glasses to match the shirt or fan theme. If source glasses include black, dark, transparent, yellow, green, matte, glossy, or split-color areas, preserve each exact area from the source.',
      'Do not add wearable accessories such as glasses, sunglasses, hats, jewelry, watches, or bracelets unless they are clearly visible in the source image or explicitly required by the prompt.',
      'If glasses are not clearly visible on the source face, assume the person does not wear glasses. For the main card and every generated image, keep eyes, eyebrows, nose bridge, and face sides free of frames, lenses, temples, lens reflections, or glasses shadows. Do not invent glasses for styling, sports theme, fan theme, or card aesthetics. The only exception for creating new glasses is the specific sticker titled "O Hexa Vem".',
      'For the sticker titled "Pedindo o VAR", the goal frame must be only the flat front face: exactly three simple straight segments, left vertical post, right vertical post, and top horizontal crossbar. Do not draw a back frame, depth, perspective, 3D thickness, parallel outlines, bottom line, net, mesh, grid, internal lines, rear bars, side bars, or any second frame. The person must face the camera frontally: the person right hand appears on the viewer-left side and points to the lower-left end of the goal frame; the person left hand appears on the viewer-right side and points to the lower-right end of the goal frame. The goal frame must be high above the head and shoulders. Each vertical post must start exactly at the corresponding index fingertip and extend upward from that fingertip to the crossbar; do not draw any post segment below the fingertips and do not place the goal frame low around the chest, waist, or hands.',
      'When the prompt requires visible text, render only the exact requested text. Do not add extra letters, numbers, punctuation, symbols, duplicated words, banners, or text-like decorative shapes.',
      'Any visible human left hand and right hand must each have exactly five total fingers, never six; no extra, duplicated, fused, repeated, or malformed fingers.',
      'The person, clothing, face, hair, hands, and objects must be fully opaque and colorful; only the empty background may be transparent.',
    ].join('\n\n'),
    size: spec.kind === 'main' ? OPENAI_IMAGE_SIZE_MAIN : OPENAI_IMAGE_SIZE_STICKER,
    model: OPENAI_IMAGE_MODEL,
    background: 'transparent',
    output_format: 'png',
    quality: OPENAI_IMAGE_QUALITY,
  };

  if (OPENAI_IMAGE_MODEL === 'gpt-image-1') {
    request.input_fidelity = 'high';
  }

  const payload = await client.images.edit(request);
  const imageOutput = payload.data && payload.data[0] && payload.data[0].b64_json;

  if (!imageOutput) {
    const error = new Error('OpenAI response did not include image data.');
    error.statusCode = 502;
    error.publicMessage = 'O provider de IA nao retornou imagem.';
    throw error;
  }

  return {
    provider: 'openai',
    buffer: Buffer.from(imageOutput, 'base64'),
  };
}

async function generatePlaceholder({
  spec,
  prompt,
  sourceBuffer,
  params,
}) {
  const size = spec.kind === 'main'
    ? { width: 1024, height: 1536 }
    : { width: 1024, height: 1024 };
  const palette = getPalette(spec.id);
  const base = await sharp(sourceBuffer)
    .rotate()
    .resize(Math.round(size.width * 0.78), Math.round(size.height * 0.55), {
      fit: 'cover',
      position: 'center',
    })
    .png()
    .toBuffer();
  const svg = Buffer.from(createPlaceholderSvg({
    spec,
    params,
    prompt,
    width: size.width,
    height: size.height,
    palette,
  }));

  const composite = spec.kind === 'main'
    ? [
      { input: base, left: Math.round(size.width * 0.11), top: Math.round(size.height * 0.17) },
    ]
    : [
      { input: base, left: Math.round(size.width * 0.11), top: Math.round(size.height * 0.22) },
      { input: svg, left: 0, top: 0 },
    ];

  const image = await sharp({
    create: {
      width: size.width,
      height: size.height,
      channels: 4,
      background: spec.transparent || spec.kind === 'main'
        ? { r: 0, g: 0, b: 0, alpha: 0 }
        : palette.background,
    },
  })
    .composite(composite)
    .png()
    .toBuffer();

  return {
    provider: 'placeholder',
    buffer: image,
  };
}

function createPlaceholderSvg({
  spec,
  params,
  prompt,
  width,
  height,
  palette,
}) {
  const isMain = spec.kind === 'main';
  const name = escapeXml(params.participantName || 'Participante');
  const subtitle = isMain
    ? escapeXml(params.position || 'Craque')
    : escapeXml(spec.title);
  const promptHint = escapeXml(prompt.slice(0, 82));
  const border = isMain ? 28 : 18;
  const titleY = isMain ? height - 250 : height - 168;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${border}" y="${border}" width="${width - border * 2}" height="${height - border * 2}" rx="${isMain ? 56 : 90}" fill="none" stroke="${palette.accent}" stroke-width="${isMain ? 16 : 12}"/>
      <rect x="${border + 22}" y="${border + 22}" width="${width - (border + 22) * 2}" height="${height - (border + 22) * 2}" rx="${isMain ? 40 : 72}" fill="none" stroke="#ffffff" stroke-width="8" stroke-opacity="0.9"/>
      <rect x="${Math.round(width * 0.09)}" y="${titleY}" width="${Math.round(width * 0.82)}" height="${isMain ? 170 : 112}" rx="24" fill="${palette.panel}" fill-opacity="0.95"/>
      <text x="${width / 2}" y="${titleY + (isMain ? 68 : 46)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${isMain ? 58 : 42}" font-weight="900" fill="#ffffff">${escapeXml(isMain ? name : spec.title)}</text>
      <text x="${width / 2}" y="${titleY + (isMain ? 124 : 86)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${isMain ? 34 : 24}" font-weight="800" fill="${palette.accent}">${subtitle}</text>
      <text x="${width / 2}" y="${height - 48}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#ffffff" fill-opacity="0.78">${promptHint}</text>
      <circle cx="${Math.round(width * 0.86)}" cy="${Math.round(height * 0.12)}" r="${isMain ? 64 : 52}" fill="${palette.accent}"/>
      <text x="${Math.round(width * 0.86)}" y="${Math.round(height * 0.12) + 14}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${isMain ? 34 : 28}" font-weight="900" fill="#102018">${isMain ? '10x15' : '512'}</text>
    </svg>
  `;
}

function parseImageDataUrl(value) {
  if (typeof value !== 'string') {
    throw clientError('invalid_source_image', 'Envie uma imagem base.');
  }

  const match = value.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/);

  if (!match) {
    throw clientError('invalid_source_image_format', 'Use uma imagem JPEG, PNG ou WebP em data URL.');
  }

  const buffer = Buffer.from(match[2], 'base64');

  if (!buffer.length || buffer.length > MAX_SOURCE_IMAGE_BYTES) {
    throw clientError('invalid_source_image_size', 'A imagem base precisa ter ate 20 MB.');
  }

  return {
    buffer,
    mimeType: match[1] === 'image/jpg' ? 'image/jpeg' : match[1],
    dataUrl: value.replace(/^data:image\/jpg;/, 'data:image/jpeg;'),
  };
}

async function optimizeSourceForOpenAI(buffer) {
  try {
    const optimizedBuffer = await sharp(buffer)
      .rotate()
      .resize(OPENAI_SOURCE_IMAGE_MAX_SIZE, OPENAI_SOURCE_IMAGE_MAX_SIZE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({
        quality: OPENAI_SOURCE_IMAGE_QUALITY,
        mozjpeg: true,
      })
      .toBuffer();

    return {
      buffer: optimizedBuffer,
      mimeType: 'image/jpeg',
      dataUrl: `data:image/jpeg;base64,${optimizedBuffer.toString('base64')}`,
    };
  } catch (error) {
    throw clientError('unreadable_source_image', 'Nao foi possivel ler a imagem base.');
  }
}

async function loadSecondarySourceFromRun(outputDir) {
  const secondarySourcePath = path.join(outputDir, SECONDARY_SOURCE_FILENAME);

  try {
    const buffer = await fs.readFile(secondarySourcePath);

    return {
      buffer,
      mimeType: 'image/png',
      dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
    };
  } catch (error) {
    throw clientError('missing_primary_image', 'Imagem principal nao encontrada para esta geracao. Gere a figurinha principal primeiro.');
  }
}

function createRunId(value) {
  const slug = String(value || 'participante')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'participante';
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const suffix = crypto.randomBytes(3).toString('hex');

  return `${stamp}-${slug}-${suffix}`;
}

function normalizeRunId(value) {
  const text = String(value || '').trim();

  if (!/^[a-z0-9-]{12,80}$/.test(text)) {
    return '';
  }

  return text;
}

function findImageSpec(specId) {
  const spec = IMAGE_SPECS.find((item) => item.id === specId);

  if (!spec) {
    throw clientError('invalid_image_spec', 'Tipo de imagem invalido.');
  }

  return spec;
}

function getMainImageSpec() {
  return IMAGE_SPECS.find((spec) => spec.id === MAIN_IMAGE_ID) || IMAGE_SPECS[0];
}

function readIntegerEnv(name, fallback, min, max) {
  const parsed = Number.parseInt(process.env[name], 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function readBooleanEnv(name, fallback = false) {
  const value = String(process.env[name] || '').trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'sim', 'on'].includes(value);
}

async function ensureEventPrintAutomationConfig() {
  const eventRef = getEventRef();
  const snap = await eventRef.get();
  const data = snap.exists ? snap.data() || {} : {};
  const hasMainConfig = typeof data.autoPrintMainOnReady === 'boolean';
  const hasStickerSheetConfig = typeof data.autoPrintStickerSheetOnReady === 'boolean';
  const hasStickerSheetPackConfig = typeof data.autoSendStickerSheetPackOnReady === 'boolean';
  const autoPrintMainOnReady = hasMainConfig
    ? data.autoPrintMainOnReady
    : DEFAULT_AUTO_PRINT_ON_GENERATION;
  const autoPrintStickerSheetOnReady = hasStickerSheetConfig
    ? data.autoPrintStickerSheetOnReady
    : DEFAULT_AUTO_PRINT_ON_GENERATION;
  const autoSendStickerSheetPackOnReady = hasStickerSheetPackConfig
    ? data.autoSendStickerSheetPackOnReady
    : false;
  const stickerSheetPackWhatsAppTo = normalizeConfiguredWhatsAppNumber(data.stickerSheetPackWhatsAppTo);

  if (!hasMainConfig || !hasStickerSheetConfig || !hasStickerSheetPackConfig || data.eventId !== getEventId()) {
    const payload = {
      eventId: getEventId(),
      updatedAt: Timestamp.now(),
    };

    if (!hasMainConfig) {
      payload.autoPrintMainOnReady = autoPrintMainOnReady;
    }

    if (!hasStickerSheetConfig) {
      payload.autoPrintStickerSheetOnReady = autoPrintStickerSheetOnReady;
    }

    if (!hasStickerSheetPackConfig) {
      payload.autoSendStickerSheetPackOnReady = autoSendStickerSheetPackOnReady;
    }

    await eventRef.set(payload, { merge: true });
  }

  return {
    autoPrintMainOnReady,
    autoPrintStickerSheetOnReady,
    autoSendStickerSheetPackOnReady,
    stickerSheetPackWhatsAppTo,
  };
}

function buildPrintPendingFilename(printId, storagePath, timestamp) {
  const millis = timestamp && typeof timestamp.toMillis === 'function'
    ? timestamp.toMillis()
    : Date.now();
  return `${printId}-${millis}-${path.basename(storagePath)}`
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function readIntegerValue(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

async function getMainCompositeLayout(params = {}) {
  const config = await getMainCompositeDefaults();
  const defaults = config.defaults;

  return {
    background: normalizeColorString(readParamAlias(params, 'mainBackground', 'background', defaults.background), defaults.background),
    imageLeft: readIntegerParam(readParamAlias(params, 'mainImageLeft', 'imageLeft', defaults.imageLeft), defaults.imageLeft, -1000, 3000),
    imageTop: readIntegerParam(readParamAlias(params, 'mainImageTop', 'imageTop', defaults.imageTop), defaults.imageTop, -1000, 3000),
    imageWidth: readIntegerParam(readParamAlias(params, 'mainImageWidth', 'imageWidth', defaults.imageWidth), defaults.imageWidth, 100, 3000),
    imageHeight: readIntegerParam(readParamAlias(params, 'mainImageHeight', 'imageHeight', defaults.imageHeight), defaults.imageHeight, 100, 4000),
    imageFit: normalizeFit(readParamAlias(params, 'mainImageFit', 'imageFit', defaults.imageFit)),
  };
}

function readParamAlias(params, preferred, fallback, defaultValue) {
  if (params && params[preferred] !== undefined && params[preferred] !== null && params[preferred] !== '') {
    return params[preferred];
  }

  if (params && params[fallback] !== undefined && params[fallback] !== null && params[fallback] !== '') {
    return params[fallback];
  }

  return defaultValue;
}

async function getMainCompositeDefaults() {
  const envDefaults = normalizeMainComposition(MAIN_COMPOSITE_ENV_DEFAULTS);

  if (!isFirebaseConfigured()) {
    return {
      defaults: envDefaults,
      source: 'env',
      firestore: false,
    };
  }

  try {
    const eventRef = getEventRef();
    const snap = await eventRef.get();
    const data = snap.exists ? snap.data() || {} : {};
    const hasFirestoreComposition = data.mainComposition
      && typeof data.mainComposition === 'object'
      && !Array.isArray(data.mainComposition);
    const defaults = normalizeMainComposition(hasFirestoreComposition
      ? data.mainComposition
      : envDefaults);

    if (!hasFirestoreComposition || !hasCompleteMainComposition(data.mainComposition) || data.eventId !== getEventId()) {
      const now = Timestamp.now();
      await eventRef.set({
        eventId: getEventId(),
        mainComposition: defaults,
        mainCompositionSeededFromEnv: !hasFirestoreComposition,
        mainCompositionUpdatedAt: data.mainCompositionUpdatedAt || now,
        updatedAt: now,
      }, { merge: true });
    }

    return {
      defaults,
      source: hasFirestoreComposition ? 'firestore' : 'firestore-seeded-from-env',
      firestore: true,
    };
  } catch (error) {
    console.error('[photobooth] failed to read main composition from firestore', error);
    return {
      defaults: envDefaults,
      source: 'env-fallback',
      firestore: false,
    };
  }
}

function normalizeMainComposition(value = {}) {
  const fallback = MAIN_COMPOSITE_ENV_DEFAULTS;
  const imageWidth = readIntegerValue(value.imageWidth, fallback.imageWidth, 100, 3000);
  const imageHeight = readIntegerValue(value.imageHeight, fallback.imageHeight, 100, 4000);

  return {
    background: normalizeColorString(value.background, fallback.background),
    imageLeft: readIntegerValue(value.imageLeft, fallback.imageLeft, -1000, 3000),
    imageTop: readIntegerValue(value.imageTop, fallback.imageTop, -1000, 3000),
    imageWidth,
    imageHeight,
    imageFit: normalizeFit(value.imageFit || fallback.imageFit),
  };
}

function normalizeColorString(value, fallback = '#000d25') {
  const text = String(value || '').trim();

  if (/^#[a-f0-9]{3}$/i.test(text) || /^#[a-f0-9]{6}$/i.test(text)) {
    return text.toLowerCase();
  }

  return String(fallback || '#000d25');
}

function hasCompleteMainComposition(value = {}) {
  return [
    'background',
    'imageLeft',
    'imageTop',
    'imageWidth',
    'imageHeight',
    'imageFit',
  ].every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function readIntegerParam(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function readJsonEnv(name) {
  const value = process.env[name];

  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function parseColorParam(value, fallback = { r: 0, g: 13, b: 37, alpha: 1 }) {
  const text = String(value || '').trim();
  const shortHex = text.match(/^#([a-f0-9]{3})$/i);
  const longHex = text.match(/^#([a-f0-9]{6})$/i);

  if (shortHex) {
    const [r, g, b] = shortHex[1].split('').map((char) => Number.parseInt(`${char}${char}`, 16));
    return { r, g, b, alpha: 1 };
  }

  if (longHex) {
    const hex = longHex[1];
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      alpha: 1,
    };
  }

  return fallback;
}

function normalizeFit(value) {
  return ['contain', 'cover', 'fill', 'inside', 'outside'].includes(value) ? value : 'contain';
}

function getImageExtension(mimeType) {
  if (mimeType === 'image/png') {
    return 'png';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}

function getPalette(id) {
  const palettes = [
    { background: '#0f5f3d', panel: '#0b2f24', accent: '#ffd447' },
    { background: '#173f7a', panel: '#0d244a', accent: '#f4d35e' },
    { background: '#781f3a', panel: '#381020', accent: '#38d9a9' },
    { background: '#17494d', panel: '#092d30', accent: '#ff7a59' },
  ];
  const index = [...id].reduce((total, char) => total + char.charCodeAt(0), 0) % palettes.length;

  return palettes[index];
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clientError(code, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = 400;
  error.code = code;
  error.publicMessage = publicMessage;
  return error;
}

function serviceUnavailableError(code, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = 503;
  error.code = code;
  error.publicMessage = publicMessage;
  return error;
}

module.exports = {
  MAIN_PRINT_SIZE,
  SMALL_PNG_SIZE,
  SMALL_WEBP_SIZE,
  MAX_SOURCE_IMAGE_BYTES,
  STICKER_SHEET_FILENAME,
  generateWorldCupImages,
  generateWorldCupImage,
  persistGeneratorImageResult,
  composeMainCardFromSubject,
  ensureStickerSheetForRun,
  clearGeneratedImages,
  getGeneratedFilePath,
  getGeneratedRunDirectory,
  getImageSpecSummaries,
  getImageGenerationStatus,
  getMainCompositionAssetPath,
  getMainCompositionConfig,
  saveMainCompositionConfig,
};
