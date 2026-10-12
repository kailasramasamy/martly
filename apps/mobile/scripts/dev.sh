#!/usr/bin/env bash
# Points EXPO_PUBLIC_API_URL at this Mac's current LAN IP, then starts Metro.
# Clears the Metro cache only when the IP changed, since EXPO_PUBLIC_* values
# are inlined into the bundle at build time.
set -euo pipefail

cd "$(dirname "$0")/.."

iface=$(route -n get default 2>/dev/null | awk '/interface:/ {print $2}')
ip=$(ipconfig getifaddr "${iface:-en0}" || true)

if [[ -z "$ip" ]]; then
  echo "Could not detect LAN IP (interface: ${iface:-en0}). Are you on Wi-Fi?" >&2
  exit 1
fi

url="http://$ip:7001"
current=$(grep -E '^EXPO_PUBLIC_API_URL=' .env 2>/dev/null | cut -d= -f2- || true)

clear_flag=()
if [[ "$current" != "$url" ]]; then
  if grep -qE '^EXPO_PUBLIC_API_URL=' .env 2>/dev/null; then
    sed -i '' "s|^EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=$url|" .env
  else
    echo "EXPO_PUBLIC_API_URL=$url" >> .env
  fi
  echo "API URL changed: ${current:-<unset>} -> $url (clearing Metro cache)"
  clear_flag=(--clear)
else
  echo "API URL: $url"
fi

exec npx expo start --port 8081 ${clear_flag[@]+"${clear_flag[@]}"} "$@"
