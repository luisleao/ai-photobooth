const crypto = require('node:crypto');
const {
  Timestamp,
  getEventId,
  getEventRef,
} = require('./firebaseAdmin');
const {
  getCurrentEventTranslator,
} = require('./eventMessages');
const {
  runWithTwilioConfig,
  sendWhatsAppText,
  toWhatsAppAddress,
} = require('./twilioWhatsApp');

const RAFFLE_RANDOM_KEY_MAX = 1000000000;
const EPOCH_TIMESTAMP = Timestamp.fromMillis(0);
const DEFAULT_WINNER_COUNT = 1;
const MAX_WINNER_COUNT = 50;
const MAX_LAST_HOURS = 24 * 365;
const RESERVOIR_PAGE_SIZE = 500;
const DELETE_BATCH_SIZE = 450;

function createRaffleRandomKey() {
  return crypto.randomInt(0, RAFFLE_RANDOM_KEY_MAX);
}

async function createRaffle({
  mode = 'all',
  startAt,
  endAt,
  lastHours,
  winnerCount = DEFAULT_WINNER_COUNT,
  excludePreviousWinners = true,
  winnerMessage = '',
  requestedBy = '',
}) {
  const eligibility = await resolveRaffleEligibility({
    mode,
    startAt,
    endAt,
    lastHours,
    winnerCount,
    excludePreviousWinners,
  });
  const {
    window,
    cleanWinnerCount,
    shouldExcludePreviousWinners,
    rawEligibleCount,
    excludedPreviousWinnerIds,
    manuallyExcludedIds,
    excludedProfileIds,
    excludedEligibleCount,
    eligibleCount,
  } = eligibility;
  const cleanWinnerMessage = normalizeWinnerMessage(winnerMessage);
  const randomStartKey = createRaffleRandomKey();
  const canUseRandomKeySelection = (
    window.mode === 'all'
    && eligibleCount > 0
    && excludedProfileIds.size === 0
  );
  const randomKeyEligibleCount = canUseRandomKeySelection
    ? await countRandomKeyEligibleProfiles(window)
    : 0;

  assertEnoughEligibleProfiles({
    eligibleCount,
    winnerCount: cleanWinnerCount,
    excludedEligibleCount,
    excludePreviousWinners: shouldExcludePreviousWinners,
  });

  const useRandomKeySelection = (
    canUseRandomKeySelection
    && randomKeyEligibleCount >= eligibleCount
  );
  const winners = useRandomKeySelection
    ? await pickWinnersByRandomKey({
      window,
      randomStartKey,
      winnerCount: cleanWinnerCount,
      excludedWinnerIds: excludedProfileIds,
    })
    : await pickWinnersByReservoir({
      window,
      winnerCount: cleanWinnerCount,
      excludedWinnerIds: excludedProfileIds,
    });

  assertEnoughSelectedWinners({
    selectedCount: winners.length,
    winnerCount: cleanWinnerCount,
    eligibleCount,
  });

  const now = Timestamp.now();
  const raffleRef = getEventRef().collection('raffles').doc();
  const raffleRecord = {
    raffleId: raffleRef.id,
    eventId: getEventId(),
    mode: window.mode,
    startAt: window.startAt || null,
    endAt: window.endAt || null,
    lastHours: window.lastHours || null,
    winnerCount: cleanWinnerCount,
    eligibleCount,
    rawEligibleCount,
    excludePreviousWinners: shouldExcludePreviousWinners,
    excludedPreviousWinnerCount: excludedPreviousWinnerIds.size,
    excludedManualCount: manuallyExcludedIds.size,
    excludedEligibleCount,
    winnerMessage: cleanWinnerMessage || '',
    randomKeyEligibleCount,
    randomStartKey,
    randomKeyMax: RAFFLE_RANDOM_KEY_MAX,
    selectionStrategy: useRandomKeySelection ? 'random-key' : 'reservoir-fallback',
    winners,
    status: 'completed',
    createdAt: now,
    createdBy: requestedBy || '',
    updatedAt: now,
  };

  await raffleRef.set(raffleRecord);
  const notifications = winners.length
    ? await notifyRaffleWinners({
      raffleId: raffleRef.id,
      winners,
      winnerMessage: cleanWinnerMessage,
    })
    : createEmptyNotificationSummary();
  const notifiedWinners = mergeWinnerNotifications(winners, notifications.results);

  raffleRecord.winners = notifiedWinners;
  raffleRecord.winnerNotifications = notifications.summary;
  raffleRecord.updatedAt = Timestamp.now();

  await raffleRef.set({
    winners: notifiedWinners,
    winnerNotifications: notifications.summary,
    updatedAt: raffleRecord.updatedAt,
  }, { merge: true });

  return {
    ok: true,
    raffle: raffleRecord,
  };
}

async function previewRaffleEligibility({
  mode = 'all',
  startAt,
  endAt,
  lastHours,
  winnerCount = DEFAULT_WINNER_COUNT,
  excludePreviousWinners = true,
}) {
  const eligibility = await resolveRaffleEligibility({
    mode,
    startAt,
    endAt,
    lastHours,
    winnerCount,
    excludePreviousWinners,
  });

  return {
    ok: true,
    eventId: getEventId(),
    eligibility: serializeRaffleEligibility(eligibility),
  };
}

async function resolveRaffleEligibility({
  mode = 'all',
  startAt,
  endAt,
  lastHours,
  winnerCount = DEFAULT_WINNER_COUNT,
  excludePreviousWinners = true,
}) {
  const window = resolveRaffleWindow({
    mode,
    startAt,
    endAt,
    lastHours,
  });
  const cleanWinnerCount = clampInteger(winnerCount, DEFAULT_WINNER_COUNT, MAX_WINNER_COUNT);
  const shouldExcludePreviousWinners = excludePreviousWinners !== false;
  const rawEligibleCount = await countEligibleProfiles(window);
  const previousWinnerIds = shouldExcludePreviousWinners
    ? await getPreviousWinnerProfileIds()
    : new Set();
  const excludedPreviousWinnerIds = previousWinnerIds.size
    ? await getEligibleProfileIdsFromSet(window, previousWinnerIds)
    : new Set();
  const manuallyExcludedIds = await getManuallyExcludedProfileIds(window);
  const excludedProfileIds = new Set([
    ...excludedPreviousWinnerIds,
    ...manuallyExcludedIds,
  ]);
  const excludedEligibleCount = excludedProfileIds.size;
  const eligibleCount = Math.max(0, rawEligibleCount - excludedEligibleCount);

  return {
    window,
    cleanWinnerCount,
    shouldExcludePreviousWinners,
    rawEligibleCount,
    previousWinnerCount: previousWinnerIds.size,
    excludedPreviousWinnerIds,
    manuallyExcludedIds,
    excludedProfileIds,
    excludedEligibleCount,
    eligibleCount,
  };
}

function serializeRaffleEligibility(eligibility) {
  const {
    window,
    cleanWinnerCount,
    shouldExcludePreviousWinners,
    rawEligibleCount,
    previousWinnerCount,
    excludedPreviousWinnerIds,
    manuallyExcludedIds,
    excludedEligibleCount,
    eligibleCount,
  } = eligibility;

  return {
    mode: window.mode,
    startAt: window.startAt || null,
    endAt: window.endAt || null,
    lastHours: window.lastHours || null,
    winnerCount: cleanWinnerCount,
    rawEligibleCount,
    eligibleCount,
    excludePreviousWinners: shouldExcludePreviousWinners,
    previousWinnerCount,
    excludedPreviousWinnerCount: excludedPreviousWinnerIds.size,
    excludedManualCount: manuallyExcludedIds.size,
    excludedEligibleCount,
    shortage: Math.max(0, cleanWinnerCount - eligibleCount),
    canRun: eligibleCount > 0 && eligibleCount >= cleanWinnerCount,
  };
}

function assertEnoughEligibleProfiles({
  eligibleCount,
  winnerCount,
  excludedEligibleCount,
  excludePreviousWinners,
}) {
  if (eligibleCount <= 0) {
    const suffix = excludePreviousWinners && excludedEligibleCount > 0
      ? ' Todos os participantes elegiveis ja haviam sido sorteados.'
      : '';

    throw clientError(
      'raffle_no_eligible_profiles',
      `Nao ha participantes elegiveis para este sorteio.${suffix} Ajuste o periodo, permita ganhadores anteriores ou aguarde novas participacoes.`,
      422,
    );
  }

  if (eligibleCount < winnerCount) {
    throw clientError(
      'raffle_not_enough_eligible_profiles',
      `Ha apenas ${formatEligibleParticipantCount(eligibleCount)} para este sorteio, mas voce solicitou ${formatWinnerCount(winnerCount)}. Reduza a quantidade de ganhadores, ajuste o filtro ou permita ganhadores anteriores.`,
      422,
    );
  }
}

function assertEnoughSelectedWinners({
  selectedCount,
  winnerCount,
  eligibleCount,
}) {
  if (selectedCount >= winnerCount) {
    return;
  }

  throw clientError(
    'raffle_selection_insufficient',
    `Nao foi possivel selecionar ${formatWinnerCount(winnerCount)}. Foram encontrados ${formatParticipantCount(eligibleCount)} elegiveis, mas apenas ${formatWinnerCount(selectedCount)} puderam ser selecionados. Tente novamente apos atualizar os participantes.`,
    422,
  );
}

function formatParticipantCount(count) {
  const value = Number(count || 0);

  return value === 1
    ? '1 participante'
    : `${value} participantes`;
}

function formatEligibleParticipantCount(count) {
  const value = Number(count || 0);

  return value === 1
    ? '1 participante elegivel'
    : `${value} participantes elegiveis`;
}

function formatWinnerCount(count) {
  const value = Number(count || 0);

  return value === 1
    ? '1 ganhador'
    : `${value} ganhadores`;
}

async function notifyRaffleWinners({
  raffleId,
  winners,
  winnerMessage = '',
}) {
  const t = await getCurrentEventTranslator();
  const twilioConfig = await loadCurrentEventTwilioConfig();
  const messageBody = formatWinnerMessage(
    normalizeWinnerMessage(winnerMessage) || t('raffleWinner', { raffleId }),
    { raffleId },
  );
  const results = [];

  for (const winner of winners) {
    const destination = winner.whatsAppAddress || winner.phoneNumber || '';

    if (!destination) {
      results.push({
        profileId: winner.profileId,
        status: 'skipped',
        reason: 'missing-whatsapp-address',
      });
      continue;
    }

    try {
      const message = await runWithTwilioConfig(twilioConfig, () => sendWhatsAppText(
        toWhatsAppAddress(destination),
        messageBody,
      ));

      results.push({
        profileId: winner.profileId,
        status: 'sent',
        to: toWhatsAppAddress(destination),
        messageSid: message.sid || '',
        sentAt: Timestamp.now(),
      });
    } catch (error) {
      results.push({
        profileId: winner.profileId,
        status: 'failed',
        to: toWhatsAppAddress(destination),
        error: publicError(error),
        failedAt: Timestamp.now(),
      });
    }
  }

  return {
    summary: summarizeNotificationResults(results),
    results,
  };
}

function normalizeWinnerMessage(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
    .slice(0, 1200);
}

function formatWinnerMessage(template, vars = {}) {
  return Object.entries(vars).reduce((message, [name, value]) => (
    message.replaceAll(`{${name}}`, String(value))
  ), template);
}

function mergeWinnerNotifications(winners, results) {
  const byProfileId = new Map(results.map((item) => [item.profileId, item]));

  return winners.map((winner) => ({
    ...winner,
    notification: byProfileId.get(winner.profileId) || {
      profileId: winner.profileId,
      status: 'skipped',
      reason: 'not-processed',
    },
  }));
}

function summarizeNotificationResults(results) {
  return results.reduce((summary, item) => {
    summary.total += 1;

    if (item.status === 'sent') {
      summary.sent += 1;
    } else if (item.status === 'failed') {
      summary.failed += 1;
    } else {
      summary.skipped += 1;
    }

    return summary;
  }, createEmptyNotificationSummary());
}

function createEmptyNotificationSummary() {
  return {
    total: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };
}

async function loadCurrentEventTwilioConfig() {
  const snap = await getEventRef().get();
  const data = snap.exists ? snap.data() || {} : {};

  return data.twilio || {};
}

async function listRecentRaffles(limit = 20) {
  const cleanLimit = clampInteger(limit, 1, 50);
  const snap = await getEventRef()
    .collection('raffles')
    .orderBy('createdAt', 'desc')
    .limit(cleanLimit)
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() || {},
  }));
}

async function deleteRaffle({
  raffleId,
  requestedBy = '',
}) {
  const cleanRaffleId = String(raffleId || '').trim();

  if (!cleanRaffleId) {
    throw clientError('missing_raffle_id', 'Informe o sorteio para limpar.');
  }

  const raffleRef = getEventRef().collection('raffles').doc(cleanRaffleId);
  const snap = await raffleRef.get();

  if (!snap.exists) {
    throw clientError('raffle_not_found', 'Sorteio nao encontrado.', 404);
  }

  await raffleRef.delete();

  return {
    ok: true,
    raffleId: cleanRaffleId,
    deleted: 1,
    requestedBy,
  };
}

async function clearRaffles({
  requestedBy = '',
} = {}) {
  let deleted = 0;
  const rafflesRef = getEventRef().collection('raffles');

  while (true) {
    const snap = await rafflesRef
      .orderBy('createdAt', 'desc')
      .limit(DELETE_BATCH_SIZE)
      .get();

    if (snap.empty) {
      break;
    }

    const batch = getEventRef().firestore.batch();
    snap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    deleted += snap.size;
  }

  return {
    ok: true,
    deleted,
    requestedBy,
  };
}

async function countEligibleProfiles(window) {
  const aggregate = await buildEligibleProfilesQuery(window).count().get();
  const data = aggregate.data();

  return Number(data.count || 0);
}

async function countRandomKeyEligibleProfiles(window) {
  const aggregate = await buildEligibleProfilesQuery(window)
    .where('raffleRandomKey', '>=', 0)
    .count()
    .get();
  const data = aggregate.data();

  return Number(data.count || 0);
}

async function getEligibleProfileIdsFromSet(window, profileIds) {
  const eligibleIds = new Set();

  if (!profileIds.size) {
    return eligibleIds;
  }

  const profilesRef = getEventRef().collection('profiles');

  for (const profileId of profileIds) {
    const snap = await profilesRef.doc(profileId).get();

    if (snap.exists && isProfileEligibleForWindow(snap.data() || {}, window)) {
      eligibleIds.add(profileId);
    }
  }

  return eligibleIds;
}

async function getManuallyExcludedProfileIds(window) {
  const excludedIds = new Set();
  const snap = await getEventRef()
    .collection('profiles')
    .where('raffleExcluded', '==', true)
    .get();

  snap.forEach((doc) => {
    if (isProfileEligibleForWindow(doc.data() || {}, window)) {
      excludedIds.add(doc.id);
    }
  });

  return excludedIds;
}

async function getPreviousWinnerProfileIds() {
  const winnerIds = new Set();
  let query = getEventRef()
    .collection('raffles')
    .orderBy('createdAt', 'desc')
    .limit(500);

  while (true) {
    const snap = await query.get();

    if (snap.empty) {
      break;
    }

    snap.forEach((doc) => {
      const data = doc.data() || {};
      const winners = Array.isArray(data.winners) ? data.winners : [];

      winners.forEach((winner) => {
        if (winner && winner.profileId) {
          winnerIds.add(winner.profileId);
        }
      });
    });

    query = getEventRef()
      .collection('raffles')
      .orderBy('createdAt', 'desc')
      .startAfter(snap.docs[snap.docs.length - 1])
      .limit(500);
  }

  return winnerIds;
}

async function pickWinnersByRandomKey({
  window,
  randomStartKey,
  winnerCount,
  excludedWinnerIds = new Set(),
}) {
  const winners = [];
  const seen = new Set();

  await appendWinnersFromQuery({
    query: buildRandomKeyWinnerQuery(window, randomStartKey)
      .limit(winnerCount),
    winners,
    seen,
    winnerCount,
    excludedWinnerIds,
  });

  if (winners.length < winnerCount && randomStartKey > 0) {
    await appendWinnersFromQuery({
      query: buildRandomKeyWinnerQuery(window, 0)
        .where('raffleRandomKey', '<', randomStartKey)
        .limit(winnerCount - winners.length),
      winners,
      seen,
      winnerCount,
      excludedWinnerIds,
    });
  }

  return winners;
}

function buildRandomKeyWinnerQuery(window, minRandomKey) {
  let query = buildEligibleProfilesQuery(window)
    .where('raffleRandomKey', '>=', minRandomKey)
    .orderBy('raffleRandomKey', 'asc');

  if (window.mode !== 'all') {
    query = query.orderBy('lastRaffleInteractionAt', 'asc');
  }

  return query;
}

async function pickWinnersByReservoir({
  window,
  winnerCount,
  excludedWinnerIds = new Set(),
}) {
  const winners = [];
  let seenCount = 0;
  let query = buildReservoirProfilesQuery(window).limit(RESERVOIR_PAGE_SIZE);

  while (true) {
    const snap = await query.get();

    if (snap.empty) {
      break;
    }

    snap.forEach((doc) => {
      if (excludedWinnerIds.has(doc.id)) {
        return;
      }

      const winner = serializeWinner(doc.id, doc.data() || {});

      seenCount += 1;

      if (winners.length < winnerCount) {
        winners.push(winner);
        return;
      }

      const replacementIndex = crypto.randomInt(0, seenCount);

      if (replacementIndex < winnerCount) {
        winners[replacementIndex] = winner;
      }
    });

    const lastDoc = snap.docs[snap.docs.length - 1];
    query = buildReservoirProfilesQuery(window)
      .startAfter(lastDoc)
      .limit(RESERVOIR_PAGE_SIZE);
  }

  return winners;
}

async function appendWinnersFromQuery({
  query,
  winners,
  seen,
  winnerCount,
  excludedWinnerIds = new Set(),
}) {
  const snap = await query.get();

  snap.forEach((doc) => {
    if (winners.length >= winnerCount || seen.has(doc.id) || excludedWinnerIds.has(doc.id)) {
      return;
    }

    seen.add(doc.id);
    winners.push(serializeWinner(doc.id, doc.data() || {}));
  });
}

function buildEligibleProfilesQuery(window) {
  let query = getEventRef().collection('profiles');

  if (window.mode === 'all') {
    return query;
  }

  query = query.where('lastRaffleInteractionAt', '>=', window.startAt || EPOCH_TIMESTAMP);

  if (window.endAt) {
    query = query.where('lastRaffleInteractionAt', '<=', window.endAt);
  }

  return query;
}

function buildReservoirProfilesQuery(window) {
  const query = buildEligibleProfilesQuery(window);

  if (window.mode === 'all') {
    return query.orderBy('updatedAt', 'asc');
  }

  return query.orderBy('lastRaffleInteractionAt', 'asc');
}

function resolveRaffleWindow({
  mode,
  startAt,
  endAt,
  lastHours,
}) {
  const cleanMode = ['all', 'lastHours', 'range'].includes(mode) ? mode : 'all';
  const now = new Date();

  if (cleanMode === 'lastHours') {
    const hours = clampInteger(lastHours, 1, MAX_LAST_HOURS);
    return {
      mode: cleanMode,
      startAt: Timestamp.fromDate(new Date(now.getTime() - hours * 60 * 60 * 1000)),
      endAt: Timestamp.fromDate(now),
      lastHours: hours,
    };
  }

  if (cleanMode === 'range') {
    const start = parseDateInput(startAt, 'startAt');
    const end = parseDateInput(endAt, 'endAt');

    if (start.getTime() > end.getTime()) {
      throw clientError('invalid_raffle_range', 'O horario inicial precisa ser anterior ao horario final.');
    }

    return {
      mode: cleanMode,
      startAt: Timestamp.fromDate(start),
      endAt: Timestamp.fromDate(end),
      lastHours: null,
    };
  }

  return {
    mode: 'all',
    startAt: null,
    endAt: null,
    lastHours: null,
  };
}

function isProfileEligibleForWindow(profile = {}, window) {
  if (window.mode === 'all') {
    return true;
  }

  const lastInteractionMs = timestampToMillis(profile.lastRaffleInteractionAt);

  if (!lastInteractionMs) {
    return false;
  }

  const startMs = timestampToMillis(window.startAt);
  const endMs = timestampToMillis(window.endAt);

  if (startMs && lastInteractionMs < startMs) {
    return false;
  }

  if (endMs && lastInteractionMs > endMs) {
    return false;
  }

  return true;
}

function serializeWinner(profileId, profile = {}) {
  return {
    profileId,
    profileName: profile.profileName || profile.whatsappProfile?.profileName || 'Participant',
    phoneNumber: profile.phoneNumber || '',
    maskedPhone: maskPhone(profile.phoneNumber || profile.whatsAppAddress || ''),
    whatsAppAddress: profile.whatsAppAddress || '',
    waId: profile.waId || profile.whatsappProfile?.waId || '',
    latestImageId: profile.latestImageId || '',
    lastRaffleInteractionAt: profile.lastRaffleInteractionAt || null,
    raffleInteractionCount: Number(profile.raffleInteractionCount || 0),
    raffleRandomKey: Number(profile.raffleRandomKey || 0),
  };
}

function timestampToMillis(value) {
  if (!value) {
    return 0;
  }

  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  if (typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return Number(value) || 0;
}

function parseDateInput(value, fieldName) {
  const date = new Date(String(value || ''));

  if (Number.isNaN(date.getTime())) {
    throw clientError('invalid_raffle_date', `Informe um valor valido para ${fieldName}.`);
  }

  return date;
}

function clampInteger(value, min, max) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return min;
  }

  return Math.min(max, Math.max(min, parsed));
}

function maskPhone(value) {
  const digits = String(value || '').replace(/\D+/g, '');

  if (digits.length <= 4) {
    return digits || '-';
  }

  return `${digits.slice(0, 4)}***${digits.slice(-4)}`;
}

function publicError(error) {
  return error && (error.publicMessage || error.message)
    ? String(error.publicMessage || error.message)
    : 'Erro desconhecido.';
}

function clientError(code, publicMessage, statusCode = 400) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.code = code;
  error.publicMessage = publicMessage;
  return error;
}

module.exports = {
  RAFFLE_RANDOM_KEY_MAX,
  clearRaffles,
  createRaffle,
  createRaffleRandomKey,
  deleteRaffle,
  listRecentRaffles,
  previewRaffleEligibility,
};
