const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const {
  FieldValue,
  Timestamp,
  getEventId,
  getEventRef,
  isFirebaseConfigured,
  uploadBufferToStorage,
  uploadFileToStorage,
} = require('./firebaseAdmin');
const {
  MAIN_PRINT_SIZE,
  STICKER_SHEET_FILENAME,
  composeMainCardFromSubject,
  ensureStickerSheetForRun,
  generateWorldCupImage,
  getGeneratedFilePath,
  getImageSpecSummaries,
} = require('./generatedImages');
const {
  getCurrentEventTranslator,
} = require('./eventMessages');
const {
  createPhoneProfileId,
  limpaNumero,
} = require('./phone');
const {
  createMessagingResponse,
  downloadTwilioMedia,
  sendWhatsAppMedia,
  sendWhatsAppText,
  toWhatsAppAddress,
} = require('./twilioWhatsApp');

const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');
const WHATSAPP_LOCAL_ROOT = process.env.WHATSAPP_LOCAL_ROOT
  ? path.resolve(process.env.WHATSAPP_LOCAL_ROOT)
  : path.join(SERVER_ROOT, 'public', 'generated', 'whatsapp');
const SOURCE_IMAGE_MAX_SIZE = readIntegerEnv('WHATSAPP_SOURCE_IMAGE_MAX_SIZE', 1024, 320, 1600);
const SOURCE_IMAGE_QUALITY = readIntegerEnv('WHATSAPP_SOURCE_IMAGE_QUALITY', 82, 60, 95);
const DEFAULT_PRINT_LIMIT_PER_PROFILE = readIntegerEnv('PHOTOBOOTH_PRINT_LIMIT_PER_PROFILE', 1, 0, 1000);
const MAIN_WHATSAPP_MAX_SIZE = readIntegerEnv('WHATSAPP_MAIN_IMAGE_MAX_SIZE', 1400, 640, 1800);
const DEFAULT_AUTO_PRINT_ON_GENERATION = readBooleanEnv('PHOTOBOOTH_AUTO_PRINT_ON_GENERATION', false);

async function handleWhatsAppWebhook(req, res) {
  const twiml = createMessagingResponse();
  const messageData = req.body || {};
  const t = await getCurrentEventTranslator();

  try {
    if (!messageData.From) {
      res.status(400);
      twiml.message(t('webhookMissingSender'));
      return sendTwiml(res, twiml);
    }

    if (!isFirebaseConfigured()) {
      twiml.message(t('firebaseNotConfigured'));
      return sendTwiml(res, twiml);
    }

    const profile = await upsertProfile(messageData);

    if (!hasImageMedia(messageData) && isStickerResendKeyword(messageData)) {
      twiml.message(t('stickerResendAck'));
      sendTwiml(res, twiml);

      runInBackground(() => resendGeneratedStickersForProfile({
        profile,
        requestedBy: 'whatsapp-keyword',
      }));
      return undefined;
    }

    if (hasImageMedia(messageData)) {
      const imageId = getInboundImageId(messageData);

      if (!imageId) {
        res.status(400);
        twiml.message(t('webhookMissingSid'));
        return sendTwiml(res, twiml);
      }

      const existingImage = await getImageRef(imageId).get();

      if (existingImage.exists) {
        await createImageRecord({
          imageId,
          profile,
          messageData,
          accepted: false,
        });

        twiml.message(t('duplicateImage'));
        return sendTwiml(res, twiml);
      }

      const limit = await checkProfileImageLimit(profile.id);

      if (!limit.allowed) {
        await createImageRecord({
          imageId,
          profile,
          messageData,
          accepted: false,
          status: 'rejected-limit',
          rejection: {
            reason: 'profile-limit-reached',
            limit: limit.limit,
            used: limit.used,
          },
        });

        twiml.message(t('limitReached', { limit: limit.limit }));
        return sendTwiml(res, twiml);
      }

      await createImageRecord({
        imageId,
        profile,
        messageData,
        accepted: true,
      });

      twiml.message(t('generationAccepted'));
      sendTwiml(res, twiml);

      runInBackground(() => downloadStoreAndGenerate({
        imageId,
        profile,
        messageData,
      }));
      return undefined;
    }

    twiml.message(t('sendPhotoInstructions'));
    return sendTwiml(res, twiml);
  } catch (error) {
    console.error('[whatsapp] webhook failed', error);

    if (!res.headersSent) {
      twiml.message(t('genericFailure'));
      return sendTwiml(res, twiml);
    }

    return undefined;
  }
}

async function downloadStoreAndGenerate({
  imageId,
  profile,
  messageData,
}) {
  const imageRef = getImageRef(imageId);
  const startedMs = Date.now();

  try {
    const t = await getCurrentEventTranslator();

    await startGenerationAttempt({
      imageRef,
      status: 'downloading-source',
      startedMs,
      requestedBy: 'whatsapp',
      trigger: 'whatsapp-inbound',
    });

    const media = await downloadTwilioMedia(messageData.MediaUrl0);

    if (!String(media.contentType).startsWith('image/')) {
      throw clientError('unsupported_media', t('unsupportedMedia'));
    }

    const localDir = path.join(WHATSAPP_LOCAL_ROOT, imageId);
    const originalExtension = extensionForContentType(media.contentType);
    const originalPath = path.join(localDir, `source-original.${originalExtension}`);
    const optimizedPath = path.join(localDir, 'source-whatsapp-openai.jpg');
    const optimizedBuffer = await optimizeIncomingImage(media.buffer);

    await fs.mkdir(localDir, { recursive: true });
    await fs.writeFile(originalPath, media.buffer);
    await fs.writeFile(optimizedPath, optimizedBuffer);

    const [originalUpload, optimizedUpload] = await Promise.all([
      uploadBufferToStorage({
        buffer: media.buffer,
        contentType: media.contentType,
        destination: `images/${imageId}/source/source-original.${originalExtension}`,
        metadata: {
          imageId,
          profileId: profile.id,
        },
      }),
      uploadBufferToStorage({
        buffer: optimizedBuffer,
        contentType: 'image/jpeg',
        destination: `images/${imageId}/source/source-whatsapp-openai.jpg`,
        metadata: {
          imageId,
          profileId: profile.id,
          optimizedFor: 'openai-images',
        },
      }),
    ]);

    await imageRef.set({
      status: 'generating-main',
      source: {
        originalLocalPath: path.relative(PROJECT_ROOT, originalPath),
        optimizedLocalPath: path.relative(PROJECT_ROOT, optimizedPath),
        originalStorage: originalUpload,
        optimizedStorage: optimizedUpload,
        contentType: media.contentType,
        optimized: {
          maxSize: SOURCE_IMAGE_MAX_SIZE,
          quality: SOURCE_IMAGE_QUALITY,
        },
      },
      updatedAt: Timestamp.now(),
    }, { merge: true });

    const sourceImage = `data:image/jpeg;base64,${optimizedBuffer.toString('base64')}`;

    await generatePackageFromSource({
      imageId,
      imageRef,
      profile,
      sourceImage,
      startedMs,
      requestedBy: 'whatsapp',
      trigger: 'whatsapp-inbound',
    });
  } catch (error) {
    console.error('[whatsapp] failed to generate image package', error);
    await recordGenerationFailure({
      imageRef,
      profile,
      error,
      startedMs,
      trigger: 'whatsapp-inbound',
    });
  }
}

async function regenerateImagePackage({
  imageId,
  requestedBy,
}) {
  const imageRef = getImageRef(imageId);
  const imageSnap = await imageRef.get();

  if (!imageSnap.exists) {
    throw clientError('image_not_found', 'Imagem nao encontrada para regerar.');
  }

  const imageData = imageSnap.data() || {};
  const profile = getProfileFromImageData(imageData);

  if (!profile.whatsAppAddress) {
    throw clientError('missing_profile_address', 'Imagem sem WhatsApp de destino para reenvio.');
  }

  const startedMs = Date.now();

  try {
    await startGenerationAttempt({
      imageRef,
      status: 'regenerating',
      startedMs,
      requestedBy,
      trigger: 'manager-regenerate',
    });

    const sourceImage = await getSourceImageDataUrlForRegeneration(imageData);

    await generatePackageFromSource({
      imageId,
      imageRef,
      profile,
      sourceImage,
      startedMs,
      requestedBy,
      trigger: 'manager-regenerate',
    });

    return {
      ok: true,
      imageId,
    };
  } catch (error) {
    await recordGenerationFailure({
      imageRef,
      profile,
      error,
      startedMs,
      trigger: 'manager-regenerate',
    });
    throw error;
  }
}

async function recomposeMainImage({
  imageId,
  composition = {},
  requestedBy,
  sendWhatsApp = true,
}) {
  const imageRef = getImageRef(imageId);
  const imageSnap = await imageRef.get();

  if (!imageSnap.exists) {
    throw clientError('image_not_found', 'Imagem nao encontrada para recompor.');
  }

  const imageData = imageSnap.data() || {};
  const profile = getProfileFromImageData(imageData);
  const mainOutput = getMainOutputFromImage(imageData);

  if (!mainOutput) {
    throw clientError('missing_main_output', 'Cartao nao encontrado para recompor.');
  }

  const subjectBuffer = await getMainSubjectBufferForRecomposition(imageData, mainOutput);
  const composed = await composeMainCardFromSubject({
    subjectBuffer,
    composition,
  });
  const now = Timestamp.now();
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const printName = `${mainOutput.id || '01-figurinha-principal'}-manager-${stamp}.png`;
  const printUpload = await uploadBufferToStorage({
    buffer: composed.buffer,
    destination: `images/${imageId}/generated/${printName}`,
    contentType: 'image/png',
    metadata: {
      imageId,
      profileId: profile.id,
      outputId: mainOutput.id || '01-figurinha-principal',
      fileType: 'print-png',
      source: 'manager-recompose',
    },
  });
  const whatsappName = `${mainOutput.id || '01-figurinha-principal'}-manager-${stamp}-whatsapp.png`;
  const whatsappBuffer = await sharp(composed.buffer)
    .resize(MAIN_WHATSAPP_MAX_SIZE, MAIN_WHATSAPP_MAX_SIZE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toBuffer();
  const whatsappUpload = await uploadBufferToStorage({
    buffer: whatsappBuffer,
    destination: `images/${imageId}/generated/${whatsappName}`,
    contentType: 'image/png',
    metadata: {
      imageId,
      profileId: profile.id,
      outputId: mainOutput.id || '01-figurinha-principal',
      fileType: 'whatsapp-png',
      source: 'manager-recompose',
      maxSize: String(MAIN_WHATSAPP_MAX_SIZE),
    },
  });
  const printFile = {
    type: 'print-png',
    name: printName,
    width: MAIN_PRINT_SIZE.width,
    height: MAIN_PRINT_SIZE.height,
    density: MAIN_PRINT_SIZE.density,
    recomposed: true,
    ...printUpload,
  };
  const whatsappFile = {
    type: 'whatsapp-png',
    name: whatsappName,
    maxSize: MAIN_WHATSAPP_MAX_SIZE,
    recomposed: true,
    ...whatsappUpload,
  };
  const keptFiles = Array.isArray(mainOutput.files)
    ? mainOutput.files.filter((file) => file && !['print-png', 'whatsapp-png'].includes(file.type))
    : [];
  const outputId = mainOutput.id || '01-figurinha-principal';

  await imageRef.set({
    status: imageData.status || 'completed',
    updatedAt: now,
    params: {
      ...(imageData.params || {}),
      mainBackground: composition.background || composition.mainBackground || composed.layout.background,
      mainImageLeft: String(composed.layout.imageLeft),
      mainImageTop: String(composed.layout.imageTop),
      mainImageWidth: String(composed.layout.imageWidth),
      mainImageHeight: String(composed.layout.imageHeight),
      mainImageFit: composed.layout.imageFit,
    },
    mainComposition: composed.layout,
    outputs: {
      [outputId]: {
        ...mainOutput,
        id: outputId,
        kind: 'main',
        status: 'ready',
        files: [printFile, whatsappFile, ...keptFiles],
        composition: composed.layout,
        recomposedAt: now,
        recomposedBy: requestedBy || '',
        updatedAt: now,
      },
    },
  }, { merge: true });

  let messageSid = '';

  if (sendWhatsApp && profile.whatsAppAddress) {
    try {
      const message = await sendWhatsAppMedia(profile.whatsAppAddress, {
        mediaUrl: whatsappFile.signedUrl,
      });
      messageSid = message.sid || '';

      await imageRef.set({
        deliveries: {
          [outputId]: {
            status: 'sent',
            messageSid,
            fileType: whatsappFile.type,
            sentAt: Timestamp.now(),
            source: 'manager-recompose',
          },
        },
        updatedAt: Timestamp.now(),
      }, { merge: true });
    } catch (error) {
      console.error(`[whatsapp] failed to send recomposed ${outputId}`, error);
      await imageRef.set({
        deliveries: {
          [outputId]: {
            status: 'failed',
            fileType: whatsappFile.type,
            error: publicError(error),
            failedAt: Timestamp.now(),
            source: 'manager-recompose',
          },
        },
        updatedAt: Timestamp.now(),
      }, { merge: true });
    }
  }

  return {
    ok: true,
    imageId,
    outputId,
    composition: composed.layout,
    files: [printFile, whatsappFile],
    messageSid,
  };
}

async function resendStickerOutput({
  imageId,
  outputId,
  requestedBy,
}) {
  const imageRef = getImageRef(imageId);
  const imageSnap = await imageRef.get();

  if (!imageSnap.exists) {
    throw clientError('image_not_found', 'Imagem nao encontrada para reenvio.');
  }

  const imageData = imageSnap.data() || {};
  const profile = getProfileFromImageData(imageData);
  const output = imageData.outputs && imageData.outputs[outputId];

  if (!profile.whatsAppAddress) {
    throw clientError('missing_profile_address', 'Imagem sem WhatsApp de destino para reenvio.');
  }

  if (!output || output.kind !== 'sticker' || !Array.isArray(output.files)) {
    throw clientError('sticker_not_found', 'Sticker nao encontrado para reenvio.');
  }

  const file = getStickerDeliveryFile(output);

  if (!file || !file.signedUrl) {
    throw clientError('sticker_file_not_found', 'Arquivo do sticker nao encontrado para reenvio.');
  }

  const message = await sendWhatsAppMedia(profile.whatsAppAddress, {
    mediaUrl: file.signedUrl,
  });
  const now = Timestamp.now();

  await imageRef.set({
    updatedAt: now,
    resends: {
      [outputId]: {
        status: 'sent',
        requestedBy: requestedBy || '',
        messageSid: message.sid || '',
        fileType: file.type || '',
        sentAt: now,
      },
    },
  }, { merge: true });

  return {
    ok: true,
    imageId,
    outputId,
    messageSid: message.sid || '',
  };
}

async function resendGeneratedStickersForProfile({
  profile,
  requestedBy,
}) {
  const t = await getCurrentEventTranslator();
  const destination = profile && profile.whatsAppAddress
    ? toWhatsAppAddress(profile.whatsAppAddress)
    : '';

  if (!profile || !profile.id || !destination) {
    console.warn('[whatsapp] sticker resend ignored: missing profile destination');
    return {
      ok: false,
      sent: 0,
      failed: 0,
      total: 0,
    };
  }

  const imagesSnap = await getEventRef()
    .collection('images')
    .where('profileId', '==', profile.id)
    .get();
  const images = [];

  imagesSnap.forEach((doc) => {
    images.push({
      ref: doc.ref,
      id: doc.id,
      data: doc.data() || {},
    });
  });

  images.sort((a, b) => timestampToMillis(a.data.createdAt) - timestampToMillis(b.data.createdAt));

  const stickers = images.flatMap((image) => {
    const outputs = image.data.outputs || {};

    return Object.entries(outputs)
      .map(([outputId, output]) => ({
        imageRef: image.ref,
        imageId: image.id,
        outputId,
        output,
        file: getStickerDeliveryFile(output),
      }))
      .filter((item) => (
        item.output
        && item.output.kind === 'sticker'
        && item.file
        && item.file.signedUrl
      ));
  });

  const requestTimestamp = Timestamp.now();

  await getProfileRef(profile.id).set({
    lastStickerResendRequest: {
      keyword: 'STICKERS',
      requestedBy: requestedBy || '',
      requestedAt: requestTimestamp,
      found: stickers.length,
    },
    updatedAt: requestTimestamp,
  }, { merge: true });

  if (!stickers.length) {
    await sendWhatsAppText(
      destination,
      t('stickerResendEmpty'),
    );

    return {
      ok: true,
      sent: 0,
      failed: 0,
      total: 0,
    };
  }

  let sent = 0;
  let failed = 0;

  for (const item of stickers) {
    try {
      const message = await sendWhatsAppMedia(destination, {
        mediaUrl: item.file.signedUrl,
      });
      sent += 1;

      await item.imageRef.set({
        updatedAt: Timestamp.now(),
        resends: {
          [item.outputId]: {
            status: 'sent',
            requestedBy: requestedBy || '',
            keyword: 'STICKERS',
            messageSid: message.sid || '',
            fileType: item.file.type || '',
            sentAt: Timestamp.now(),
          },
        },
      }, { merge: true });
    } catch (error) {
      failed += 1;
      console.error(`[whatsapp] failed to resend sticker ${item.imageId}/${item.outputId}`, error);

      await item.imageRef.set({
        updatedAt: Timestamp.now(),
        resends: {
          [item.outputId]: {
            status: 'failed',
            requestedBy: requestedBy || '',
            keyword: 'STICKERS',
            fileType: item.file.type || '',
            error: publicError(error),
            errorDetails: detailedError(error),
            failedAt: Timestamp.now(),
          },
        },
      }, { merge: true });
    }
  }

  const summary = failed > 0
    ? t('stickerResendPartial', { sent, failed })
    : t('stickerResendSuccess', { sent });

  await sendWhatsAppText(destination, summary);

  await getProfileRef(profile.id).set({
    lastStickerResendRequest: {
      keyword: 'STICKERS',
      requestedBy: requestedBy || '',
      requestedAt: requestTimestamp,
      completedAt: Timestamp.now(),
      found: stickers.length,
      sent,
      failed,
    },
    updatedAt: Timestamp.now(),
  }, { merge: true });

  return {
    ok: failed === 0,
    sent,
    failed,
    total: stickers.length,
  };
}

async function generatePackageFromSource({
  imageId,
  imageRef,
  profile,
  sourceImage,
  startedMs,
  requestedBy,
  trigger,
}) {
  const generationParams = {
    participantName: profile.profileName || 'Participante',
    phoneNumber: profile.phoneNumber || '',
    whatsAppAddress: profile.whatsAppAddress || '',
    waId: profile.waId || '',
    jerseyNumber: '',
    country: 'Brasil',
    position: 'Craque da torcida',
    personality: 'confiante, alegre e carismatico',
  };
  const mainSpec = getImageSpecSummaries().find((spec) => spec.kind === 'main');
  const printAutomation = await ensureEventPrintAutomationConfig();

  await imageRef.set({
    status: 'generating-main',
    generation: {
      lastRequestedBy: requestedBy || '',
      lastTrigger: trigger || '',
    },
    updatedAt: Timestamp.now(),
  }, { merge: true });

  const mainResult = await generateWorldCupImage({
    sourceImage,
    params: generationParams,
    specId: mainSpec.id,
    queueStickerSheet: false,
  });
  const runId = mainResult.runId;
  const mainOutput = await uploadAndSendOutput({
    imageRef,
    imageId,
    profile,
    runId,
    output: mainResult.output,
  });

  await imageRef.set({
    status: 'generating-stickers',
    runId,
    generatedPublicPath: `/generated/${runId}/`,
    params: generationParams,
    updatedAt: Timestamp.now(),
  }, { merge: true });

  if (printAutomation.autoPrintMainOnReady) {
    await createPrintRequest({
      imageId,
      type: 'main',
      profile,
      source: trigger === 'manager-regenerate' ? 'regenerate-main' : 'automatic-main',
      requestedBy: requestedBy || 'system',
      file: mainOutput.printFile || mainOutput.deliveryFile,
    });
  }

  const stickerSpecs = getImageSpecSummaries().filter((spec) => spec.kind === 'sticker');
  const stickerResults = await Promise.all(stickerSpecs.map((spec) => generateWorldCupImage({
    params: generationParams,
    specId: spec.id,
    runId,
    queueStickerSheet: false,
  })
    .then((result) => uploadAndSendOutput({
      imageRef,
      imageId,
      profile,
      runId,
      output: result.output,
    }))
    .then(() => ({ ok: true, id: spec.id }))
    .catch(async (error) => {
      console.error(`[whatsapp] failed to generate ${spec.id}`, error);
      await imageRef.set({
        status: 'completed-with-errors',
        updatedAt: Timestamp.now(),
        errors: {
          [spec.id]: publicError(error),
        },
        errorDetails: {
          [spec.id]: detailedError(error),
        },
      }, { merge: true });
      return {
        ok: false,
        id: spec.id,
        error: publicError(error),
      };
    })));

  const failed = stickerResults.filter((item) => !item.ok);
  const stickerSheet = await ensureStickerSheetForRun(runId, {
    params: generationParams,
    queueStickerSheet: false,
  });
  const stickerSheetUpload = await uploadFileToStorage({
    localPath: getGeneratedFilePath(runId, STICKER_SHEET_FILENAME),
    destination: `images/${imageId}/print/${STICKER_SHEET_FILENAME}`,
    contentType: 'image/png',
    metadata: {
      imageId,
      profileId: profile.id,
      type: 'sticker-sheet',
    },
  });

  await imageRef.set({
    status: failed.length ? 'completed-with-errors' : 'completed',
    completedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    stickerSheet: {
      ...stickerSheet,
      ...stickerSheetUpload,
    },
    stats: {
      failedStickers: failed.length,
    },
  }, { merge: true });

  if (failed.length) {
    const partialError = new Error(`${failed.length} sticker(s) falharam durante a geracao.`);
    partialError.code = 'partial_sticker_generation_failed';
    partialError.publicMessage = 'Algumas figurinhas nao puderam ser geradas.';
    await notifyGenerationFailure({
      imageRef,
      profile,
      error: partialError,
      now: Timestamp.now(),
    });
  }

  await recordGenerationSuccess({
    imageRef,
    imageId,
    profile,
    startedMs,
    trigger,
  });

  if (printAutomation.autoPrintStickerSheetOnReady) {
    await createPrintRequest({
      imageId,
      type: 'stickers',
      profile,
      source: trigger === 'manager-regenerate' ? 'regenerate-stickers' : 'automatic-stickers',
      requestedBy: requestedBy || 'system',
      file: {
        ...stickerSheet,
        ...stickerSheetUpload,
      },
    });
  }
}

async function uploadAndSendOutput({
  imageRef,
  imageId,
  profile,
  runId,
  output,
}) {
  const uploadedFiles = [];

  for (const file of output.files) {
    const localPath = getGeneratedFilePath(runId, file.name);
    const upload = await uploadFileToStorage({
      localPath,
      destination: `images/${imageId}/generated/${file.name}`,
      contentType: contentTypeForGeneratedFile(file),
      metadata: {
        imageId,
        profileId: profile.id,
        outputId: output.id,
        fileType: file.type,
      },
    });

    uploadedFiles.push({
      ...file,
      ...upload,
    });
  }

  if (output.kind === 'main') {
    const mainDeliveryFile = await createMainWhatsAppDeliveryFile({
      imageId,
      profile,
      runId,
      output,
      uploadedFiles,
    });

    if (mainDeliveryFile) {
      uploadedFiles.push(mainDeliveryFile);
    }
  }

  const imageRecord = {
    id: output.id,
    title: output.title,
    kind: output.kind,
    status: 'ready',
    provider: output.provider,
    files: uploadedFiles,
    prompt: output.prompt,
    updatedAt: Timestamp.now(),
  };

  await imageRef.set({
    updatedAt: Timestamp.now(),
    outputs: {
      [output.id]: imageRecord,
    },
  }, { merge: true });

  const printFile = uploadedFiles.find((file) => file.type === 'print-png') || null;
  const deliveryFile = output.kind === 'main'
    ? uploadedFiles.find((file) => file.type === 'whatsapp-png')
      || printFile
    : uploadedFiles.find((file) => file.type === 'webp');

  if (deliveryFile) {
    try {
      const message = await sendWhatsAppMedia(profile.whatsAppAddress, {
        mediaUrl: deliveryFile.signedUrl,
      });

      await imageRef.set({
        deliveries: {
          [output.id]: {
            status: 'sent',
            messageSid: message.sid || '',
            fileType: deliveryFile.type || '',
            sentAt: Timestamp.now(),
          },
        },
        updatedAt: Timestamp.now(),
      }, { merge: true });
    } catch (error) {
      console.error(`[whatsapp] failed to send ${output.id}`, error);
      await imageRef.set({
        deliveries: {
          [output.id]: {
            status: 'failed',
            fileType: deliveryFile.type || '',
            error: publicError(error),
            failedAt: Timestamp.now(),
          },
        },
        updatedAt: Timestamp.now(),
      }, { merge: true });
    }
  }

  return {
    imageRecord,
    deliveryFile,
    printFile,
  };
}

async function createMainWhatsAppDeliveryFile({
  imageId,
  profile,
  runId,
  output,
}) {
  const printFile = output.files.find((file) => file.type === 'print-png');

  if (!printFile) {
    return null;
  }

  const localPath = getGeneratedFilePath(runId, printFile.name);
  const buffer = await sharp(localPath)
    .resize(MAIN_WHATSAPP_MAX_SIZE, MAIN_WHATSAPP_MAX_SIZE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toBuffer();
  const name = `${output.id}-whatsapp.png`;
  const upload = await uploadBufferToStorage({
    buffer,
    destination: `images/${imageId}/generated/${name}`,
    contentType: 'image/png',
    metadata: {
      imageId,
      profileId: profile.id,
      outputId: output.id,
      fileType: 'whatsapp-png',
      maxSize: String(MAIN_WHATSAPP_MAX_SIZE),
    },
  });

  return {
    name,
    type: 'whatsapp-png',
    width: null,
    height: null,
    ...upload,
  };
}

async function createPrintRequest({
  imageId,
  type = 'stickers',
  profile = {},
  source,
  requestedBy,
  declined = false,
  file,
}) {
  const t = await getCurrentEventTranslator();
  const cleanType = type === 'main' ? 'main' : 'stickers';
  const imageRef = getImageRef(imageId);
  const imageSnap = await imageRef.get();

  if (!imageSnap.exists) {
    return {
      ok: false,
      message: 'Nao encontrei essa imagem para impressao. Avise a equipe do evento.',
    };
  }

  if (declined) {
    await imageRef.set({
      stickersPrintDeclinedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }, { merge: true });

    return {
      ok: true,
      message: 'Tudo bem. Nao vou enviar os stickers para impressao.',
    };
  }

  const imageData = imageSnap.data();
  const selectedFile = file || getPrintFileFromImage(imageData, cleanType);
  const printId = `${imageId}_${cleanType}`;
  const now = Timestamp.now();
  const status = selectedFile ? 'pending' : 'waiting-file';
  const printRef = getEventRef().collection('prints').doc(printId);
  const printSnap = await printRef.get();
  const isNew = !printSnap.exists;
  const pendingFilename = cleanType === 'stickers' && selectedFile && selectedFile.storagePath
    ? buildPendingFilename(printId, selectedFile.storagePath, now)
    : null;

  await printRef.set({
    printId,
    imageId,
    profileId: imageData.profileId || profile.id || '',
    type: cleanType,
    mode: cleanType === 'main' ? 'automatic' : 'manual-folder',
    profile: {
      phoneNumber: imageData.profile && imageData.profile.phoneNumber ? imageData.profile.phoneNumber : profile.phoneNumber || '',
      whatsAppAddress: imageData.profile && imageData.profile.whatsAppAddress ? imageData.profile.whatsAppAddress : profile.whatsAppAddress || '',
      profileName: imageData.profile && imageData.profile.profileName ? imageData.profile.profileName : profile.profileName || '',
      waId: imageData.profile && imageData.profile.waId ? imageData.profile.waId : profile.waId || '',
    },
    file: selectedFile || null,
    status,
    pendingFilename,
    localPendingPath: null,
    queuedAt: null,
    source,
    requestedBy,
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
        status,
        requestedAt: now,
        requestCount: FieldValue.increment(1),
      },
    },
  }, { merge: true });

  if (isNew) {
    await incrementPrintRequestedCounters({
      profileId: imageData.profileId || profile.id || '',
      type: cleanType,
      now,
    });
  }

  return {
    ok: true,
    printId,
    message: cleanType === 'main'
      ? t('printRequestMain')
      : t('printRequestStickers'),
  };
}

async function createImageRecord({
  imageId,
  profile,
  messageData,
  accepted = true,
  status = 'received',
  rejection,
}) {
  const now = Timestamp.now();
  const imageRef = getImageRef(imageId);
  const imageSnap = await imageRef.get();
  const isNew = !imageSnap.exists;
  const imageRecord = {
    imageId,
    profileId: profile.id,
    profile: {
      phoneNumber: profile.phoneNumber,
      whatsAppAddress: profile.whatsAppAddress,
      profileName: profile.profileName || '',
      waId: profile.waId || '',
    },
    eventId: getEventId(),
    messageSid: imageId,
    smsMessageSid: messageData.SmsMessageSid || '',
    mediaUrl: messageData.MediaUrl0 || '',
    mediaContentType: messageData.MediaContentType0 || '',
    numMedia: messageData.NumMedia || '0',
    webhookParams: sanitizeForFirestore(messageData),
    updatedAt: now,
  };

  if (isNew) {
    imageRecord.status = status;
    imageRecord.createdAt = now;
    imageRecord.accepted = accepted;
  } else {
    imageRecord.lastReceivedAt = now;
  }

  if (rejection) {
    imageRecord.rejection = rejection;
    imageRecord.rejectedAt = now;
  }

  await Promise.all([
    getEventRef().set({
      eventId: getEventId(),
      updatedAt: now,
    }, { merge: true }),
    imageRef.set(imageRecord, { merge: true }),
    getProfileRef(profile.id).set({
      latestImageId: imageId,
      updatedAt: now,
    }, { merge: true }),
  ]);

  if (isNew && accepted) {
    await incrementImageSubmittedCounters({
      profileId: profile.id,
      now,
    });
  }
}

async function upsertProfile(messageData = {}) {
  const phoneNumber = limpaNumero(messageData.From);
  const id = createPhoneProfileId(messageData.From);
  const profileRef = getProfileRef(id);
  const snap = await profileRef.get();
  const existingData = snap.exists ? snap.data() || {} : {};
  const now = Timestamp.now();
  const profile = {
    id,
    phoneNumber,
    whatsAppAddress: toWhatsAppAddress(messageData.From),
    profileName: String(messageData.ProfileName || '').trim(),
    waId: String(messageData.WaId || '').trim(),
  };

  await profileRef.set({
    ...(snap.exists ? {} : {
      createdAt: now,
      unlimited: false,
      stats: {
        imagesSubmitted: 0,
        photosGenerated: 0,
        generation: {
          completedCount: 0,
          totalDurationMs: 0,
          totalReceivedToCompletedMs: 0,
          receivedToCompletedCount: 0,
        },
        prints: {
          mainRequested: 0,
          stickersRequested: 0,
          mainPrinted: 0,
          stickersPrinted: 0,
          totalPrinted: 0,
        },
      },
    }),
    ...(existingData.unlimited === undefined ? { unlimited: false } : {}),
    ...profile,
    whatsappProfile: {
      profileName: profile.profileName,
      waId: profile.waId,
      rawFrom: messageData.From || '',
    },
    updatedAt: now,
  }, { merge: true });

  return profile;
}

function getPrintFileFromImage(imageData, type) {
  if (type === 'stickers') {
    return imageData.stickerSheet || null;
  }

  const main = imageData.outputs && imageData.outputs['01-figurinha-principal'];

  if (!main || !Array.isArray(main.files)) {
    return null;
  }

  return main.files.find((item) => item.type === 'print-png') || null;
}

function getMainOutputFromImage(imageData = {}) {
  const outputs = imageData.outputs || {};

  return outputs['01-figurinha-principal']
    || Object.values(outputs).find((output) => output && output.kind === 'main')
    || null;
}

async function getMainSubjectBufferForRecomposition(imageData = {}, mainOutput = {}) {
  const subjectFile = Array.isArray(mainOutput.files)
    ? mainOutput.files.find((file) => file && file.type === 'subject-png')
    : null;

  if (subjectFile && subjectFile.signedUrl) {
    const remote = await downloadPublicBuffer(subjectFile.signedUrl);
    return remote.buffer;
  }

  const runId = imageData.runId || '';

  if (runId) {
    const subjectPath = path.join(
      SERVER_ROOT,
      'public',
      'generated',
      runId,
      '01-figurinha-principal-subject.png',
    );

    try {
      return await fs.readFile(subjectPath);
    } catch (error) {
      console.warn('[manager] local subject unavailable for recomposition:', subjectPath);
    }
  }

  throw clientError('missing_subject_image', 'Arquivo subject-png do cartao nao encontrado.');
}

function getImageRef(imageId) {
  return getEventRef().collection('images').doc(imageId);
}

function getProfileRef(profileId) {
  return getEventRef().collection('profiles').doc(profileId);
}

async function ensureEventPrintLimit() {
  const eventRef = getEventRef();
  const snap = await eventRef.get();
  const data = snap.exists ? snap.data() || {} : {};
  const existing = Number(data.printLimitPerProfile);
  const hasExisting = Number.isFinite(existing) && existing >= 0;
  const limit = hasExisting ? existing : DEFAULT_PRINT_LIMIT_PER_PROFILE;

  if (!hasExisting || data.eventId !== getEventId()) {
    const payload = {
      eventId: getEventId(),
      updatedAt: Timestamp.now(),
    };

    if (!hasExisting) {
      payload.printLimitPerProfile = limit;
    }

    await eventRef.set(payload, { merge: true });
  }

  return limit;
}

async function ensureEventPrintAutomationConfig() {
  const eventRef = getEventRef();
  const snap = await eventRef.get();
  const data = snap.exists ? snap.data() || {} : {};
  const hasMainConfig = typeof data.autoPrintMainOnReady === 'boolean';
  const hasStickerSheetConfig = typeof data.autoPrintStickerSheetOnReady === 'boolean';
  const autoPrintMainOnReady = hasMainConfig
    ? data.autoPrintMainOnReady
    : DEFAULT_AUTO_PRINT_ON_GENERATION;
  const autoPrintStickerSheetOnReady = hasStickerSheetConfig
    ? data.autoPrintStickerSheetOnReady
    : DEFAULT_AUTO_PRINT_ON_GENERATION;

  if (!hasMainConfig || !hasStickerSheetConfig || data.eventId !== getEventId()) {
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

    await eventRef.set(payload, { merge: true });
  }

  return {
    autoPrintMainOnReady,
    autoPrintStickerSheetOnReady,
  };
}

async function checkProfileImageLimit(profileId) {
  const limit = await ensureEventPrintLimit();
  const snap = await getProfileRef(profileId).get();
  const data = snap.exists ? snap.data() || {} : {};

  if (data.unlimited === true) {
    return {
      allowed: true,
      limit,
      used: Number(data.stats && data.stats.imagesSubmitted) || 0,
      unlimited: true,
    };
  }

  const used = Number(data.stats && data.stats.imagesSubmitted) || 0;

  return {
    allowed: used < limit,
    limit,
    used,
    unlimited: false,
  };
}

async function incrementImageSubmittedCounters({
  profileId,
  now,
}) {
  await Promise.all([
    getEventRef().set({
      updatedAt: now,
      stats: {
        imagesSubmitted: FieldValue.increment(1),
      },
    }, { merge: true }),
    getProfileRef(profileId).set({
      updatedAt: now,
      stats: {
        imagesSubmitted: FieldValue.increment(1),
      },
    }, { merge: true }),
  ]);
}

async function startGenerationAttempt({
  imageRef,
  status,
  startedMs,
  requestedBy,
  trigger,
}) {
  await imageRef.set({
    status,
    updatedAt: Timestamp.now(),
    generation: {
      active: true,
      lastStartedAt: Timestamp.fromMillis(startedMs),
      lastRequestedBy: requestedBy || '',
      lastTrigger: trigger || '',
      lastStatus: 'running',
      attempts: FieldValue.increment(1),
    },
  }, { merge: true });
}

async function recordGenerationSuccess({
  imageRef,
  imageId,
  profile,
  startedMs,
  trigger,
}) {
  const snap = await imageRef.get();
  const data = snap.exists ? snap.data() || {} : {};
  const completedMs = Date.now();
  const durationMs = Math.max(0, completedMs - startedMs);
  const createdMs = timestampToMillis(data.createdAt);
  const receivedToCompletedMs = createdMs ? Math.max(0, completedMs - createdMs) : null;
  const now = Timestamp.fromMillis(completedMs);
  const profileId = profile.id || data.profileId || '';

  await Promise.all([
    imageRef.set({
      latestGeneratedAt: now,
      updatedAt: now,
      generation: {
        active: false,
        lastStatus: 'completed',
        lastCompletedAt: now,
        lastDurationMs: durationMs,
        lastReceivedToCompletedMs: receivedToCompletedMs,
        lastTrigger: trigger || '',
        successCount: FieldValue.increment(1),
      },
    }, { merge: true }),
    incrementGenerationCounters({
      profileId,
      imageId,
      durationMs,
      receivedToCompletedMs,
      now,
    }),
  ]);
}

async function recordGenerationFailure({
  imageRef,
  profile,
  error,
  startedMs,
  trigger,
}) {
  const failedMs = Date.now();
  const durationMs = Math.max(0, failedMs - startedMs);
  const now = Timestamp.fromMillis(failedMs);
  const profileId = profile && profile.id ? profile.id : '';

  await imageRef.set({
    status: 'error',
    error: publicError(error),
    errorDetails: detailedError(error),
    updatedAt: now,
    generation: {
      active: false,
      lastStatus: 'error',
      lastFailedAt: now,
      lastDurationMs: durationMs,
      lastTrigger: trigger || '',
      lastError: publicError(error),
      lastErrorDetails: detailedError(error),
    },
  }, { merge: true });

  await notifyGenerationFailure({
    imageRef,
    profile,
    error,
    now,
  });

  if (profileId) {
    await getProfileRef(profileId).set({
      updatedAt: now,
      stats: {
        generation: {
          failedCount: FieldValue.increment(1),
        },
      },
    }, { merge: true });
  }
}

async function notifyGenerationFailure({
  imageRef,
  profile,
  error,
  now,
}) {
  if (!profile || !profile.whatsAppAddress) {
    return;
  }

  try {
    const t = await getCurrentEventTranslator();
    const message = await sendWhatsAppText(
      profile.whatsAppAddress,
      t('generationFailure'),
    );

    await imageRef.set({
      errorNotification: {
        status: 'sent',
        messageSid: message.sid || '',
        sentAt: now,
      },
      updatedAt: now,
    }, { merge: true });
  } catch (notificationError) {
    console.error('[whatsapp] failed to notify generation failure', notificationError);
    await imageRef.set({
      errorNotification: {
        status: 'failed',
        error: publicError(notificationError),
        errorDetails: detailedError(notificationError),
        failedAt: now,
      },
      updatedAt: now,
    }, { merge: true });
  }
}

async function incrementGenerationCounters({
  profileId,
  imageId,
  durationMs,
  receivedToCompletedMs,
  now,
}) {
  const generationStats = {
    completedCount: FieldValue.increment(1),
    totalDurationMs: FieldValue.increment(durationMs),
  };

  if (receivedToCompletedMs !== null) {
    generationStats.totalReceivedToCompletedMs = FieldValue.increment(receivedToCompletedMs);
    generationStats.receivedToCompletedCount = FieldValue.increment(1);
  }

  const writes = [
    getEventRef().set({
      updatedAt: now,
      stats: {
        photosGenerated: FieldValue.increment(1),
        generation: generationStats,
      },
    }, { merge: true }),
  ];

  if (profileId) {
    writes.push(getProfileRef(profileId).set({
      latestGeneratedImageId: imageId,
      updatedAt: now,
      stats: {
        photosGenerated: FieldValue.increment(1),
        generation: generationStats,
      },
    }, { merge: true }));
  }

  await Promise.all(writes);
}

function getProfileFromImageData(imageData = {}) {
  const profile = imageData.profile || {};
  const destination = profile.whatsAppAddress || profile.phoneNumber || '';

  return {
    id: imageData.profileId || '',
    phoneNumber: profile.phoneNumber || '',
    whatsAppAddress: destination ? toWhatsAppAddress(destination) : '',
    profileName: profile.profileName || '',
    waId: profile.waId || '',
  };
}

async function getSourceImageDataUrlForRegeneration(imageData = {}) {
  const source = imageData.source || {};
  const localPath = source.optimizedLocalPath || source.originalLocalPath || '';

  if (localPath) {
    const absolutePath = path.isAbsolute(localPath)
      ? localPath
      : path.join(PROJECT_ROOT, localPath);

    try {
      const buffer = await fs.readFile(absolutePath);
      const mimeType = source.optimizedLocalPath ? 'image/jpeg' : contentTypeFromPath(absolutePath);
      return toDataUrl(buffer, mimeType);
    } catch (error) {
      console.warn('[whatsapp] local source unavailable for regeneration:', absolutePath);
    }
  }

  const storageUrl = source.optimizedStorage && source.optimizedStorage.signedUrl
    ? source.optimizedStorage.signedUrl
    : source.originalStorage && source.originalStorage.signedUrl
      ? source.originalStorage.signedUrl
      : '';

  if (storageUrl) {
    const remote = await downloadPublicBuffer(storageUrl);
    const buffer = remote.mimeType.startsWith('image/jpeg')
      ? remote.buffer
      : await optimizeIncomingImage(remote.buffer);
    return toDataUrl(buffer, 'image/jpeg');
  }

  const webhookParams = imageData.webhookParams || {};
  const mediaUrl = imageData.mediaUrl || webhookParams.MediaUrl0 || '';

  if (mediaUrl) {
    const media = await downloadTwilioMedia(mediaUrl);
    return toDataUrl(await optimizeIncomingImage(media.buffer), 'image/jpeg');
  }

  throw clientError('missing_source_image', 'Nao encontrei a imagem original para regerar.');
}

async function downloadPublicBuffer(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw clientError('source_download_failed', `Falha ao baixar fonte para regeracao: HTTP ${response.status}.`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get('content-type') || 'application/octet-stream',
  };
}

function toDataUrl(buffer, mimeType) {
  return `data:${mimeType || 'image/jpeg'};base64,${buffer.toString('base64')}`;
}

function contentTypeFromPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.png') {
    return 'image/png';
  }

  if (extension === '.webp') {
    return 'image/webp';
  }

  return 'image/jpeg';
}

function buildPendingFilename(printId, storagePath, timestamp) {
  const millis = timestamp && typeof timestamp.toMillis === 'function'
    ? timestamp.toMillis()
    : Date.now();
  return `${printId}-${millis}-${path.basename(storagePath)}`
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function timestampToMillis(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return value;
  }

  return null;
}

async function incrementPrintRequestedCounters({
  profileId,
  type,
  now,
}) {
  const printStats = {
    totalRequested: FieldValue.increment(1),
  };
  const key = type === 'main' ? 'mainRequested' : 'stickersRequested';
  printStats[key] = FieldValue.increment(1);

  const writes = [
    getEventRef().set({
      updatedAt: now,
      stats: {
        printRequested: FieldValue.increment(1),
        prints: printStats,
      },
    }, { merge: true }),
  ];

  if (profileId) {
    writes.push(getProfileRef(profileId).set({
      updatedAt: now,
      stats: {
        prints: printStats,
      },
    }, { merge: true }));
  }

  await Promise.all(writes);
}

function sanitizeForFirestore(value) {
  if (value === undefined) {
    return null;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item));
  }

  return Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [key, sanitizeForFirestore(item)]));
}

function getInboundImageId(messageData = {}) {
  const sid = messageData.MessageSid || messageData.SmsMessageSid || messageData.SmsSid || '';
  return /^[a-zA-Z0-9_-]{8,160}$/.test(sid) ? sid : '';
}

function hasImageMedia(messageData = {}) {
  const count = Number(messageData.NumMedia || 0);
  const type = String(messageData.MediaContentType0 || '').toLowerCase();

  return count > 0 && (type.startsWith('image/') || messageData.MessageType === 'image' || messageData.MediaUrl0);
}

function isStickerResendKeyword(messageData = {}) {
  const body = String(messageData.Body || '')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  return body === 'STICKERS';
}

function getStickerDeliveryFile(output = {}) {
  if (!output || !Array.isArray(output.files)) {
    return null;
  }

  return output.files.find((item) => item && item.type === 'webp' && item.signedUrl)
    || output.files.find((item) => item && item.signedUrl)
    || null;
}

async function optimizeIncomingImage(buffer) {
  try {
    return await sharp(buffer)
      .rotate()
      .resize(SOURCE_IMAGE_MAX_SIZE, SOURCE_IMAGE_MAX_SIZE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({
        quality: SOURCE_IMAGE_QUALITY,
        mozjpeg: true,
      })
      .toBuffer();
  } catch (error) {
    throw clientError('invalid_source_image', 'Nao foi possivel ler a imagem enviada.');
  }
}

function extensionForContentType(contentType) {
  const type = String(contentType || '').toLowerCase();

  if (type.includes('png')) {
    return 'png';
  }

  if (type.includes('webp')) {
    return 'webp';
  }

  return 'jpg';
}

function contentTypeForGeneratedFile(file) {
  if (file.type === 'webp' || file.name.endsWith('.webp')) {
    return 'image/webp';
  }

  return 'image/png';
}

function publicError(error) {
  return {
    code: error.code || 'server_error',
    message: error.publicMessage || error.message || 'Falha ao processar.',
  };
}

function detailedError(error) {
  return {
    code: error.code || 'server_error',
    name: error.name || 'Error',
    message: error.message || error.publicMessage || 'Falha ao processar.',
    publicMessage: error.publicMessage || '',
    stack: error.stack || '',
  };
}

function clientError(code, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = 400;
  error.code = code;
  error.publicMessage = publicMessage;
  return error;
}

function sendTwiml(res, twiml) {
  return res.type('text/xml').send(twiml.toString()).end();
}

function runInBackground(task) {
  setImmediate(() => {
    Promise.resolve()
      .then(task)
      .catch((error) => console.error('[whatsapp] background task failed', error));
  });
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

module.exports = {
  createPrintRequest,
  ensureEventPrintAutomationConfig,
  ensureEventPrintLimit,
  handleWhatsAppWebhook,
  recomposeMainImage,
  regenerateImagePackage,
  resendStickerOutput,
};
