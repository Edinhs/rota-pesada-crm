import { createApp } from './app.ts';
import { resolveDataDir } from './storage.ts';

const demo = process.argv.includes('--demo');
const dataDir = resolveDataDir(demo);
const port = Number(process.env.PORT || (demo ? 3001 : 3000));
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT deve ser um inteiro entre 1 e 65535.');
let app: Awaited<ReturnType<typeof createApp>> | undefined;
try {
  app = await createApp({ dataDir, serveStatic: true, mode: demo ? 'demo' : 'operational' });
  await app.listen({ port, host: '127.0.0.1' });
  console.log(`CRM ${demo ? '(demonstração)' : 'operacional'}: http://127.0.0.1:${port}`);
  console.log(`Dados: ${dataDir}`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, async () => {
      await app!.close();
      process.exit(0);
    });
} catch (error) {
  if (app) await app.close();
  console.error(error instanceof Error ? error.message : 'Não foi possível iniciar o CRM.');
  process.exitCode = 1;
}
