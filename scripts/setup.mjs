// Prepara o ambiente: instala dependências e cria o .env do back-end se não existir.
import { copyFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

for (const dir of ['.', 'back-end', 'front-end']) {
  console.log(`\n> npm install (${dir})`);
  const r = spawnSync('npm install', { cwd: dir, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (existsSync('back-end/.env')) {
  console.log('\nback-end/.env já existe — mantido.');
} else {
  copyFileSync('back-end/.env.example', 'back-end/.env');
  console.log('\nback-end/.env criado a partir de .env.example — defina JWT_SECRET, SEED_COORDENACAO_* e (opcional) DEMO_*.');
}
console.log('\nPronto. Rode: npm run db:up && npm run db:setup && npm run dev');
