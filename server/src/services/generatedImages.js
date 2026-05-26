const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const {
  MAIN_IMAGE_ID,
  IMAGE_SPECS,
  buildPromptForSpec,
  getImageSpecSummaries,
} = require('./worldCupImagePrompts');

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
const OPTIMIZED_SOURCE_FILENAME = 'source-openai.jpg';
const SECONDARY_SOURCE_FILENAME = 'source-secondary.png';
const MAIN_SUBJECT_FILENAME = '01-figurinha-principal-subject.png';
const MAIN_CARD_COMPOSITION_ENV = readJsonEnv('MAIN_CARD_COMPOSITION');
const MAIN_COMPOSITE_DEFAULTS = {
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

async function generateAndSaveImage({
  provider,
  outputDir,
  spec,
  params,
  runId,
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
  const stickerSheet = await createStickerSheetIfReady(outputDir);

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

async function createStickerSheetIfReady(outputDir) {
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
  const columnGap = 34;
  const rowGap = 28;
  const cellWidth = (STICKER_SHEET_SIZE.width - margin * 2 - columnGap * (columns - 1)) / columns;
  const cellHeight = (STICKER_SHEET_SIZE.height - margin * 2 - rowGap * (rows - 1)) / rows;
  const imageSize = Math.floor(Math.min(cellWidth, cellHeight) * 0.98);
  const stickerLayers = await Promise.all(stickerPaths.map(async (filePath, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = Math.round(margin + column * (cellWidth + columnGap) + (cellWidth - imageSize) / 2);
    const top = Math.round(margin + row * (cellHeight + rowGap) + (cellHeight - imageSize) / 2);
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
    .composite(stickerLayers)
    .withMetadata({ density: STICKER_SHEET_SIZE.density })
    .png({ compressionLevel: 9 })
    .toFile(sheetPath);

  const printQueue = await copyStickerSheetToPendingQueue({
    outputDir,
    sheetPath,
  });

  return {
    type: 'sticker-sheet-3.5x6',
    name: STICKER_SHEET_FILENAME,
    width: STICKER_SHEET_SIZE.width,
    height: STICKER_SHEET_SIZE.height,
    density: STICKER_SHEET_SIZE.density,
    printQueue,
  };
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
  const layout = getMainCompositeLayout(params);
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
      ...MAIN_COMPOSITE_DEFAULTS,
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

function getMainCompositionConfig() {
  return {
    printSize: MAIN_PRINT_SIZE,
    backgroundImageUrl: '/api/photobooth/main-card-background',
    overlayImageUrl: '/api/photobooth/main-card-overlay',
    defaults: {
      ...MAIN_COMPOSITE_DEFAULTS,
    },
  };
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
      'Identity preservation is the highest priority: preserve the source person face shape, apparent age, skin tone, nose, mouth, eyes, eyebrows, smile, hairline, hair, facial hair, and unique facial features. Do not beautify, reshape, slim, age, de-age, symmetrize, or turn the person into a different face.',
      'Preserve all existing accessories exactly as they appear in the source image: same style, material, shape, size, color, and position. Do not restyle, recolor, simplify, remove, or replace real earrings, rings, bracelets, watches, necklaces, piercings, hats, or glasses.',
      'Do not draw, simulate, or include a checkerboard/checkered transparency preview pattern.',
      'Do not include any background, backdrop, card frame, border, logo, watermark, or extra text.',
      'Do not include Nike, swoosh marks, check marks, manufacturer logos, team crests, sponsor logos, or any brand-like symbol on clothing.',
      'The shirt must not contain any logo-like symbol. The only allowed graphic on the shirt is the exact jersey number when the prompt explicitly requests one.',
      'If a jersey number is requested, show that number exactly once on the shirt; do not duplicate it on the shoulder, chest, sleeve, or any other area.',
      'If the prompt does not explicitly request a jersey number, do not add any number, digits, letters, or text to the shirt.',
      'For sticker variants, if the source shirt includes a jersey number, preserve that same number visibly on the shirt; do not remove, hide, change, relocate, or duplicate it.',
      'Do not add wearable accessories such as glasses, sunglasses, hats, jewelry, watches, or bracelets unless they are clearly visible in the source image or explicitly required by the prompt.',
      'If glasses are not clearly visible on the source face, assume the person does not wear glasses; keep the face without glasses and do not add frames or lenses to any sticker except the specific sticker titled "O Hexa Vem".',
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
    ? `${escapeXml(params.position || 'Craque')} #${escapeXml(params.jerseyNumber || '10')}`
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

function readIntegerValue(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function getMainCompositeLayout(params = {}) {
  return {
    background: parseColorParam(params.mainBackground, parseColorParam(MAIN_COMPOSITE_DEFAULTS.background)),
    imageLeft: readIntegerParam(params.mainImageLeft, MAIN_COMPOSITE_DEFAULTS.imageLeft, -1000, 3000),
    imageTop: readIntegerParam(params.mainImageTop, MAIN_COMPOSITE_DEFAULTS.imageTop, -1000, 3000),
    imageWidth: readIntegerParam(params.mainImageWidth, MAIN_COMPOSITE_DEFAULTS.imageWidth, 100, 3000),
    imageHeight: readIntegerParam(params.mainImageHeight, MAIN_COMPOSITE_DEFAULTS.imageHeight, 100, 4000),
    imageFit: normalizeFit(params.mainImageFit || MAIN_COMPOSITE_DEFAULTS.imageFit),
  };
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

module.exports = {
  MAIN_PRINT_SIZE,
  SMALL_PNG_SIZE,
  SMALL_WEBP_SIZE,
  MAX_SOURCE_IMAGE_BYTES,
  generateWorldCupImages,
  generateWorldCupImage,
  clearGeneratedImages,
  getImageSpecSummaries,
  getImageGenerationStatus,
  getMainCompositionAssetPath,
  getMainCompositionConfig,
};
