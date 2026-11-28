#!/usr/bin/env bash
# shellcheck disable=SC2016 # las comillas invertidas de los mensajes son literales
# Prepara el entorno `production` de GitHub y carga (o rota) las credenciales de Cloudflare que usa
# .github/workflows/deploy.yml. Interactivo e idempotente. Uso, desde WSL en la raíz del repo:
#   bash scripts/setup-github-secrets.sh
# Requisitos: gh autenticado con permiso de administración del repositorio.
# Los valores se piden sin eco y viajan a `gh` por stdin: no quedan en el historial, en la línea de
# comandos ni en archivos. El script no imprime ningún valor. Permisos del token en DEPLOYMENT.md.
set -euo pipefail

REPO='matigaleanodev/365-tracks'
ENVIRONMENT='production'

ask() { local answer; read -r -p "$1 [s/N] " answer; [[ "$answer" == [sS] ]]; }
read_secret() {
  local value
  read -r -s -p "$1: " value
  printf '\n' >&2
  [[ -n "${value//[[:space:]]/}" ]] || { echo 'Valor vacío: no se guardó nada.' >&2; exit 1; }
  printf '%s' "$value"
}
set_secret() { printf '%s' "$2" | gh secret set "$1" --env "$ENVIRONMENT" --repo "$REPO" > /dev/null; }

command -v gh > /dev/null || { echo 'Falta GitHub CLI (gh): https://cli.github.com'; exit 1; }
gh auth status > /dev/null 2>&1 || { echo 'gh no está autenticado: corré `gh auth login`.'; exit 1; }

printf 'Repositorio: %s · entorno de GitHub `%s`.\n' "$REPO" "$ENVIRONMENT"
ask '¿Continuar?' || exit 0

# Sin revisores: lo que impide desplegar desde otra rama es que el entorno solo acepte `main` y que
# `main` solo cambie por pull request.
gh api "repos/$REPO/rules/branches/main" --jq '.[].type' | grep -qx pull_request ||
  { echo 'main no exige pull request: no se configura un entorno sin revisores.' >&2; exit 1; }

policies() {
  local out
  if ! out=$(gh api "repos/$REPO/environments/$ENVIRONMENT/deployment-branch-policies" \
    --jq '.branch_policies[] | "\(.type // "branch"):\(.name)"' 2>&1); then
    [[ "$out" == *'HTTP 404'* ]] && return 0
    echo 'No se pudieron leer las políticas de ramas del entorno.' >&2
    exit 1
  fi
  printf '%s' "$out"
}
current=$(policies)
if [[ -n "$current" && "$current" != 'branch:main' ]]; then
  echo "El entorno $ENVIRONMENT admite otras ramas además de main; revisalo en Settings → Environments." >&2
  exit 1
fi
printf '%s' '{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}' |
  gh api -X PUT "repos/$REPO/environments/$ENVIRONMENT" --input - > /dev/null
if [[ -z "$current" ]]; then
  gh api -X POST "repos/$REPO/environments/$ENVIRONMENT/deployment-branch-policies" \
    -f name=main -f type=branch > /dev/null
fi
[[ "$(policies)" == 'branch:main' ]] || { echo 'El entorno no quedó limitado a main.' >&2; exit 1; }
echo "Entorno $ENVIRONMENT listo: solo main, sin revisores."

if ask '¿Cargar o rotar CLOUDFLARE_ACCOUNT_ID?'; then
  account=$(read_secret 'Account ID de Cloudflare (32 caracteres hexadecimales)')
  [[ "$account" =~ ^[0-9a-f]{32}$ ]] || { echo 'El Account ID no tiene el formato esperado.' >&2; exit 1; }
  set_secret CLOUDFLARE_ACCOUNT_ID "$account"
  echo 'CLOUDFLARE_ACCOUNT_ID guardado.'
fi

if ask '¿Cargar o rotar CLOUDFLARE_API_TOKEN?'; then
  token=$(read_secret 'API token de Cloudflare')
  set_secret CLOUDFLARE_API_TOKEN "$token"
  unset token
  echo 'CLOUDFLARE_API_TOKEN guardado.'
fi

echo 'Secretos del entorno (solo nombres):'
gh secret list --env "$ENVIRONMENT" --repo "$REPO"
