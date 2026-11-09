// Instala dependências e cria o .env do back-end se ainda não existir.
import { copyFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

for (const dir of ['.', 'back-end', 'front-end']) {
  console.log(`\n> npm install (${dir})`);
  const result = spawnSync('npm install', { cwd: dir, stdio: 'inherit', shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (existsSync('back-end/.env')) {
  console.log('\nback-end/.env já existe — mantido.');
} else {
  copyFileSync('back-end/.env.example', 'back-end/.env');
  console.log('\nback-end/.env criado a partir de .env.example — configure JWT_SECRET, SEED_COORDENACAO_* e DEMO_*.');
}

console.log('\nDependências preparadas. Configure back-end/.env, depois rode: npm run db:up && npm run db:setup && npm run dev');
