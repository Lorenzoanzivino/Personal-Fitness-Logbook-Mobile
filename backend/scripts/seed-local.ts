import '../src/config/env';
import { runMigrationsAndSeed } from '../src/db/migrate';
import { client, db } from '../src/db/index';
import { users } from '../src/db/schema';
import { sql } from 'drizzle-orm';
import { hashPassword } from '../src/utils/crypto';

async function seedLocal() {
  console.log('🚀 [SEED LOCAL] Avvio configurazione DB PostgreSQL locale (porta 5435)...');

  // 1. Esecuzione migrazioni DDL ed esercizi base
  await runMigrationsAndSeed();

  // 2. Dati Trainer Obbligatori richiesti
  const trainerData = {
    username: 'Lorenzo',
    passwordClear: 'Admin123',
    firstName: 'Lorenzo',
    lastName: 'Anzivino',
    birthDate: '1997-09-09',
    heightCm: '179',
    role: 'TRAINER' as const,
    email: 'lorenzo.anzivino@example.com',
  };

  const hashedPassword = hashPassword(trainerData.passwordClear);

  const existingTrainer = await db
    .select()
    .from(users)
    .where(sql`LOWER(${users.username}) = LOWER(${trainerData.username})`);

  if (existingTrainer.length === 0) {
    console.log(`👤 [SEED LOCAL] Inserimento nuovo Trainer Master '${trainerData.username}'...`);
    await db.insert(users).values({
      id: 'trainer-1',
      username: trainerData.username,
      passwordHash: hashedPassword,
      role: trainerData.role,
      firstName: trainerData.firstName,
      lastName: trainerData.lastName,
      birthDate: trainerData.birthDate,
      heightCm: trainerData.heightCm,
      email: trainerData.email,
      isOnboarded: true,
      isProfileCompleted: true,
    });
    console.log(`✅ [SEED LOCAL] Trainer '${trainerData.username}' creato con successo.`);
  } else {
    console.log(`👤 [SEED LOCAL] Aggiornamento credenziali Trainer Master '${trainerData.username}'...`);
    await db
      .update(users)
      .set({
        passwordHash: hashedPassword,
        role: trainerData.role,
        firstName: trainerData.firstName,
        lastName: trainerData.lastName,
        birthDate: trainerData.birthDate,
        heightCm: trainerData.heightCm,
        email: trainerData.email,
        isOnboarded: true,
        isProfileCompleted: true,
      })
      .where(sql`LOWER(${users.username}) = LOWER(${trainerData.username})`);
    console.log(`✅ [SEED LOCAL] Trainer '${trainerData.username}' aggiornato con successo.`);
  }

  // 3. Stampa di riepilogo
  console.log('\n======================================================');
  console.log('🎉 [SEED LOCAL] Setup completato con successo!');
  console.log('📌 Credenziali per il Login in locale:');
  console.log(`   - Username : ${trainerData.username}`);
  console.log(`   - Password : ${trainerData.passwordClear}`);
  console.log(`   - Ruolo    : ${trainerData.role}`);
  console.log(`   - Nascita  : ${trainerData.birthDate} | Altezza: ${trainerData.heightCm} cm`);
  console.log('======================================================\n');
}

seedLocal()
  .then(async () => {
    await client.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ [SEED LOCAL] Errore critico:', err);
    try {
      await client.end();
    } catch {}
    process.exit(1);
  });
