const path = require('node:path');
const express = require('express');
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

const app = express();
const publicDir = path.resolve(__dirname, '..', 'public');
const port = Number(process.env.PORT || 3000);
const jsonLimit = process.env.JSON_LIMIT || '32mb';

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
  });
});

app.get('/', (req, res) => {
  res.redirect(302, '/photobooth/');
});

app.get('/photobooth', (req, res, next) => {
  if (req.path === '/photobooth/') {
    return next();
  }

  res.redirect(308, '/photobooth/');
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

if (require.main === module) {
  app.listen(port, () => {
    console.log(`AI Photobooth server listening on http://localhost:${port}`);
  });
}

module.exports = {
  app,
};
