import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { createApiApp } from './bootstrap';

async function bootstrap() {
  const app = await createApiApp();
  await app.listen(Number(process.env.PORT ?? 3001));
  new Logger('bootstrap').log('stackduck-api listening on :' + (process.env.PORT ?? 3001));
}
void bootstrap();
