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

$bin = Join-Path $PSScriptRoot 'bin\iperf3.exe'
if (-not (Test-Path $bin)) { throw "No se encuentra $bin. Descarga iperf3 para Windows y copia iperf3.exe en la carpeta bin." }
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
$fila | Export-Csv -Path $historico -Delimiter ';' -NoTypeInformation -Append -Encoding UTF8
$fila | Format-List
Write-Host "Referencia: un enlace de 1 Gbps sano da ~930-940 Mbps en TCP; 10 Gbps, ~9.4 Gbps con varios flujos."
