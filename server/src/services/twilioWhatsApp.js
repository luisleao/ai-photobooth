const { AsyncLocalStorage } = require('node:async_hooks');
const twilio = require('twilio');
const { loadEnv } = require('./env');
const { limpaNumero } = require('./phone');

loadEnv();

const twilioContext = new AsyncLocalStorage();
const clients = new Map();

function createMessagingResponse() {
  return new twilio.twiml.MessagingResponse();
}

function getTwilioClient() {
  const config = getResolvedTwilioConfig();
  const missing = ['accountSid', 'authToken'].filter((key) => !config[key]);

  if (missing.length) {
    throw configurationError('twilio_not_configured', `Twilio nao configurada: ${missing.join(', ')}.`);
  }

  const cacheKey = `${config.accountSid}:${config.authToken}`;

  if (!clients.has(cacheKey)) {
    clients.set(cacheKey, twilio(config.accountSid, config.authToken));
  }

  return clients.get(cacheKey);
}

function getSenderFields() {
  const config = getResolvedTwilioConfig();
  const messagingServiceSid = config.messagingServiceSid || '';
  const from = config.whatsAppFrom || '';

  if (from) {
    return { from: toWhatsAppAddress(from) };
  }

  if (messagingServiceSid.startsWith('MG')) {
    return { messagingServiceSid };
  }

  if (!messagingServiceSid) {
    throw configurationError('twilio_sender_not_configured', 'Configure TWILIO_WHATSAPP_FROM ou TWILIO_MESSAGING_SERVICE_SID.');
  }

  return { from: toWhatsAppAddress(messagingServiceSid) };
}

async function sendWhatsAppText(to, body) {
  return getTwilioClient().messages.create({
    ...getSenderFields(),
    to: toWhatsAppAddress(to),
    body,
  });
}

async function sendWhatsAppMedia(to, {
  body,
  mediaUrl,
}) {
  const payload = {
    ...getSenderFields(),
    to: toWhatsAppAddress(to),
    mediaUrl: Array.isArray(mediaUrl) ? mediaUrl : [mediaUrl],
  };

  if (body) {
    payload.body = body;
  }

  return getTwilioClient().messages.create(payload);
}

async function sendWhatsAppContent(to, {
  contentSid,
  contentVariables,
}) {
  if (!contentSid) {
    throw configurationError('twilio_content_not_configured', 'ContentSid do template nao configurado.');
  }

  return getTwilioClient().messages.create({
    ...getSenderFields(),
    to: toWhatsAppAddress(to),
    contentSid,
    contentVariables: JSON.stringify(contentVariables || {}),
  });
}

async function downloadTwilioMedia(mediaUrl) {
  const config = getResolvedTwilioConfig();
  const missing = ['accountSid', 'authToken'].filter((key) => !config[key]);

  if (missing.length) {
    throw configurationError('twilio_not_configured', `Twilio nao configurada: ${missing.join(', ')}.`);
  }

  const auth = Buffer
    .from(`${config.accountSid}:${config.authToken}`)
    .toString('base64');
  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    throw configurationError('twilio_media_download_failed', `Falha ao baixar midia da Twilio: HTTP ${response.status}.`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
  };
}

function runWithTwilioConfig(config, task) {
  return twilioContext.run({
    config: normalizeTwilioEventConfig(config),
  }, task);
}

function getResolvedTwilioConfig() {
  const env = getEnvTwilioConfig();
  const scoped = twilioContext.getStore();
  const event = normalizeTwilioEventConfig(scoped && scoped.config ? scoped.config : {});

  if (event.mode !== 'custom') {
    return {
      ...env,
      mode: 'default',
      source: 'env',
    };
  }

  return {
    mode: 'custom',
    source: 'event',
    accountSid: event.accountSid || env.accountSid,
    authToken: event.authToken || env.authToken,
    messagingServiceSid: event.messagingServiceSid || env.messagingServiceSid,
    whatsAppFrom: event.whatsAppFrom || env.whatsAppFrom,
  };
}

function getEnvTwilioConfig() {
  return {
    accountSid: String(process.env.TWILIO_ACCOUNT_SID || '').trim(),
    authToken: String(process.env.TWILIO_AUTH_TOKEN || '').trim(),
    messagingServiceSid: String(process.env.TWILIO_MESSAGING_SERVICE_SID
      || process.env.CUSTOMIZE_MESSAGESERVICE_SID
      || '').trim(),
    whatsAppFrom: String(process.env.TWILIO_WHATSAPP_FROM || '').trim(),
  };
}

function normalizeTwilioEventConfig(config = {}) {
  const mode = config.mode === 'custom' ? 'custom' : 'default';

  return {
    mode,
    accountSid: String(config.accountSid || '').trim(),
    authToken: String(config.authToken || '').trim(),
    messagingServiceSid: String(config.messagingServiceSid || '').trim(),
    whatsAppFrom: String(config.whatsAppFrom || config.from || '').trim(),
  };
}

function getTwilioDefaultConfigPublic() {
  const config = getEnvTwilioConfig();

  return {
    configured: Boolean(config.accountSid && config.authToken && (config.messagingServiceSid || config.whatsAppFrom)),
    accountSid: maskSecret(config.accountSid),
    hasAuthToken: Boolean(config.authToken),
    messagingServiceSid: config.messagingServiceSid,
    whatsAppFrom: config.whatsAppFrom,
  };
}

function getTwilioEventConfigPublic(config = {}) {
  const normalized = normalizeTwilioEventConfig(config);

  return {
    mode: normalized.mode,
    accountSid: normalized.accountSid,
    hasAuthToken: Boolean(normalized.authToken),
    messagingServiceSid: normalized.messagingServiceSid,
    whatsAppFrom: normalized.whatsAppFrom,
  };
}

function maskSecret(value) {
  const text = String(value || '').trim();

  if (text.length <= 8) {
    return text ? '****' : '';
  }

  return `${text.slice(0, 4)}****${text.slice(-4)}`;
}

function toWhatsAppAddress(value) {
  const text = String(value || '').trim();

  if (!text) {
    return text;
  }

  if (text.startsWith('whatsapp:')) {
    return text;
  }

  if (text.startsWith('+')) {
    return `whatsapp:${text}`;
  }

  return `whatsapp:+${text.replace(/[^\d]/g, '')}`;
}

function cleanWhatsAppNumber(value) {
  const text = limpaNumero(value).trim();

  if (!text) {
    return '';
  }

  return text.startsWith('+') ? text : `+${text.replace(/[^\d]/g, '')}`;
}

function parsePrintPayload(messageData = {}) {
  const payload = String(messageData.ButtonPayload || '').trim();
  const body = String(messageData.Body || '').trim();
  const candidate = payload || body;
  const match = candidate.match(/^(print|imprimir|skip|nao-imprimir|não-imprimir)[:_\s]+([a-zA-Z0-9_-]{8,160})$/i);

  if (!match) {
    return null;
  }

  const action = match[1].toLowerCase();

  return {
    action: action === 'print' || action === 'imprimir' ? 'print' : 'skip',
    imageId: match[2],
    raw: candidate,
  };
}

function configurationError(code, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = 503;
  error.code = code;
  error.publicMessage = publicMessage;
  return error;
}

module.exports = {
  cleanWhatsAppNumber,
  createMessagingResponse,
  downloadTwilioMedia,
  getSenderFields,
  getTwilioClient,
  parsePrintPayload,
  getTwilioDefaultConfigPublic,
  getTwilioEventConfigPublic,
  normalizeTwilioEventConfig,
  runWithTwilioConfig,
  sendWhatsAppContent,
  sendWhatsAppMedia,
  sendWhatsAppText,
  toWhatsAppAddress,
};
