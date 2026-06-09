const { getEventRef, isFirebaseConfigured } = require('./firebaseAdmin');

const SUPPORTED_LANGUAGES = [
  { code: 'pt-br', label: 'Portuguese (Brazil)' },
  { code: 'en-us', label: 'English (US)' },
  { code: 'fr-fr', label: 'French' },
  { code: 'es-es', label: 'Spanish' },
  { code: 'de-de', label: 'German' },
];
const DEFAULT_LANGUAGE = 'pt-br';

const MESSAGES = {
  'pt-br': {
    webhookMissingSender: 'Webhook invalido: remetente ausente.',
    firebaseNotConfigured: 'Photobooth ainda nao esta configurado para salvar os pedidos. Avise a equipe do evento.',
    stickerResendAck: 'Vou reenviar os stickers que encontrei para este numero.',
    webhookMissingSid: 'Webhook invalido: SID da mensagem ausente.',
    duplicateImage: 'Essa foto ja esta registrada no processo. Se precisar de uma nova geracao, envie outra imagem.',
    limitReached: 'Seu limite de {limit} pacote(s) de impressao para este evento ja foi atingido. Procure a equipe se precisar liberar mais uma geracao.',
    generationAccepted: 'Aguarde uns minutos, daqui a pouco te responderemos por aqui com a sua foto e seus stickers.',
    sendPhotoInstructions: 'Envie uma foto por aqui para gerar seu cartao e o pacote de stickers tematicos.',
    genericFailure: 'Nao consegui processar sua mensagem agora. A equipe foi avisada para verificar.',
    unsupportedMedia: 'A midia recebida nao e uma imagem.',
    stickerResendEmpty: 'Ainda nao encontrei stickers prontos para este numero. Envie uma foto primeiro ou aguarde a geracao terminar.',
    stickerResendPartial: 'Reenviei {sent} sticker(s), mas {failed} nao puderam ser enviados agora.',
    stickerResendSuccess: 'Reenviei {sent} sticker(s) gerado(s) para este numero.',
    generationFailure: 'Ocorreu um erro ao processar sua foto. Por favor, tente novamente mais tarde.',
    printMainReady: 'Seu cartao foi impresso e ja pode ser retirado na estacao do photobooth.',
    printStickersReady: 'Seus stickers estao impressos e ja podem ser retirados na estacao do photobooth.',
    printRequestMain: 'Cartao enviado para impressao automatica.',
    printRequestStickers: 'Combinado. Seus stickers entraram na fila de impressao.',
    raffleWinner: 'Parabéns, você foi sorteado(a)!\n\nApresente esta mensagem para uma pessoa da Twilio para retirar seu brinde.',
  },
  'en-us': {
    webhookMissingSender: 'Invalid webhook: sender is missing.',
    firebaseNotConfigured: 'The photobooth is not configured to save requests yet. Please contact the event team.',
    stickerResendAck: 'I will resend the stickers I found for this number.',
    webhookMissingSid: 'Invalid webhook: message SID is missing.',
    duplicateImage: 'This photo is already registered. Send another image if you need a new generation.',
    limitReached: 'Your limit of {limit} print package(s) for this event has been reached. Please contact the team if you need another generation.',
    generationAccepted: 'Please wait a few minutes. We will reply here shortly with your photo and stickers.',
    sendPhotoInstructions: 'Send a photo here to generate your card and themed sticker pack.',
    genericFailure: 'I could not process your message right now. The team has been notified.',
    unsupportedMedia: 'The received media is not an image.',
    stickerResendEmpty: 'I could not find ready stickers for this number yet. Send a photo first or wait until generation finishes.',
    stickerResendPartial: 'I resent {sent} sticker(s), but {failed} could not be sent right now.',
    stickerResendSuccess: 'I resent {sent} generated sticker(s) to this number.',
    generationFailure: 'An error occurred while processing your photo. Please try again later.',
    printMainReady: 'Your card has been printed and is ready for pickup at the photobooth station.',
    printStickersReady: 'Your stickers have been printed and are ready for pickup at the photobooth station.',
    printRequestMain: 'Card sent to automatic printing.',
    printRequestStickers: 'All set. Your stickers have been added to the print queue.',
    raffleWinner: 'Congratulations! You were selected in the raffle. Raffle ID: {raffleId}. Please contact the event team for more information.',
  },
  'fr-fr': {
    webhookMissingSender: 'Webhook invalide : expediteur manquant.',
    firebaseNotConfigured: 'Le photobooth n est pas encore configure pour enregistrer les demandes. Veuillez prevenir l equipe de l evenement.',
    stickerResendAck: 'Je vais renvoyer les stickers trouves pour ce numero.',
    webhookMissingSid: 'Webhook invalide : SID du message manquant.',
    duplicateImage: 'Cette photo est deja enregistree. Envoyez une autre image si vous voulez une nouvelle generation.',
    limitReached: 'Votre limite de {limit} package(s) d impression pour cet evenement est atteinte. Contactez l equipe si vous avez besoin d une autre generation.',
    generationAccepted: 'Patientez quelques minutes. Nous vous repondrons ici avec votre photo et vos stickers.',
    sendPhotoInstructions: 'Envoyez une photo ici pour generer votre carte et votre pack de stickers.',
    genericFailure: 'Je n ai pas pu traiter votre message maintenant. L equipe a ete prevenue.',
    unsupportedMedia: 'Le media recu n est pas une image.',
    stickerResendEmpty: 'Je n ai pas encore trouve de stickers prets pour ce numero. Envoyez d abord une photo ou attendez la fin de la generation.',
    stickerResendPartial: 'J ai renvoye {sent} sticker(s), mais {failed} n ont pas pu etre envoyes maintenant.',
    stickerResendSuccess: 'J ai renvoye {sent} sticker(s) generes a ce numero.',
    generationFailure: 'Une erreur est survenue pendant le traitement de votre photo. Veuillez reessayer plus tard.',
    printMainReady: 'Votre carte a ete imprimee et peut etre retiree a la station photobooth.',
    printStickersReady: 'Vos stickers ont ete imprimes et peuvent etre retires a la station photobooth.',
    printRequestMain: 'Carte envoyee a l impression automatique.',
    printRequestStickers: 'C est note. Vos stickers ont ete ajoutes a la file d impression.',
    raffleWinner: 'Felicitations ! Vous avez ete tire(e) au sort. ID du tirage : {raffleId}. Veuillez contacter l equipe de l evenement pour plus d informations.',
  },
  'es-es': {
    webhookMissingSender: 'Webhook invalido: falta el remitente.',
    firebaseNotConfigured: 'El photobooth aun no esta configurado para guardar solicitudes. Avisa al equipo del evento.',
    stickerResendAck: 'Voy a reenviar los stickers que encontre para este numero.',
    webhookMissingSid: 'Webhook invalido: falta el SID del mensaje.',
    duplicateImage: 'Esta foto ya esta registrada. Envia otra imagen si necesitas una nueva generacion.',
    limitReached: 'Ya alcanzaste el limite de {limit} paquete(s) de impresion para este evento. Contacta al equipo si necesitas otra generacion.',
    generationAccepted: 'Espera unos minutos. Te responderemos aqui pronto con tu foto y tus stickers.',
    sendPhotoInstructions: 'Envia una foto aqui para generar tu tarjeta y tu paquete de stickers.',
    genericFailure: 'No pude procesar tu mensaje ahora. El equipo fue notificado.',
    unsupportedMedia: 'El archivo recibido no es una imagen.',
    stickerResendEmpty: 'Todavia no encontre stickers listos para este numero. Envia una foto primero o espera a que termine la generacion.',
    stickerResendPartial: 'Reenvie {sent} sticker(s), pero {failed} no se pudieron enviar ahora.',
    stickerResendSuccess: 'Reenvie {sent} sticker(s) generados a este numero.',
    generationFailure: 'Ocurrio un error al procesar tu foto. Intentalo de nuevo mas tarde.',
    printMainReady: 'Tu tarjeta fue impresa y ya puedes retirarla en la estacion del photobooth.',
    printStickersReady: 'Tus stickers fueron impresos y ya puedes retirarlos en la estacion del photobooth.',
    printRequestMain: 'Tarjeta enviada a impresion automatica.',
    printRequestStickers: 'Listo. Tus stickers entraron en la cola de impresion.',
    raffleWinner: 'Felicidades! Fuiste seleccionado(a) en el sorteo. ID del sorteo: {raffleId}. Contacta al equipo del evento para mas informacion.',
  },
  'de-de': {
    webhookMissingSender: 'Ungueltiger Webhook: Absender fehlt.',
    firebaseNotConfigured: 'Die Photobooth ist noch nicht zum Speichern von Anfragen konfiguriert. Bitte informiere das Event-Team.',
    stickerResendAck: 'Ich sende die gefundenen Sticker fuer diese Nummer erneut.',
    webhookMissingSid: 'Ungueltiger Webhook: Nachrichten-SID fehlt.',
    duplicateImage: 'Dieses Foto ist bereits registriert. Sende ein anderes Bild, wenn du eine neue Generierung brauchst.',
    limitReached: 'Dein Limit von {limit} Druckpaket(en) fuer dieses Event wurde erreicht. Bitte kontaktiere das Team, wenn du eine weitere Generierung brauchst.',
    generationAccepted: 'Bitte warte ein paar Minuten. Wir antworten dir hier gleich mit deinem Foto und deinen Stickern.',
    sendPhotoInstructions: 'Sende hier ein Foto, um deine Karte und dein Stickerpaket zu erstellen.',
    genericFailure: 'Ich konnte deine Nachricht gerade nicht verarbeiten. Das Team wurde informiert.',
    unsupportedMedia: 'Die empfangene Datei ist kein Bild.',
    stickerResendEmpty: 'Ich habe fuer diese Nummer noch keine fertigen Sticker gefunden. Sende zuerst ein Foto oder warte, bis die Generierung fertig ist.',
    stickerResendPartial: 'Ich habe {sent} Sticker erneut gesendet, aber {failed} konnten jetzt nicht gesendet werden.',
    stickerResendSuccess: 'Ich habe {sent} generierte Sticker an diese Nummer erneut gesendet.',
    generationFailure: 'Beim Verarbeiten deines Fotos ist ein Fehler aufgetreten. Bitte versuche es spaeter erneut.',
    printMainReady: 'Deine Karte wurde gedruckt und kann an der Photobooth-Station abgeholt werden.',
    printStickersReady: 'Deine Sticker wurden gedruckt und koennen an der Photobooth-Station abgeholt werden.',
    printRequestMain: 'Karte wurde an den automatischen Druck gesendet.',
    printRequestStickers: 'Alles klar. Deine Sticker wurden zur Druckwarteschlange hinzugefuegt.',
    raffleWinner: 'Glueckwunsch! Du wurdest bei der Verlosung ausgewaehlt. Verlosungs-ID: {raffleId}. Bitte kontaktiere das Event-Team fuer weitere Informationen.',
  },
};

async function getCurrentEventLanguage() {
  if (!isFirebaseConfigured()) {
    return DEFAULT_LANGUAGE;
  }

  try {
    const snap = await getEventRef().get();
    const data = snap.exists ? snap.data() || {} : {};

    return normalizeLanguage(data.language || DEFAULT_LANGUAGE);
  } catch (error) {
    return DEFAULT_LANGUAGE;
  }
}

async function getCurrentEventTranslator() {
  return createTranslator(await getCurrentEventLanguage());
}

function createTranslator(language) {
  const normalized = normalizeLanguage(language);

  return (key, vars) => translate(key, vars, normalized);
}

function translate(key, vars = {}, language = DEFAULT_LANGUAGE) {
  const normalized = normalizeLanguage(language);
  const value = (MESSAGES[normalized] && MESSAGES[normalized][key])
    || MESSAGES[DEFAULT_LANGUAGE][key]
    || key;

  return Object.entries(vars).reduce((text, [name, replacement]) => (
    text.replaceAll(`{${name}}`, String(replacement))
  ), value);
}

function normalizeLanguage(value) {
  const normalized = String(value || '').trim().toLowerCase().replace('_', '-');
  const aliases = {
    pt: 'pt-br',
    'pt-br': 'pt-br',
    en: 'en-us',
    'en-us': 'en-us',
    fr: 'fr-fr',
    'fr-fr': 'fr-fr',
    es: 'es-es',
    'es-es': 'es-es',
    de: 'de-de',
    'de-de': 'de-de',
  };

  return aliases[normalized] || DEFAULT_LANGUAGE;
}

module.exports = {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  createTranslator,
  getCurrentEventLanguage,
  getCurrentEventTranslator,
  normalizeLanguage,
  translate,
};
