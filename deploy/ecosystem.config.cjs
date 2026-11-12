// PM2: proceso de la API en el VPS compartido.
// El VPS trae Node 20 para las otras apps; esta necesita Node ≥ 24 (node:sqlite, util.parseEnv),
// así que usa su propio binario en /opt/node-24 sin tocar el Node del sistema.
const NODE = '/opt/node-24/bin/node';

module.exports = {
  apps: [
    {
      name: 'elpato-api',
      cwd: __dirname + '/../apps/api',
      script: '../../node_modules/tsx/dist/cli.mjs',
      args: 'src/server.ts',
      interpreter: NODE,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
      time: true,
    },
  ],
};
