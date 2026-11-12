#!/usr/bin/env bash
# Despliegue en el VPS: trae la rama main de GitHub, compila y recarga solo la API de este proyecto.
# Uso (en el VPS):  /var/www/elpatodelasuerte/deploy/desplegar.sh
set -euo pipefail

APP=/var/www/elpatodelasuerte
DATOS=/var/lib/elpatodelasuerte
export PATH=/opt/node-24/bin:$PATH

cd "$APP"

# Copia de la base antes de tocar nada (últimas 30).
mkdir -p /var/backups/elpatodelasuerte
if [ -f "$DATOS/pato.db" ]; then
  /opt/node-24/bin/node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('$DATOS/pato.db').exec(\"VACUUM INTO '/var/backups/elpatodelasuerte/pato-$(date +%Y%m%d-%H%M%S).db'\")"
  ls -1t /var/backups/elpatodelasuerte/pato-*.db | tail -n +31 | xargs -r rm --
fi

git fetch --quiet origin main
git reset --hard origin/main

npm ci --no-audit --no-fund
npm run build

# Estáticos que sirve nginx (se reemplazan de una vez para no servir una mezcla).
for sitio in web-public web-admin; do
  rm -rf "/srv/elpatodelasuerte/$sitio.nuevo"
  cp -r "apps/$sitio/dist" "/srv/elpatodelasuerte/$sitio.nuevo"
  rm -rf "/srv/elpatodelasuerte/$sitio"
  mv "/srv/elpatodelasuerte/$sitio.nuevo" "/srv/elpatodelasuerte/$sitio"
done

if pm2 describe elpato-api >/dev/null 2>&1; then
  pm2 reload elpato-api --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi
pm2 save >/dev/null

echo "Desplegado $(git rev-parse --short HEAD)"
