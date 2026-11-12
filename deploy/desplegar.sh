#!/usr/bin/env bash
# Despliegue en el VPS: trae la rama main de GitHub, compila y recarga solo la API de este proyecto.
# Uso (en el VPS):  /var/www/elpatodelasuerte/deploy/desplegar.sh
#
# Todo va dentro de main() para que bash lea el archivo completo antes de ejecutar:
# el propio git reset reescribe este script mientras corre.
set -euo pipefail

main() {
  umask 022   # nginx (www-data) tiene que poder leer los estáticos y las imágenes
  local APP=/var/www/elpatodelasuerte
  local DATOS=/var/lib/elpatodelasuerte
  local WEB=/srv/elpatodelasuerte
  export PATH=/opt/node-24/bin:$PATH
  cd "$APP"

  # Etapa 1: traer el código y volver a lanzar el script ya actualizado.
  if [ "${1:-}" != "--compilar" ]; then
    git fetch --quiet origin main
    git reset --hard --quiet origin/main
    exec bash "$APP/deploy/desplegar.sh" --compilar
  fi

  # Copia de la base antes de tocar nada (últimas 30).
  mkdir -p /var/backups/elpatodelasuerte
  if [ -f "$DATOS/pato.db" ]; then
    local copia="/var/backups/elpatodelasuerte/pato-$(date +%Y%m%d-%H%M%S).db"
    node -e "new (require('node:sqlite').DatabaseSync)(process.argv[1]).exec(\"VACUUM INTO '\" + process.argv[2] + \"'\")" "$DATOS/pato.db" "$copia"
    ls -1t /var/backups/elpatodelasuerte/pato-*.db | tail -n +31 | xargs -r rm --
  fi

  npm ci --no-audit --no-fund
  npm run build

  # Estáticos que sirve nginx (se reemplazan de una vez para no servir una mezcla).
  for sitio in web-public web-admin; do
    rm -rf "$WEB/$sitio.nuevo"
    cp -r "apps/$sitio/dist" "$WEB/$sitio.nuevo"
    chmod -R u=rwX,go=rX "$WEB/$sitio.nuevo"
    rm -rf "$WEB/$sitio"
    mv "$WEB/$sitio.nuevo" "$WEB/$sitio"
  done

  if pm2 describe elpato-api >/dev/null 2>&1; then
    pm2 reload elpato-api --update-env
  else
    pm2 start deploy/ecosystem.config.cjs
  fi
  pm2 save >/dev/null

  echo "Desplegado $(git rev-parse --short HEAD)"
}

main "$@"
