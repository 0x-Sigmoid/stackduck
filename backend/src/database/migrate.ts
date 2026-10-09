import 'reflect-metadata';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { databaseOptions } from './options';

async function migrate() {
  await ConfigModule.forRoot({ envFilePath: ['backend/.env', '.env'] });
  const db = new DataSource(databaseOptions(new ConfigService()));
  try {
    await db.initialize();
    const applied = await db.runMigrations({ transaction: 'all' });
    console.log('Applied ' + applied.length + ' database migration(s).');
  } finally {
    if (db.isInitialized) await db.destroy();
  }
}
void migrate().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
