<#
.SYNOPSIS
  Pruebas de seguridad de los scripts del toolkit. Sin dependencias (no requiere Pester).

.DESCRIPTION
  Ejecuta los scripts en copias dentro de una carpeta temporal y comprueba:
  - Descubrir-Red.ps1 rechaza prefijos y rangos no válidos antes de hacer nada.
  - Las celdas que Excel interpretaría como fórmula se exportan protegidas.
  - Test-RedInterna.ps1 y Test-Internet.ps1 no ejecutan binarios cuyo SHA-256 no esté registrado.
  Sale con código 1 si falla alguna prueba.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\toolkit\tests\Test-Toolkit.ps1
#>
$ErrorActionPreference = 'Stop'
$toolkit = Split-Path $PSScriptRoot
$fallos = 0

function Prueba([string]$nombre, [scriptblock]$cuerpo) {
    try { & $cuerpo; Write-Host "OK   $nombre" -ForegroundColor Green }
    catch { $script:fallos++; Write-Host "FAIL $nombre`n     $($_.Exception.Message)" -ForegroundColor Red }
}
function Igual($real, $esperado) {
    if ($real -cne $esperado) { throw "Esperado: [$esperado]  Obtenido: [$real]" }
}
function Contiene([string]$texto, [string]$fragmento) {
    if (-not $texto.Contains($fragmento)) { throw "No contiene [$fragmento]: [$texto]" }
}
# Carga una función de un script sin ejecutar el script (por su AST).
function Importar-Funcion([string]$script, [string]$funcion) {
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($script, [ref]$null, [ref]$null)
    $def = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $funcion }, $true)
    if (-not $def) { throw "$funcion no está definida en $script" }
    . ([scriptblock]::Create($def.Extent.Text))
    Set-Item "function:global:$funcion" (Get-Item "function:$funcion").ScriptBlock
}
# Ejecuta un script en un PowerShell nuevo y devuelve su salida (errores incluidos) y su código de salida.
# Los errores salen como el texto de la excepción, sin el formato de consola que los parte en varias líneas.
function Ejecutar([string]$script, [string[]]$argumentos) {
    $citar = { "'" + ([string]$args[0]).Replace("'", "''") + "'" }
    $lista = ($argumentos | ForEach-Object { if ($_ -match '^-[A-Za-z]+$') { $_ } else { & $citar $_ } }) -join ' '
    $comando = "try { & $(& $citar $script) $lista } catch { `$_.Exception.Message; exit 1 }"
    $codificado = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($comando))
    $salida = & powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand $codificado 2>&1 | Out-String
    [pscustomobject]@{ Salida = $salida; Codigo = $LASTEXITCODE }
}

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("toolkit-tests-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
    # --- Descubrir-Red.ps1: validación de parámetros ---
    $descubrir = Join-Path $tmp 'Descubrir-Red.ps1'
    Copy-Item (Join-Path $toolkit '00-Descubrimiento\Descubrir-Red.ps1') $descubrir

    # Todos los casos apuntan a loopback o a direcciones no enrutables y a una sola IP: aunque la
    # validación fallara, el script nunca sondea la red real.
    foreach ($malo in '..\..\x', '127.0.0.0', '300.0.0', '127.0', '127.0.0;calc', '00.0.0', "127.0.0`n") {
        Prueba "Descubrir-Red rechaza el prefijo '$malo'" {
            $r = Ejecutar $descubrir @('-Prefijo', $malo, '-Desde', '1', '-Hasta', '1')
            Contiene $r.Salida 'Prefijo no válido'
            if ($r.Codigo -eq 0) { throw 'Debería salir con error' }
            if (Get-ChildItem $tmp -Recurse -Filter 'descubrimiento_*') { throw 'No debería generar ningún CSV' }
        }
    }
    Prueba 'Descubrir-Red rechaza Desde fuera de 1-254' {
        $r = Ejecutar $descubrir @('-Prefijo', '127.0.0', '-Desde', '0', '-Hasta', '1')
        if ($r.Codigo -eq 0) { throw 'Debería salir con error' }
    }
    Prueba 'Descubrir-Red rechaza Desde mayor que Hasta' {
        $r = Ejecutar $descubrir @('-Prefijo', '127.0.0', '-Desde', '2', '-Hasta', '1')
        Contiene $r.Salida 'Desde (2) no puede ser mayor que Hasta (1)'
        if ($r.Codigo -eq 0) { throw 'Debería salir con error' }
    }

    # --- Protección contra fórmulas en los CSV exportados ---
    foreach ($s in 'Descubrir-Red.ps1', 'Test-Internet.ps1', 'Test-RedInterna.ps1') {
        $ruta = Get-ChildItem $toolkit -Recurse -Filter $s | Select-Object -First 1 -ExpandProperty FullName
        Prueba "$s protege las celdas con fórmulas" {
            Importar-Funcion $ruta 'Proteger-Celda'
            Igual (Proteger-Celda '=HYPERLINK("http://x","clic")') "'=HYPERLINK(""http://x"",""clic"")"
            Igual (Proteger-Celda '+34 600') "'+34 600"
            Igual (Proteger-Celda '-1') "'-1"
            Igual (Proteger-Celda '@SUM(A1)') "'@SUM(A1)"
            Igual (Proteger-Celda "`tcmd") "'`tcmd"
            Igual (Proteger-Celda "'=x") "''=x"
            Igual (Proteger-Celda 'srv01') 'srv01'
            Igual (Proteger-Celda '') ''
            Igual (Proteger-Celda 42) 42
            Igual (Proteger-Celda $null) $null
        }
        Prueba "$s solo usa Export-Csv dentro de Export-CsvProtegido" {
            $ast = [System.Management.Automation.Language.Parser]::ParseFile($ruta, [ref]$null, [ref]$null)
            $exportaciones = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] -and $n.GetCommandName() -eq 'Export-Csv' }, $true)
            if (-not $exportaciones) { throw 'No hay ningún Export-Csv' }
            foreach ($e in $exportaciones) {
                $p = $e.Parent
                while ($p -and $p -isnot [System.Management.Automation.Language.FunctionDefinitionAst]) { $p = $p.Parent }
                if (-not $p -or $p.Name -ne 'Export-CsvProtegido') { throw "Export-Csv fuera de Export-CsvProtegido (línea $($e.Extent.StartLineNumber))" }
            }
        }
        Prueba "$s guarda el CSV con las celdas protegidas" {
            Importar-Funcion $ruta 'Proteger-Celda'
            Importar-Funcion $ruta 'Export-CsvProtegido'
            $csv = Join-Path $tmp "protegido-$s.csv"
            Export-CsvProtegido @([pscustomobject]@{ Nombre = '=HYPERLINK("http://x")'; Puertos = 'SSH'; Total = 3 }) $csv
            Export-CsvProtegido @([pscustomobject]@{ Nombre = '@srv'; Puertos = ''; Total = -1 }) $csv -Anexar
            $filas = @(Import-Csv $csv -Delimiter ';')
            Igual $filas.Count 2
            Igual $filas[0].Nombre "'=HYPERLINK(""http://x"")"
            Igual $filas[0].Puertos 'SSH'
            Igual $filas[0].Total '3'
            Igual $filas[1].Nombre "'@srv"
            Igual $filas[1].Total '-1'
        }
        Prueba "$s crea un CSV vacío sin errores cuando no hay filas" {
            Importar-Funcion $ruta 'Proteger-Celda'
            Importar-Funcion $ruta 'Export-CsvProtegido'
            $csv = Join-Path $tmp "vacio-$s.csv"
            Export-CsvProtegido $null $csv   # $ErrorActionPreference = 'Stop': cualquier error hace fallar la prueba
            Igual (Get-Item $csv).Length ([long]3)   # solo el BOM, igual que antes
        }
    }

    # --- Verificación SHA-256 de binarios ---
    foreach ($s in 'Test-RedInterna.ps1', 'Test-Internet.ps1') {
        Prueba "$s verifica el SHA-256 de los binarios" {
            Importar-Funcion (Join-Path $toolkit "05-Pruebas-Red\$s") 'Comprobar-Binario'
            $bin = Join-Path $tmp "bin-$s"; New-Item -ItemType Directory -Path $bin | Out-Null
            $exe = Join-Path $bin 'herramienta.exe'; Set-Content $exe 'contenido' -NoNewline
            $hash = (Get-FileHash -Algorithm SHA256 $exe).Hash
            Contiene (Comprobar-Binario $exe) 'No hay hash registrado para herramienta.exe'
            Set-Content (Join-Path $bin 'SHA256SUMS.txt') ("{0}  herramienta.exe" -f ('0' * 64))
            Contiene (Comprobar-Binario $exe) 'no coincide'
            Set-Content (Join-Path $bin 'SHA256SUMS.txt') ("# comentario`n{0} *otra.exe`n{1}  herramienta.exe" -f ('1' * 64), $hash.ToLower())
            Igual (Comprobar-Binario $exe) $null
        }
    }

    $redInterna = Join-Path $tmp 'red\Test-RedInterna.ps1'
    New-Item -ItemType Directory -Path (Join-Path $tmp 'red\bin') | Out-Null
    Copy-Item (Join-Path $toolkit '05-Pruebas-Red\Test-RedInterna.ps1') $redInterna
    $iperf = Join-Path $tmp 'red\bin\iperf3.exe'
    # Un ejecutable inofensivo hace de iperf3: si se llegara a ejecutar sin verificar, crearía el histórico.
    Copy-Item "$env:SystemRoot\System32\whoami.exe" $iperf
    $sums = Join-Path $tmp 'red\bin\SHA256SUMS.txt'
    $historico = Join-Path $tmp 'red\resultados\red-interna.csv'

    Prueba 'Test-RedInterna no ejecuta iperf3 sin hash registrado' {
        $r = Ejecutar $redInterna @('-Servidor', '127.0.0.1', '-Segundos', '1')
        Contiene $r.Salida 'No hay hash registrado para iperf3.exe'
        if (Test-Path $historico) { throw 'No debería haber medido nada' }
    }
    Prueba 'Test-RedInterna no ejecuta iperf3 si su hash no coincide' {
        Set-Content $sums ("{0}  iperf3.exe" -f ('0' * 64))
        $r = Ejecutar $redInterna @('-Servidor', '127.0.0.1', '-Segundos', '1')
        Contiene $r.Salida 'no coincide'
        if (Test-Path $historico) { throw 'No debería haber medido nada' }
    }
    Prueba 'Test-RedInterna comprueba también cygwin1.dll si existe' {
        Set-Content $sums ("{0}  iperf3.exe" -f (Get-FileHash -Algorithm SHA256 $iperf).Hash)
        Set-Content (Join-Path $tmp 'red\bin\cygwin1.dll') 'dll'
        try {
            $r = Ejecutar $redInterna @('-Servidor', '127.0.0.1', '-Segundos', '1')
            Contiene $r.Salida 'No hay hash registrado para cygwin1.dll'
            if (Test-Path $historico) { throw 'No debería haber medido nada' }
        }
        finally { Remove-Item (Join-Path $tmp 'red\bin\cygwin1.dll') }
    }
    Prueba 'Test-RedInterna ejecuta iperf3 cuando su hash coincide' {
        $r = Ejecutar $redInterna @('-Servidor', '127.0.0.1', '-Segundos', '1')
        if (-not (Test-Path $historico)) { throw "Debería haber guardado la medición. Salida: $($r.Salida)" }
    }
}
finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

if ($fallos) { Write-Host "$fallos prueba(s) fallida(s)." -ForegroundColor Red; exit 1 }
Write-Host 'Todas las pruebas pasan.' -ForegroundColor Green
