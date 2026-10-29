<#
.SYNOPSIS
  Descubre equipos activos en una subred /24 y genera un CSV listo para el inventario.

.DESCRIPTION
  1. Ping a todas las IPs del rango (en paralelo).
  2. Nombre por DNS inverso y MAC por la tabla ARP (solo en la misma VLAN).
  3. Comprueba puertos TCP habituales para sugerir el tipo de equipo.
  Úsalo solo en redes de la empresa y con autorización.

.EXAMPLE
  .\Descubrir-Red.ps1 -Prefijo 192.168.1
  .\Descubrir-Red.ps1 -Prefijo 192.168.10 -Desde 1 -Hasta 50
#>
param(
    [Parameter(Mandatory = $true)][string]$Prefijo,   # p. ej. 192.168.1
    [int]$Desde = 1,
    [int]$Hasta = 254,
    [int]$TimeoutMs = 600
)

$ErrorActionPreference = 'SilentlyContinue'
$puertos = @{
    22 = 'SSH'; 23 = 'Telnet'; 80 = 'HTTP'; 443 = 'HTTPS'; 445 = 'SMB'; 3389 = 'RDP';
    5985 = 'WinRM'; 902 = 'ESXi'; 8006 = 'Proxmox'; 9100 = 'Impresora'; 10050 = 'ZabbixAgent'; 8443 = 'HTTPS-alt'
}

Write-Host "Ping a $Prefijo.$Desde - $Prefijo.$Hasta ..." -ForegroundColor Cyan
$tareas = @{}
foreach ($i in $Desde..$Hasta) {
    $ip = "$Prefijo.$i"
    $tareas[$ip] = (New-Object System.Net.NetworkInformation.Ping).SendPingAsync($ip, $TimeoutMs)
}
[System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]$tareas.Values) | Out-Null
$vivos = $tareas.GetEnumerator() | Where-Object { $_.Value.Result.Status -eq 'Success' } |
    ForEach-Object { $_.Key } | Sort-Object { [version]$_ }
Write-Host ("Equipos que responden: {0}" -f $vivos.Count) -ForegroundColor Green

function Test-Puerto([string]$ip, [int]$p) {
    $c = New-Object System.Net.Sockets.TcpClient
    $ok = $c.ConnectAsync($ip, $p).Wait(400) -and $c.Connected
    $c.Close(); return $ok
}

function Sugerir-Tipo($abiertos) {
    if ($abiertos -contains 'ESXi') { return 'hipervisor' }
    if ($abiertos -contains 'Proxmox') { return 'hipervisor' }
    if ($abiertos -contains 'Impresora') { return 'impresora' }
    if ($abiertos -contains 'RDP' -or $abiertos -contains 'WinRM') { return 'servidor' }
    if ($abiertos -contains 'SMB') { return 'servidor' }
    if ($abiertos -contains 'SSH' -and $abiertos -contains 'HTTPS') { return 'switch/firewall?' }
    return 'otro'
}

$vecinos = @{}
Get-NetNeighbor -AddressFamily IPv4 | ForEach-Object { $vecinos[$_.IPAddress] = $_.LinkLayerAddress }

$res = foreach ($ip in $vivos) {
    $nombre = try { ([System.Net.Dns]::GetHostEntry($ip)).HostName } catch { '' }
    $abiertos = @(); foreach ($p in $puertos.Keys) { if (Test-Puerto $ip $p) { $abiertos += $puertos[$p] } }
    Write-Host ("{0,-16} {1,-30} {2}" -f $ip, $nombre, ($abiertos -join ','))
    [pscustomobject]@{
        Nombre = $(if ($nombre) { $nombre.Split('.')[0] } else { "SIN-NOMBRE-$($ip.Split('.')[-1])" })
        Tipo = (Sugerir-Tipo $abiertos); Marca = ''; Modelo = ''; IP_Gestion = $ip
        Ubicacion = ''; Rol = ''; Criticidad = ''; Uplink = ''; Firmware = ''; Fin_Soporte = ''
        Metodo_Monitorizacion = ''; Monitorizado = 'No'
        Notas = "MAC $($vecinos[$ip]) | Puertos: $($abiertos -join ',')"
    }
}

$salida = Join-Path $PSScriptRoot ("descubrimiento_{0}_{1}.csv" -f $Prefijo.Replace('.', '-'), (Get-Date -Format 'yyyyMMdd-HHmm'))
$res | Export-Csv -Path $salida -Delimiter ';' -NoTypeInformation -Encoding UTF8
Write-Host "CSV generado: $salida" -ForegroundColor Green
Write-Host "Revisa el tipo sugerido, completa marca/modelo/uplink y pásalo a 01-Inventario\inventario.csv"
