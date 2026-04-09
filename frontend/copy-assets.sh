#!/bin/sh
# Copiar assets de build al directorio de nginx
echo "Copiando assets de build a nginx..."
cp -r /app/dist/* /usr/share/nginx/html/

# Iniciar nginx
echo "Iniciando nginx..."
exec nginx -g "daemon off;"