const path = require('node:path');
const express = require('express');
const multer = require('multer');
const { loadEnv } = require('./services/env');

loadEnv();

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
  persistGeneratorImageResult,
  saveMainCompositionConfig,
} = require('./services/generatedImages');
const {
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
} = require('./services/eventMessages');
const {
  Timestamp,
  cleanEventId,
  getDb,
  getEventId,
  getEventRef,
  getFirebasePublicConfig,
  getStorageRoot,
  isFirebaseConfigured,
  runWithEventId,
  verifyFirebaseIdToken,
} = require('./services/firebaseAdmin');
const {
  createPrintRequest,
  ensureEventPrintAutomationConfig,
  ensureEventPrintLimit,
  handleWhatsAppWebhook,
  recomposeMainImage,
  regenerateImagePackage,
  resendImageStickers,
  resendStickerSheetPack,
  resendStickerOutput,
} = require('./services/whatsappPhotobooth');
const {
  clearPrintQueue,
  markPrintDocumentStatus,
} = require('./services/printQueue');
const {
  createPhoneProfileId,
} = require('./services/phone');
const {
  getTwilioDefaultConfigPublic,
  getTwilioEventConfigPublic,
  normalizeTwilioEventConfig,
  runWithTwilioConfig,
} = require('./services/twilioWhatsApp');
const {
  clearRaffles,
  createRaffle,
  deleteRaffle,
  listRecentRaffles,
} = require('./services/raffle');

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

app.get('/manager', (req, res) => {
  res.sendFile(path.join(publicDir, 'manager.html'));
});

app.get('/search', (req, res, next) => {
  if (req.path === '/search/') {
    return next();
  }

  res.redirect(308, '/search/');
});

app.get('/search/', (req, res) => {
  res.sendFile(path.join(publicDir, 'search.html'));
});

app.get('/search/:eventId', (req, res) => {
  res.sendFile(path.join(publicDir, 'search.html'));
});

app.get('/search/:eventId/:phone', (req, res, next) => {
  const eventId = cleanEventId(req.params.eventId, '');
  const phone = cleanString(req.params.phone, 80);

  if (!eventId) {
    return next(clientError('missing_event_id', 'Informe o evento para busca.'));
  }

  res.redirect(308, `/search/${encodeURIComponent(eventId)}?phone=${encodeURIComponent(phone)}`);
});

app.get('/api/photobooth/manager/events', async (req, res, next) => {
  try {
    await verifyFirebaseIdToken(req);
    const eventsSnap = await getDb().collection('events').limit(200).get();
    const events = [];

    eventsSnap.forEach((doc) => {
      events.push(serializeEventDoc(doc.id, doc.data() || {}));
    });

    events.sort(compareEventsByLabel);

    const defaultEventId = getEventId();

    if (!events.some((event) => event.id === defaultEventId)) {
      events.unshift({
        id: defaultEventId,
        eventId: defaultEventId,
        name: '',
        firestoreRoot: `/events/${defaultEventId}`,
        isDefault: true,
      });
    }

    res.json({
      ok: true,
      defaultEventId,
      events,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/manager/events', async (req, res, next) => {
  try {
    const user = await verifyFirebaseIdToken(req);
    const rawEventId = cleanString(req.body && (req.body.eventId || req.body.id), 120);
    const eventId = cleanEventId(rawEventId, '');
    const name = cleanString(req.body && req.body.name, 120);

    if (!eventId) {
      throw clientError('missing_event_id', 'Informe um identificador para o evento.');
    }

    const eventRef = getDb().collection('events').doc(eventId);
    const snap = await eventRef.get();
    const now = Timestamp.now();

    await runWithEventId(eventId, async () => {
      await eventRef.set({
        ...(snap.exists ? {} : {
          createdAt: now,
          createdBy: user.email || user.uid,
        }),
        eventId,
        ...(name ? { name } : {}),
        updatedAt: now,
        updatedBy: user.email || user.uid,
      }, { merge: true });

      await ensureEventPrintLimit();
      await ensureEventPrintAutomationConfig();
      await getMainCompositionConfig();
    });

    const updatedSnap = await eventRef.get();

    res.status(snap.exists ? 200 : 201).json({
      ok: true,
      event: serializeEventDoc(eventId, updatedSnap.data() || {}),
    });
  } catch (error) {
    next(error);
  }
});

app.use('/api/photobooth/manager', (req, res, next) => {
  if (req.path === '/config') {
    return next();
  }

  const eventId = getRequestEventId(req);

  if (!eventId) {
    return next();
  }

  return runWithEventId(eventId, () => next());
});

app.get('/api/photobooth/manager/config', async (req, res, next) => {
  try {
    const requestedEventId = getRequestEventId(req);

    if (requestedEventId && requestedEventId !== getEventId()) {
      await verifyFirebaseIdToken(req);
    }

    await runWithRequestEvent(req, async () => {
      let printLimitPerProfile = null;
      let printAutomation = null;
      let mainComposition = null;
      let eventData = {};

      if (isFirebaseConfigured()) {
        printLimitPerProfile = await ensureEventPrintLimit();
        printAutomation = await ensureEventPrintAutomationConfig();
        mainComposition = await getMainCompositionConfig();
        const eventSnap = await getEventRef().get();
        eventData = eventSnap.exists ? eventSnap.data() || {} : {};
      }

      res.json({
        eventId: getEventId(),
        firestoreRoot: `/events/${getEventId()}`,
        storageRoot: getStorageRoot(),
        printLimitPerProfile,
        printAutomation,
        mainComposition,
        language: normalizeLanguage(eventData.language),
        supportedLanguages: SUPPORTED_LANGUAGES,
        twilio: getTwilioEventConfigPublic(eventData.twilio || {}),
        twilioDefaults: getTwilioDefaultConfigPublic(),
        whatsappWebhookUrl: buildWhatsappWebhookUrl(req, getEventId()),
        firebaseConfig: getFirebasePublicConfig(),
      });
    });
  } catch (error) {
    console.error('[manager] failed to ensure event config', error);
    next(error);
  }
});

app.post('/api/photobooth/manager/event-config', async (req, res, next) => {
  try {
    const user = await verifyFirebaseIdToken(req);

    await runWithRequestEvent(req, async () => {
      const eventRef = getEventRef();
      const snap = await eventRef.get();
      const current = snap.exists ? snap.data() || {} : {};
      const now = Timestamp.now();
      const payload = {
        eventId: getEventId(),
        updatedAt: now,
        updatedBy: user.email || user.uid,
      };

      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'printLimitPerProfile')) {
        payload.printLimitPerProfile = readInteger(
          req.body.printLimitPerProfile,
          current.printLimitPerProfile ?? 0,
          0,
          1000,
        );
      }

      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'language')) {
        payload.language = normalizeLanguage(req.body.language);
      }

      if (req.body && req.body.printAutomation) {
        payload.autoPrintMainOnReady = req.body.printAutomation.autoPrintMainOnReady === true;
        payload.autoPrintStickerSheetOnReady = req.body.printAutomation.autoPrintStickerSheetOnReady === true;
        payload.autoSendStickerSheetPackOnReady = req.body.printAutomation.autoSendStickerSheetPackOnReady === true;
        payload.stickerSheetPackWhatsAppTo = cleanString(req.body.printAutomation.stickerSheetPackWhatsAppTo, 80);
      }

      if (req.body && req.body.twilio) {
        payload.twilio = buildTwilioConfigForStorage(req.body.twilio, current.twilio || {}, {
          updatedAt: now,
          updatedBy: user.email || user.uid,
        });
      }

      await eventRef.set(payload, { merge: true });

      const updatedSnap = await eventRef.get();
      const updatedData = updatedSnap.exists ? updatedSnap.data() || {} : {};

      res.json({
        ok: true,
        eventId: getEventId(),
        firestoreRoot: `/events/${getEventId()}`,
        storageRoot: getStorageRoot(),
        printLimitPerProfile: updatedData.printLimitPerProfile ?? null,
        printAutomation: serializePrintAutomation(updatedData),
        mainComposition: updatedData.mainComposition || null,
        language: normalizeLanguage(updatedData.language),
        supportedLanguages: SUPPORTED_LANGUAGES,
        twilio: getTwilioEventConfigPublic(updatedData.twilio || {}),
        twilioDefaults: getTwilioDefaultConfigPublic(),
        whatsappWebhookUrl: buildWhatsappWebhookUrl(req, getEventId()),
        firebaseConfig: getFirebasePublicConfig(),
      });
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/photobooth/manager/raffles', async (req, res, next) => {
  try {
    await verifyFirebaseIdToken(req);

    await runWithRequestEvent(req, async () => {
      const limit = readInteger(req.query && req.query.limit, 20, 1, 50);
      const raffles = await listRecentRaffles(limit);

      res.json({
        ok: true,
        eventId: getEventId(),
        raffles,
      });
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/manager/raffles', async (req, res, next) => {
  try {
    const user = await verifyFirebaseIdToken(req);

    await runWithRequestEvent(req, async () => {
      const result = await createRaffle({
        mode: cleanString(req.body && req.body.mode, 40) || 'all',
        startAt: cleanString(req.body && req.body.startAt, 80),
        endAt: cleanString(req.body && req.body.endAt, 80),
        lastHours: req.body && req.body.lastHours,
        winnerCount: req.body && req.body.winnerCount,
        excludePreviousWinners: !(req.body && req.body.excludePreviousWinners === false),
        requestedBy: user.email || user.uid,
      });

      res.status(201).json(result);
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/manager/raffles/clear', async (req, res, next) => {
  try {
    const user = await verifyFirebaseIdToken(req);

    await runWithRequestEvent(req, async () => {
      const result = await clearRaffles({
        requestedBy: user.email || user.uid,
      });

      res.json(result);
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/manager/raffles/:raffleId/delete', async (req, res, next) => {
  try {
    const user = await verifyFirebaseIdToken(req);
    const raffleId = cleanString(req.params.raffleId, 160);

    if (!raffleId) {
      throw clientError('missing_raffle_id', 'Informe o sorteio para limpar.');
    }

    await runWithRequestEvent(req, async () => {
      const result = await deleteRaffle({
        raffleId,
        requestedBy: user.email || user.uid,
      });

      res.json(result);
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/photobooth/search/config', handleSearchConfig);
app.get('/api/photobooth/search/config/:eventId', (req, res, next) => (
  runWithRouteEvent(req, next, () => handleSearchConfig(req, res, next))
));

app.get('/api/photobooth/search/phone', handleSearchPhone);
app.get('/api/photobooth/search/:eventId/phone', (req, res, next) => (
  runWithRouteEvent(req, next, () => handleSearchPhone(req, res, next))
));

app.post('/api/photobooth/search/prints', handleSearchPrintRequest);
app.post('/api/photobooth/search/:eventId/prints', (req, res, next) => (
  runWithRouteEvent(req, next, () => handleSearchPrintRequest(req, res, next))
));

async function handleSearchConfig(req, res, next) {
  try {
    await runWithRequestEvent(req, async () => {
      res.json({
        ok: true,
        eventId: getEventId(),
        firestoreRoot: `/events/${getEventId()}`,
        firebaseConfig: getFirebasePublicConfig(),
      });
    });
  } catch (error) {
    next(error);
  }
}

async function handleSearchPhone(req, res, next) {
  try {
    await verifyFirebaseIdToken(req);

    await runWithRequestEvent(req, async () => {
      const phone = cleanString(req.query && req.query.phone, 80);

      if (!phone) {
        throw clientError('missing_phone', 'Informe o telefone para busca.');
      }

      const profile = await findProfileByPhone(phone);

      if (!profile) {
        res.json({
          ok: true,
          found: false,
          profile: null,
          images: [],
        });
        return;
      }

      const imagesSnap = await getEventRef()
        .collection('images')
        .where('profileId', '==', profile.id)
        .get();
      const images = [];

      imagesSnap.forEach((doc) => {
        images.push({
          id: doc.id,
          data: doc.data() || {},
        });
      });

      images.sort((a, b) => timestampToMillis(b.data.createdAt) - timestampToMillis(a.data.createdAt));

      res.json({
        ok: true,
        eventId: getEventId(),
        found: true,
        profile,
        images: images.slice(0, 100),
      });
    });
  } catch (error) {
    next(error);
  }
}

async function handleSearchPrintRequest(req, res, next) {
  try {
    const user = await verifyFirebaseIdToken(req);

    await runWithRequestEvent(req, async () => {
      const imageId = cleanString(req.body && req.body.imageId, 160);
      const type = cleanString(req.body && req.body.type, 20) || 'stickers';

      if (!imageId) {
        throw clientError('missing_image_id', 'Informe a imagem para impressao.');
      }

      const result = await createPrintRequest({
        imageId,
        type,
        participant: {
          id: user.uid,
        },
        source: 'search',
        requestedBy: user.email || user.uid,
      });

      res.json(result);
    });
  } catch (error) {
    next(error);
  }
}

app.post('/api/photobooth/manager/prints', async (req, res, next) => {
  try {
    const user = await verifyFirebaseIdToken(req);
    const imageId = cleanString(req.body && req.body.imageId, 160);
    const type = cleanString(req.body && req.body.type, 20) || 'stickers';

    if (!imageId) {
      throw clientError('missing_image_id', 'Informe a imagem para impressao.');
    }

    const result = await createPrintRequest({
      imageId,
      type,
      participant: {
        id: user.uid,
      },
      source: 'manager',
      requestedBy: user.email || user.uid,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/manager/main-composition', async (req, res, next) => {
  try {
    const user = await verifyFirebaseIdToken(req);
    res.json(await saveMainCompositionConfig(req.body, user.email || user.uid));
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/manager/prints/clear', async (req, res, next) => {
  try {
    const user = await verifyFirebaseIdToken(req);
    const type = cleanString(req.body && req.body.type, 20);

    if (!['main', 'stickers'].includes(type)) {
      throw clientError('invalid_print_type', 'Informe o tipo de impressao para limpar.');
    }

    const result = await clearPrintQueue(type, user.email || user.uid);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/manager/profiles/:profileId/unlimited', async (req, res, next) => {
  try {
    const user = await verifyFirebaseIdToken(req);
    const profileId = cleanString(req.params.profileId, 160);
    const unlimited = req.body && req.body.unlimited === true;

    if (!profileId) {
      throw clientError('missing_profile_id', 'Informe o participante.');
    }

    const profileRef = getEventRef().collection('profiles').doc(profileId);
    const profileSnap = await profileRef.get();

    if (!profileSnap.exists) {
      throw clientError('profile_not_found', 'Participante nao encontrado.', 404);
    }

    const now = Timestamp.now();
    await profileRef.set({
      unlimited,
      unlimitedUpdatedAt: now,
      unlimitedUpdatedBy: user.email || user.uid,
      updatedAt: now,
    }, { merge: true });

    res.json({
      ok: true,
      profileId,
      unlimited,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/manager/images/:imageId/regenerate', async (req, res, next) => {
  try {
    const user = await verifyFirebaseIdToken(req);
    const imageId = cleanString(req.params.imageId, 160);

    if (!imageId) {
      throw clientError('missing_image_id', 'Informe a imagem para regerar.');
    }

    regenerateImagePackage({
      imageId,
      requestedBy: user.email || user.uid,
    }).catch((error) => {
      console.error(`[manager] failed to regenerate ${imageId}`, error);
    });

    res.status(202).json({
      ok: true,
      imageId,
      status: 'regenerating',
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/manager/images/:imageId/main-composition/regenerate', async (req, res, next) => {
  try {
    const user = await verifyFirebaseIdToken(req);
    const imageId = cleanString(req.params.imageId, 160);

    if (!imageId) {
      throw clientError('missing_image_id', 'Informe a imagem para recompor.');
    }

    const result = await recomposeMainImage({
      imageId,
      composition: req.body && req.body.composition ? req.body.composition : req.body,
      requestedBy: user.email || user.uid,
      sendWhatsApp: true,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/manager/images/:imageId/stickers/resend', async (req, res, next) => {
  try {
    const user = await verifyFirebaseIdToken(req);
    const imageId = cleanString(req.params.imageId, 160);

    if (!imageId) {
      throw clientError('missing_image_id', 'Informe a imagem para reenvio.');
    }

    const result = await resendImageStickers({
      imageId,
      requestedBy: user.email || user.uid,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/manager/images/:imageId/sticker-pack/resend', async (req, res, next) => {
  try {
    const user = await verifyFirebaseIdToken(req);
    const imageId = cleanString(req.params.imageId, 160);

    if (!imageId) {
      throw clientError('missing_image_id', 'Informe a imagem para reenvio.');
    }

    const result = await resendStickerSheetPack({
      imageId,
      requestedBy: user.email || user.uid,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/manager/images/:imageId/stickers/:outputId/resend', async (req, res, next) => {
  try {
    const user = await verifyFirebaseIdToken(req);
    const imageId = cleanString(req.params.imageId, 160);
    const outputId = cleanString(req.params.outputId, 100);

    if (!imageId || !outputId) {
      throw clientError('missing_sticker_id', 'Informe a imagem e o sticker para reenvio.');
    }

    const result = await resendStickerOutput({
      imageId,
      outputId,
      requestedBy: user.email || user.uid,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/manager/prints/:printId/status', async (req, res, next) => {
  try {
    const user = await verifyFirebaseIdToken(req);
    const printId = cleanString(req.params.printId, 180);
    const status = cleanString(req.body && req.body.status, 40);
    const allowed = new Set(['pending', 'queued', 'printed', 'cancelled', 'print-error', 'queue-error']);

    if (!printId || !allowed.has(status)) {
      throw clientError('invalid_print_status', 'Status de impressao invalido.');
    }

    const result = await markPrintDocumentStatus(
      printId,
      status,
      user.email || user.uid,
    );

    if (!result.ok) {
      throw clientError('print_not_found', 'Pedido de impressao nao encontrado.', 404);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/whatsapp', handleWhatsAppWebhook);
app.post('/api/photobooth/whatsapp/webhook', handleWhatsAppWebhook);
app.post('/api/photobooth/whatsapp/:eventId', async (req, res, next) => {
  const eventId = cleanEventId(req.params.eventId, '');

  if (!eventId) {
    return next(clientError('missing_event_id', 'Informe o evento no webhook.'));
  }

  try {
    await runWithEventId(eventId, async () => {
      const twilioConfig = await loadCurrentEventTwilioConfig();

      await runWithTwilioConfig(twilioConfig, () => handleWhatsAppWebhook(req, res));
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/photobooth/image-prompts', async (req, res, next) => {
  try {
    const mainComposition = await getMainCompositionConfig();

    res.json({
      total: getImageSpecSummaries().length,
      mainPrintSize: MAIN_PRINT_SIZE,
      mainComposition,
      stickerWebpSize: SMALL_WEBP_SIZE,
      specs: getImageSpecSummaries(),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/photobooth/main-composition', async (req, res, next) => {
  try {
    res.json(await getMainCompositionConfig());
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/main-composition', async (req, res, next) => {
  try {
    res.json(await saveMainCompositionConfig(req.body, 'generator'));
  } catch (error) {
    next(error);
  }
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
    const startedAt = Date.now();
    const params = normalizeGenerationParams(getGenerationParamsFromRequest(req));
    const result = await generateWorldCupImages({
      sourceImage: getSourceImageFromRequest(req),
      params,
    });
    result.persistence = await persistGeneratorResultSafe({
      result,
      params,
      durationMs: Date.now() - startedAt,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/photobooth/generate-image', upload.single('sourceImage'), async (req, res, next) => {
  try {
    const startedAt = Date.now();
    const params = normalizeGenerationParams(getGenerationParamsFromRequest(req));
    const result = await generateWorldCupImage({
      sourceImage: getSourceImageFromRequest(req),
      params,
      specId: cleanString(req.body && req.body.specId, 80),
      runId: cleanString(req.body && req.body.runId, 100),
    });
    result.persistence = await persistGeneratorResultSafe({
      result,
      params,
      durationMs: Date.now() - startedAt,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

async function persistGeneratorResultSafe({
  result,
  params,
  durationMs,
}) {
  try {
    return await persistGeneratorImageResult({
      result,
      params,
      durationMs,
    });
  } catch (error) {
    console.error('[generator] failed to persist generated image', error);
    return {
      persisted: false,
      reason: 'persist-failed',
      error: {
        code: error.code || 'server_error',
        message: error.message || 'Falha ao persistir geracao.',
      },
    };
  }
}

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

async function findProfileByPhone(phone) {
  const candidates = buildPhoneCandidates(phone);
  const profilesRef = getEventRef().collection('profiles');
  const ids = Array.from(new Set(candidates.map((candidate) => createPhoneProfileId(candidate))));

  for (const id of ids) {
    const snap = await profilesRef.doc(id).get();

    if (snap.exists) {
      return {
        id: snap.id,
        data: snap.data() || {},
      };
    }
  }

  for (let index = 0; index < candidates.length; index += 10) {
    const chunk = candidates.slice(index, index + 10);

    if (!chunk.length) {
      continue;
    }

    const snap = await profilesRef.where('phoneNumber', 'in', chunk).limit(1).get();

    if (!snap.empty) {
      const doc = snap.docs[0];

      return {
        id: doc.id,
        data: doc.data() || {},
      };
    }
  }

  return null;
}

function buildPhoneCandidates(value) {
  const raw = String(value || '').trim();
  const withoutPrefix = raw.replace(/^whatsapp:/i, '').replace(/\s+/g, '');
  const digits = withoutPrefix.replace(/[^\d]/g, '');
  const candidates = new Set();

  if (withoutPrefix) {
    candidates.add(withoutPrefix);
  }

  if (digits) {
    candidates.add(digits);
    candidates.add(`+${digits}`);
    candidates.add(`whatsapp:${digits}`);
    candidates.add(`whatsapp:+${digits}`);

    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
      candidates.add(`55${digits}`);
      candidates.add(`+55${digits}`);
      candidates.add(`whatsapp:+55${digits}`);
    }
  }

  return Array.from(candidates).filter(Boolean).slice(0, 20);
}

function getRequestEventId(req) {
  const candidate = (req.get && req.get('x-photobooth-event-id'))
    || (req.query && req.query.eventId)
    || (req.body && req.body.eventId)
    || '';

  return cleanEventId(cleanString(candidate, 120), '');
}

function runWithRequestEvent(req, task) {
  return runWithEventId(getRequestEventId(req) || getEventId(), task);
}

function runWithRouteEvent(req, next, task) {
  const eventId = cleanEventId(req.params && req.params.eventId, '');

  if (!eventId) {
    return next(clientError('missing_event_id', 'Informe o evento.'));
  }

  return runWithEventId(eventId, task).catch(next);
}

async function loadCurrentEventTwilioConfig() {
  if (!isFirebaseConfigured()) {
    return {};
  }

  const snap = await getEventRef().get();
  const data = snap.exists ? snap.data() || {} : {};

  return data.twilio || {};
}

function buildTwilioConfigForStorage(input = {}, existing = {}, metadata = {}) {
  const mode = input.mode === 'custom' ? 'custom' : 'default';

  if (mode !== 'custom') {
    return {
      mode: 'default',
      accountSid: '',
      authToken: '',
      messagingServiceSid: '',
      whatsAppFrom: '',
      ...metadata,
    };
  }

  const normalizedExisting = normalizeTwilioEventConfig(existing);
  const authToken = cleanString(input.authToken, 240) || normalizedExisting.authToken || '';

  return {
    mode: 'custom',
    accountSid: cleanString(input.accountSid, 120),
    authToken,
    messagingServiceSid: cleanString(input.messagingServiceSid, 120),
    whatsAppFrom: cleanString(input.whatsAppFrom, 80),
    ...metadata,
  };
}

function buildWhatsappWebhookUrl(req, eventId) {
  const configuredBase = cleanString(process.env.PUBLIC_BASE_URL || process.env.WEBHOOK_BASE_URL, 240);
  const baseUrl = configuredBase
    ? configuredBase.replace(/\/+$/g, '')
    : `${getRequestProtocol(req)}://${req.get('host')}`;

  return `${baseUrl}/api/photobooth/whatsapp/${encodeURIComponent(eventId)}`;
}

function getRequestProtocol(req) {
  const forwarded = cleanString(req.get('x-forwarded-proto'), 40).split(',')[0].trim();

  return forwarded || req.protocol || 'http';
}

function serializeEventDoc(id, data = {}) {
  const eventId = cleanEventId(data.eventId || id, id);

  return {
    id: eventId,
    eventId,
    name: data.name || '',
    firestoreRoot: `/events/${eventId}`,
    printLimitPerProfile: data.printLimitPerProfile,
    printAutomation: serializePrintAutomation(data),
    stats: data.stats || {},
    language: normalizeLanguage(data.language),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

function serializePrintAutomation(data = {}) {
  return {
    autoPrintMainOnReady: data.autoPrintMainOnReady === true,
    autoPrintStickerSheetOnReady: data.autoPrintStickerSheetOnReady === true,
    autoSendStickerSheetPackOnReady: data.autoSendStickerSheetPackOnReady === true,
    stickerSheetPackWhatsAppTo: data.stickerSheetPackWhatsAppTo || '',
  };
}

function compareEventsByLabel(a, b) {
  const labelA = String(a.name || a.id || a.eventId || '').toLowerCase();
  const labelB = String(b.name || b.id || b.eventId || '').toLowerCase();

  return labelA.localeCompare(labelB, 'pt-BR', {
    numeric: true,
    sensitivity: 'base',
  });
}

function timestampToMillis(value) {
  if (!value) {
    return 0;
  }

  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  if (Number.isFinite(value.seconds)) {
    return value.seconds * 1000 + Math.round((value.nanoseconds || 0) / 1000000);
  }

  if (Number.isFinite(value._seconds)) {
    return value._seconds * 1000 + Math.round((value._nanoseconds || 0) / 1000000);
  }

  return 0;
}

function readInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function clientError(code, publicMessage, statusCode = 400) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
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

if (require.main === module) {
  app.listen(port, () => {
    console.log(`AI Photobooth server listening on http://localhost:${port}`);
  });
}

module.exports = {
  app,
};
