<#
.SYNOPSIS
  Mide la conexión a Internet (bajada, subida, latencia, jitter, pérdida) y la guarda en un CSV histórico.

.DESCRIPTION
  Usa Ookla Speedtest CLI (speedtest.exe en .\bin). Además hace ping a 1.1.1.1 y 8.8.8.8
  para medir pérdida y latencia sin depender del servidor de speedtest.
  Programable con el Programador de tareas (p. ej. cada día a las 8:00, 13:00 y 18:00).

.EXAMPLE
  .\Test-Internet.ps1 -Sede "Central" -ContratadoMbps 1000
#>
param(
    [string]$Sede = $env:COMPUTERNAME,
    [int]$ContratadoMbps = 0,
    [int]$PingsPorDestino = 20
)

$bin = Join-Path $PSScriptRoot 'bin\speedtest.exe'
$historico = Join-Path $PSScriptRoot 'resultados\internet.csv'
New-Item -ItemType Directory -Force -Path (Split-Path $historico) | Out-Null

# 1. Ping a DNS públicos (latencia, jitter y pérdida)
$ping = foreach ($d in '1.1.1.1', '8.8.8.8') {
    $r = Test-Connection -ComputerName $d -Count $PingsPorDestino -ErrorAction SilentlyContinue
    $tiempos = @($r | ForEach-Object { if ($_.Latency) { $_.Latency } else { $_.ResponseTime } })
    $jit = 0; for ($i = 1; $i -lt $tiempos.Count; $i++) { $jit += [math]::Abs($tiempos[$i] - $tiempos[$i - 1]) }
    [pscustomobject]@{
        Destino = $d
        Perdida = [math]::Round((1 - ($tiempos.Count / $PingsPorDestino)) * 100, 1)
        Media = if ($tiempos) { [math]::Round(($tiempos | Measure-Object -Average).Average, 1) } else { $null }
        Jitter = if ($tiempos.Count -gt 1) { [math]::Round($jit / ($tiempos.Count - 1), 1) } else { $null }
    }
}

# 2. Speedtest
$bajada = $subida = $latSt = $servidor = $isp = $url = $null
if (Test-Path $bin) {
    $json = & $bin --accept-license --accept-gdpr --format=json 2>$null | ConvertFrom-Json
    if ($json) {
        $bajada = [math]::Round($json.download.bandwidth * 8 / 1e6, 1)   # bytes/s -> Mbps
        $subida = [math]::Round($json.upload.bandwidth * 8 / 1e6, 1)
        $latSt = [math]::Round($json.ping.latency, 1)
        $servidor = "$($json.server.name) ($($json.server.location))"
        $isp = $json.isp; $url = $json.result.url
    }
} else {
    Write-Warning "No se encuentra $bin. Descarga Ookla Speedtest CLI y copia speedtest.exe en la carpeta bin."
}

$fila = [pscustomobject]@{
    Fecha = (Get-Date -Format 'yyyy-MM-dd HH:mm'); Sede = $Sede; Equipo = $env:COMPUTERNAME
    Bajada_Mbps = $bajada; Subida_Mbps = $subida; Latencia_ms = $latSt
    Pct_Contratado = if ($ContratadoMbps -and $bajada) { [math]::Round($bajada / $ContratadoMbps * 100) } else { $null }
    Ping_1111_ms = $ping[0].Media; Perdida_1111 = $ping[0].Perdida; Jitter_1111 = $ping[0].Jitter
    Ping_8888_ms = $ping[1].Media; Perdida_8888 = $ping[1].Perdida
    Servidor = $servidor; ISP = $isp; URL_Resultado = $url
}
$fila | Export-Csv -Path $historico -Delimiter ';' -NoTypeInformation -Append -Encoding UTF8
$fila | Format-List
if ($fila.Pct_Contratado -and $fila.Pct_Contratado -lt 70) { Write-Warning "Velocidad por debajo del 70% de lo contratado." }
