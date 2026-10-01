import '../config/env';
import { runMigrationsAndSeed } from './migrate';
import { client } from './index';

async function seed() {
  console.log('🌱 [SEED] Avvio seeding database...');
  await runMigrationsAndSeed();
  console.log('✅ [SEED] Seeding completato con successo.');
}

seed()
  .then(async () => {
    await client.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ [SEED] Errore critico nel seeding:', err);
    try {
      await client.end();
    } catch {}
    process.exit(1);
  });
