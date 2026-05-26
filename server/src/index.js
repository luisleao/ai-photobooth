const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
loadLocalEnv(path.resolve(process.cwd(), '.env'));
const {
  LENTICULAR_LPI,
  LENTICULAR_DISPLAY_OPTIONS,
  LPI_SWEEP_OPTIONS,
  OUTPUT_RASTER_DPI,
  PRINTER_DPI,
  REQUIRED_FRAME_COUNT,
  MAX_PHOTO_BYTES,
  createLenticularCardsPdf,
} = require('./services/cardPdf');
const {
  MAIN_PRINT_SIZE,
  SMALL_WEBP_SIZE,
  clearGeneratedImages,
  generateWorldCupImage,
  generateWorldCupImages,
  getImageGenerationStatus,
  getImageSpecSummaries,
  getMainCompositionAssetPath,
  getMainCompositionConfig,
} = require('./services/generatedImages');

const app = express();
const publicDir = path.resolve(__dirname, '..', 'public');
const port = Number(process.env.PORT || 3000);
const jsonLimit = process.env.JSON_LIMIT || '32mb';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
  next();
});

app.use(express.json({ limit: jsonLimit }));
app.use(express.urlencoded({ extended: false, limit: jsonLimit }));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'ai-photobooth',
    lenticularLpi: LENTICULAR_LPI,
    displayOptions: LENTICULAR_DISPLAY_OPTIONS.map((option) => option.id),
    lpiSweep: LPI_SWEEP_OPTIONS.map((option) => option.lpi),
    printerDpi: PRINTER_DPI,
    outputRasterDpi: OUTPUT_RASTER_DPI,
    calibrationFrames: REQUIRED_FRAME_COUNT,
    calibrationPattern: 'synthetic-ab',
    imageGeneration: {
      ...getImageGenerationStatus(),
      totalImages: getImageSpecSummaries().length,
      mainPrintSize: MAIN_PRINT_SIZE,
      stickerWebpSize: SMALL_WEBP_SIZE,
    },
  });
});

app.get('/', (req, res) => {
  res.redirect(302, '/generator/');
});

app.get('/photobooth', (req, res, next) => {
  if (req.path === '/photobooth/') {
    return next();
  }

  res.redirect(308, '/photobooth/');
});

app.get('/generator', (req, res, next) => {
  if (req.path === '/generator/') {
    return next();
  }

  res.redirect(308, '/generator/');
});

app.get('/api/photobooth/image-prompts', (req, res) => {
  res.json({
    total: getImageSpecSummaries().length,
    mainPrintSize: MAIN_PRINT_SIZE,
    mainComposition: getMainCompositionConfig(),
    stickerWebpSize: SMALL_WEBP_SIZE,
    specs: getImageSpecSummaries(),
  });
});

app.get('/api/photobooth/main-composition', (req, res) => {
  res.json(getMainCompositionConfig());
});

app.get('/api/photobooth/main-card-background', sendMainCardAsset('background'));
app.get('/api/photobooth/main-card-overlay', sendMainCardAsset('overlay'));

app.post('/api/photobooth/generated/clear', async (req, res, next) => {
  try {
    const result = await clearGeneratedImages();
    res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/generate-images', upload.single('sourceImage'), async (req, res, next) => {
  try {
    const result = await generateWorldCupImages({
      sourceImage: getSourceImageFromRequest(req),
      params: normalizeGenerationParams(getGenerationParamsFromRequest(req)),
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/generate-image', upload.single('sourceImage'), async (req, res, next) => {
  try {
    const result = await generateWorldCupImage({
      sourceImage: getSourceImageFromRequest(req),
      params: normalizeGenerationParams(getGenerationParamsFromRequest(req)),
      specId: cleanString(req.body && req.body.specId, 80),
      runId: cleanString(req.body && req.body.runId, 100),
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/cards', async (req, res, next) => {
  try {
    const { participantName } = req.body || {};
    const pdfBuffer = await createLenticularCardsPdf({
      participantName,
    });

    const filename = `${slugify(participantName || 'participante')}-lenticular-cards.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

app.use(express.static(publicDir, {
  extensions: ['html'],
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
}));

app.use((req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: 'Rota nao encontrada.',
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const status = error.statusCode || 500;
  res.status(status).json({
    error: error.code || 'server_error',
    message: error.publicMessage || 'Falha ao processar a requisicao.',
  });
});

function parseImageDataUrl(value) {
  if (typeof value !== 'string') {
    throw clientError('invalid_photo', 'Foto invalida.');
  }

  const match = value.match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/);

  if (!match) {
    throw clientError('invalid_photo_format', 'Use imagens JPEG ou PNG em data URL.');
  }

  const buffer = Buffer.from(match[2], 'base64');

  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) {
    throw clientError('invalid_photo_size', 'Cada foto precisa ter ate 8 MB.');
  }

  return {
    buffer,
    mimeType: match[1],
  };
}

function clientError(code, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = 400;
  error.code = code;
  error.publicMessage = publicMessage;
  return error;
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'participante';
}

function normalizeGenerationParams(value) {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return {
    participantName: cleanString(value.participantName, 80),
    nickname: cleanString(value.nickname, 60),
    country: cleanString(value.country, 60),
    jerseyNumber: cleanString(value.jerseyNumber, 8),
    position: cleanString(value.position, 80),
    city: cleanString(value.city, 80),
    edition: cleanString(value.edition, 16),
    cardColors: cleanString(value.cardColors, 100),
    personality: cleanString(value.personality, 180),
    extraDetails: cleanString(value.extraDetails, 500),
    mainBackground: cleanString(value.mainBackground, 16),
    mainImageLeft: cleanString(value.mainImageLeft, 8),
    mainImageTop: cleanString(value.mainImageTop, 8),
    mainImageWidth: cleanString(value.mainImageWidth, 8),
    mainImageHeight: cleanString(value.mainImageHeight, 8),
    mainImageFit: cleanString(value.mainImageFit, 12),
  };
}

function sendMainCardAsset(kind) {
  return (req, res, next) => {
    res.sendFile(getMainCompositionAssetPath(kind), (error) => {
      if (error) {
        next(error);
      }
    });
  };
}

function getSourceImageFromRequest(req) {
  if (req.file) {
    return `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  }

  return req.body && req.body.sourceImage;
}

function getGenerationParamsFromRequest(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body.params === 'string') {
    try {
      return JSON.parse(req.body.params);
    } catch (error) {
      return {};
    }
  }

  return req.body.params;
}

function cleanString(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function loadLocalEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      return;
    }

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  });
}

if (require.main === module) {
  app.listen(port, () => {
    console.log(`AI Photobooth server listening on http://localhost:${port}`);
  });
}

module.exports = {
  app,
};
