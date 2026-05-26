const path = require('node:path');

let loaded = false;

function loadEnv() {
  if (loaded) {
    return;
  }

  loaded = true;

  try {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const paths = Array.from(new Set([
      path.join(projectRoot, '.env'),
      path.join(projectRoot, 'scripts', '.env'),
      path.resolve(process.cwd(), '.env'),
    ]));

    // dotenv handles quoted multiline values such as FIREBASE_PRIVATE_KEY.
    require('dotenv').config({
      path: paths,
      quiet: true,
    });
  } catch (error) {
    // The app can still run in environments that inject variables directly.
  }
}

module.exports = {
  loadEnv,
};
