<#
.SYNOPSIS
  Mide el rendimiento de la red interna entre este equipo y un servidor iperf3.

.DESCRIPTION
  En el equipo destino (un servidor en el CPD) arranca:   iperf3.exe -s
  (abre el puerto TCP 5201 en su firewall). Luego, desde cada planta/VLAN/sede, ejecuta este script.
  Mide TCP en ambos sentidos con varios flujos y UDP para jitter y pérdida.

.EXAMPLE
  .\Test-RedInterna.ps1 -Servidor 192.168.10.50 -Origen "Planta2-VLAN20"
  .\Test-RedInterna.ps1 -Servidor srv-iperf -Origen "Sede-Bilbao" -UdpMbps 100
#>
param(
    [Parameter(Mandatory = $true)][string]$Servidor,
    [string]$Origen = $env:COMPUTERNAME,
    [int]$Segundos = 10,
    [int]$Flujos = 4,
    [int]$UdpMbps = 500
)

# Cada script del toolkit se puede copiar suelto a otro equipo, por eso las funciones auxiliares
# se repiten en vez de importarse de un módulo común; las pruebas (tests\Test-Toolkit.ps1) cubren cada copia.

# Devuelve $null si el SHA-256 del fichero coincide con el de bin\SHA256SUMS.txt (formato de sha256sum:
# "<hash>  <fichero>"); si no, el motivo para no ejecutarlo. Protege frente a descargas equivocadas o
# corruptas, no frente a quien pueda escribir en bin\ (podría cambiar también SHA256SUMS.txt). Ver bin\LEEME.txt.
function Comprobar-Binario([string]$ruta) {
    $nombre = Split-Path $ruta -Leaf
    $sums = Join-Path (Split-Path $ruta) 'SHA256SUMS.txt'
    $esperado = $null
    if (Test-Path $sums) {
        foreach ($l in Get-Content $sums) {
            if ($l -match "^\s*([0-9a-fA-F]{64})\s+\*?$([regex]::Escape($nombre))\s*$") { $esperado = $Matches[1]; break }
        }
    }
    if (-not $esperado) { return "No hay hash registrado para $nombre en $sums. Compara su SHA-256 con el que publica el fabricante y añádelo (ver bin\LEEME.txt)." }
    $real = (Get-FileHash -Algorithm SHA256 -Path $ruta).Hash
    if ($real -ne $esperado) { return "El SHA-256 de $nombre ($real) no coincide con el registrado en $sums. No se ejecuta: el fichero puede estar alterado." }
    return $null
}

# Origen y Destino los escribe quien lanza el script: se protegen igual antes de guardarlos (fórmulas de Excel).
function Proteger-Celda($v) {
    if ($v -is [string] -and $v -match "^'*[=+\-@`t`r]") { return "'$v" }
    return $v
}
# Único punto del script que escribe CSV, para que ninguna exportación se salte Proteger-Celda.
function Export-CsvProtegido($Filas, [string]$Ruta, [switch]$Anexar) {
    $Filas | Where-Object { $null -ne $_ } | ForEach-Object { foreach ($c in $_.PSObject.Properties) { $c.Value = Proteger-Celda $c.Value }; $_ } |
        Export-Csv -Path $Ruta -Delimiter ';' -NoTypeInformation -Encoding UTF8 -Append:$Anexar
}

$bin = Join-Path $PSScriptRoot 'bin\iperf3.exe'
if (-not (Test-Path $bin)) { throw "No se encuentra $bin. Descarga iperf3 para Windows y copia iperf3.exe en la carpeta bin." }
# iperf3 para Windows carga cygwin1.dll desde su misma carpeta: se verifica igual que el ejecutable.
foreach ($f in $bin, (Join-Path $PSScriptRoot 'bin\cygwin1.dll')) {
    if (Test-Path $f) { $motivo = Comprobar-Binario $f; if ($motivo) { throw $motivo } }
}
$historico = Join-Path $PSScriptRoot 'resultados\red-interna.csv'
New-Item -ItemType Directory -Force -Path (Split-Path $historico) | Out-Null

function Invoke-Iperf([string[]]$extra) {
    $out = & $bin -c $Servidor -t $Segundos -J @extra 2>$null | Out-String
    if (-not $out) { return $null }
    return $out | ConvertFrom-Json
}

Write-Host "TCP subida (este equipo -> $Servidor)..."
$up = Invoke-Iperf @('-P', $Flujos)
Write-Host "TCP bajada ($Servidor -> este equipo)..."
$down = Invoke-Iperf @('-P', $Flujos, '-R')
Write-Host "UDP a $UdpMbps Mbps (jitter y pérdida)..."
$udp = Invoke-Iperf @('-u', '-b', "$($UdpMbps)M")

$lat = Test-Connection -ComputerName $Servidor -Count 10 -ErrorAction SilentlyContinue
$lt = @($lat | ForEach-Object { if ($_.Latency) { $_.Latency } else { $_.ResponseTime } })

$fila = [pscustomobject]@{
    Fecha = (Get-Date -Format 'yyyy-MM-dd HH:mm'); Origen = $Origen; Destino = $Servidor
    TCP_Subida_Mbps = if ($up) { [math]::Round($up.end.sum_received.bits_per_second / 1e6, 1) } else { $null }
    TCP_Bajada_Mbps = if ($down) { [math]::Round($down.end.sum_received.bits_per_second / 1e6, 1) } else { $null }
    Retransmisiones = if ($up) { $up.end.sum_sent.retransmits } else { $null }
    UDP_Jitter_ms = if ($udp) { [math]::Round($udp.end.sum.jitter_ms, 2) } else { $null }
    UDP_Perdida_pct = if ($udp) { [math]::Round($udp.end.sum.lost_percent, 2) } else { $null }
    Ping_ms = if ($lt) { [math]::Round(($lt | Measure-Object -Average).Average, 1) } else { $null }
}
Export-CsvProtegido $fila $historico -Anexar
$fila | Format-List
Write-Host "Referencia: un enlace de 1 Gbps sano da ~930-940 Mbps en TCP; 10 Gbps, ~9.4 Gbps con varios flujos."
