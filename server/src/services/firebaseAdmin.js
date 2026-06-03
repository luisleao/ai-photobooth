const path = require('node:path');
const { AsyncLocalStorage } = require('node:async_hooks');
const admin = require('firebase-admin');
const { loadEnv } = require('./env');

loadEnv();

const DEFAULT_EVENT_ID = 'photobooth-event';
const SIGNED_URL_EXPIRES = process.env.SIGNED_URL_EXPIRES || '03-09-2491';
const eventContext = new AsyncLocalStorage();

let initialized = false;

function getEventId() {
  const context = eventContext.getStore();
  const scopedEventId = context && context.eventId ? context.eventId : '';

  return cleanId(scopedEventId || process.env.PHOTOBOOTH_EVENT_ID || DEFAULT_EVENT_ID);
}

function getStorageRoot() {
  return cleanStoragePath(process.env.PHOTOBOOTH_STORAGE_ROOT || `events/${getEventId()}`);
}

function initializeFirebaseAdmin() {
  if (initialized && admin.apps.length) {
    return admin.app();
  }

  const missing = getMissingFirebaseConfig();

  if (missing.length) {
    throw configurationError('firebase_not_configured', `Firebase Admin nao configurado: ${missing.join(', ')}.`);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }

  initialized = true;
  return admin.app();
}

function isFirebaseConfigured() {
  return getMissingFirebaseConfig().length === 0;
}

function getDb() {
  initializeFirebaseAdmin();
  return admin.firestore();
}

function getBucket() {
  initializeFirebaseAdmin();
  return admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);
}

function getEventRef() {
  return getDb().collection('events').doc(getEventId());
}

function runWithEventId(eventId, task) {
  const scopedEventId = cleanEventId(eventId, process.env.PHOTOBOOTH_EVENT_ID || DEFAULT_EVENT_ID);

  return eventContext.run({ eventId: scopedEventId }, task);
}

async function uploadBufferToStorage({
  buffer,
  destination,
  contentType = 'application/octet-stream',
  metadata = {},
}) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('uploadBufferToStorage requires a Buffer.');
  }

  const bucket = getBucket();
  const storagePath = joinStoragePath(getStorageRoot(), destination);
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: {
      contentType,
      metadata,
    },
    resumable: false,
  });

  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: SIGNED_URL_EXPIRES,
  });

  return {
    bucket: bucket.name,
    storagePath,
    gsUri: `gs://${bucket.name}/${storagePath}`,
    signedUrl,
  };
}

async function uploadFileToStorage({
  localPath,
  destination,
  contentType,
  metadata,
}) {
  const fs = require('node:fs/promises');
  const buffer = await fs.readFile(localPath);

  return uploadBufferToStorage({
    buffer,
    destination,
    contentType: contentType || inferContentType(localPath),
    metadata,
  });
}

async function downloadStorageFile({
  storagePath,
  localPath,
}) {
  const file = getBucket().file(storagePath);
  const fs = require('node:fs/promises');

  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await file.download({ destination: localPath });

  return localPath;
}

function getFirebasePublicConfig() {
  return {
    apiKey: process.env.FIREBASE_PUBLIC_API_KEY || process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_PUBLIC_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_PUBLIC_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_PUBLIC_APP_ID || process.env.FIREBASE_APP_ID || '',
  };
}

async function verifyFirebaseIdToken(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw clientError('missing_auth_token', 'Token de autenticacao ausente.', 401);
  }

  try {
    return await initializeFirebaseAdmin().auth().verifyIdToken(match[1]);
  } catch (error) {
    throw clientError('invalid_auth_token', 'Token de autenticacao invalido.', 401);
  }
}

function getMissingFirebaseConfig() {
  return [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_STORAGE_BUCKET',
  ].filter((key) => !process.env[key]);
}

function joinStoragePath(...parts) {
  return cleanStoragePath(parts
    .filter(Boolean)
    .join('/'));
}

function cleanStoragePath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');
}

function cleanEventId(value, fallback = DEFAULT_EVENT_ID) {
  return cleanId(value, fallback);
}

function cleanId(value, fallback = DEFAULT_EVENT_ID) {
  return String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function inferContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.png') {
    return 'image/png';
  }

  if (extension === '.webp') {
    return 'image/webp';
  }

  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }

  if (extension === '.html') {
    return 'text/html; charset=utf-8';
  }

  return 'application/octet-stream';
}

function configurationError(code, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = 503;
  error.code = code;
  error.publicMessage = publicMessage;
  return error;
}

function clientError(code, publicMessage, statusCode = 400) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.code = code;
  error.publicMessage = publicMessage;
  return error;
}

module.exports = {
  FieldValue: admin.firestore.FieldValue,
  Timestamp: admin.firestore.Timestamp,
  cleanEventId,
  downloadStorageFile,
  getBucket,
  getDb,
  getEventId,
  getEventRef,
  getFirebasePublicConfig,
  getStorageRoot,
  initializeFirebaseAdmin,
  isFirebaseConfigured,
  joinStoragePath,
  runWithEventId,
  uploadBufferToStorage,
  uploadFileToStorage,
  verifyFirebaseIdToken,
};
