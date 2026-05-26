const fs = require('node:fs/promises');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const GENERATED_ROOT = path.join(PROJECT_ROOT, 'server', 'public', 'generated');

async function main() {
  await fs.mkdir(GENERATED_ROOT, { recursive: true });
  const entries = await fs.readdir(GENERATED_ROOT);

  await Promise.all(entries.map((entry) => (
    fs.rm(path.join(GENERATED_ROOT, entry), {
      recursive: true,
      force: true,
    })
  )));

  console.log(`Generated directory cleaned: ${path.relative(PROJECT_ROOT, GENERATED_ROOT)}`);
  console.log(`Entries removed: ${entries.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
