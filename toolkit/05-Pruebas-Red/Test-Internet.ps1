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

# El ISP y el servidor los devuelve speedtest: se protegen antes de guardarlos en el CSV (fórmulas de Excel).
function Proteger-Celda($v) {
    if ($v -is [string] -and $v -match "^'*[=+\-@`t`r]") { return "'$v" }
    return $v
}
# Único punto del script que escribe CSV, para que ninguna exportación se salte Proteger-Celda.
function Export-CsvProtegido($Filas, [string]$Ruta, [switch]$Anexar) {
    $Filas | Where-Object { $null -ne $_ } | ForEach-Object { foreach ($c in $_.PSObject.Properties) { $c.Value = Proteger-Celda $c.Value }; $_ } |
        Export-Csv -Path $Ruta -Delimiter ';' -NoTypeInformation -Encoding UTF8 -Append:$Anexar
}

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
$motivo = if (Test-Path $bin) { Comprobar-Binario $bin }
if ($motivo) {
    Write-Warning "$motivo Se mide solo con ping."
} elseif (Test-Path $bin) {
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
Export-CsvProtegido $fila $historico -Anexar
$fila | Format-List
if ($fila.Pct_Contratado -and $fila.Pct_Contratado -lt 70) { Write-Warning "Velocidad por debajo del 70% de lo contratado." }
