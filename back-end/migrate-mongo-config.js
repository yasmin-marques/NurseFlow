require('dotenv').config();

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/nurseflow';

module.exports = {
  mongodb: {
    // O nome do banco vem da própria URI (ex.: mongodb://localhost:27017/nurseflow).
    url,
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'migracoes',
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'commonjs',
};
