const twilio = require('twilio');
const { loadEnv } = require('./env');
const { limpaNumero } = require('./phone');

loadEnv();

let client;

function createMessagingResponse() {
  return new twilio.twiml.MessagingResponse();
}

function getTwilioClient() {
  if (client) {
    return client;
  }

  const missing = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'].filter((key) => !process.env[key]);

  if (missing.length) {
    throw configurationError('twilio_not_configured', `Twilio nao configurada: ${missing.join(', ')}.`);
  }

  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return client;
}

function getSenderFields() {
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
    || process.env.CUSTOMIZE_MESSAGESERVICE_SID
    || '';

  if (messagingServiceSid.startsWith('MG')) {
    return { messagingServiceSid };
  }

  const from = process.env.TWILIO_WHATSAPP_FROM || messagingServiceSid;

  if (!from) {
    throw configurationError('twilio_sender_not_configured', 'Configure TWILIO_WHATSAPP_FROM ou TWILIO_MESSAGING_SERVICE_SID.');
  }

  return { from: toWhatsAppAddress(from) };
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
  const missing = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'].filter((key) => !process.env[key]);

  if (missing.length) {
    throw configurationError('twilio_not_configured', `Twilio nao configurada: ${missing.join(', ')}.`);
  }

  const auth = Buffer
    .from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`)
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
  sendWhatsAppContent,
  sendWhatsAppMedia,
  sendWhatsAppText,
  toWhatsAppAddress,
};
