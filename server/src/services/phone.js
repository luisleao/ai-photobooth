const crypto = require('node:crypto');

function limpaNumero(number, removeMais) {
  let value = number;

  if (value) {
    value = String(value).replace('whatsapp:', '');
  }

  if (value && removeMais) {
    value = value.replace('+', '');
  }

  return value || '';
}

function createPhoneProfileId(number) {
  return crypto
    .createHash('md5')
    .update(limpaNumero(number))
    .digest('hex');
}

module.exports = {
  createPhoneProfileId,
  limpaNumero,
};
