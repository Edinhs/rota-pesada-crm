import path from 'node:path';
import { resolveDataDir, restoreDatabase } from '../server/storage.ts';

const args = process.argv.slice(2);
const demo = args.includes('--demo');
const positions = args.filter((arg) => arg !== '--demo');
try {
  if (positions.length !== 1 || positions.some((arg) => arg.startsWith('--')))
    throw new Error('Uso: npm run restore -- [--demo] "caminho-do-backup.sqlite"');
  const source = path.resolve(positions[0]);
  const destination = resolveDataDir(demo);
  console.log(`Restaurando ${demo ? 'demonstração' : 'operação'} em: ${destination}`);
  await restoreDatabase(destination, source);
  console.log(
    'Restauração concluída. Se existia uma base anterior, ela foi preservada como before-restore-*.sqlite no diretório de dados.',
  );
  console.log('Inicie o CRM e confira os cadastros e documentos antes de retomar o atendimento.');
} catch (error) {
  console.error(
    `Restauração não concluída: ${error instanceof Error ? error.message : String(error)}`,
  );
  console.error(
    'Feche o CRM com Ctrl+C antes de restaurar. Não remova app.lock enquanto houver processo ativo.',
  );
  process.exitCode = 1;
}
