<#
.SYNOPSIS
  Crea el repositorio PRIVADO Absolute-Beginners-IT/Mapa-Infraestructura en GitHub y sube esta carpeta.

.DESCRIPTION
  Requisitos (una sola vez):
    winget install --id Git.Git -e
    winget install --id GitHub.cli -e
    gh auth login        (cuenta con permiso para crear repos en la organización)
  Ejecuta este script desde la carpeta del proyecto:
    powershell -ExecutionPolicy Bypass -File .\Subir-a-GitHub.ps1
#>
param(
    [string]$Organizacion = 'Absolute-Beginners-IT',
    [string]$Repositorio = 'Mapa-Infraestructura'
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

foreach ($cmd in 'git', 'gh') {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "Falta '$cmd'. Instálalo con winget (ver ayuda del script) y abre una consola nueva." }
}
gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host 'Inicia sesión en GitHub...' -ForegroundColor Cyan; gh auth login }

if (-not (Test-Path '.git')) {
    git init -b main | Out-Null
}
if (-not (git config user.email)) {
    $u = gh api user --jq '.login'
    git config user.name $u
    git config user.email "$u@users.noreply.github.com"
}

git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -m 'Proyecto Mapa de Infraestructura: inventario, monitorización, alertas, actuaciones y pruebas de red' | Out-Null }

$full = "$Organizacion/$Repositorio"
gh repo view $full 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creando repositorio privado $full ..." -ForegroundColor Cyan
    gh repo create $full --private --source . --remote origin --description 'Mapa de infraestructura, monitorización, alertas, actuaciones y pruebas de red' --push
} else {
    Write-Host "El repositorio $full ya existe: subiendo cambios..." -ForegroundColor Yellow
    if (-not (git remote | Select-String -Quiet '^origin$')) { git remote add origin "https://github.com/$full.git" }
    git push -u origin main
}
$vis = gh repo view $full --json visibility --jq '.visibility'
Write-Host "Listo: https://github.com/$full (visibilidad: $vis)" -ForegroundColor Green
