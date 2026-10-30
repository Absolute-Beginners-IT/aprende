# Pruebas de velocidad de red

## Qué medir y dónde

| Prueba | Desde | Hasta | Herramienta | Qué te dice |
| --- | --- | --- | --- | --- |
| Internet | Un PC fijo por sede (cable) | Servidor de speedtest | `Test-Internet.ps1` | Si la operadora entrega lo contratado y a qué horas se satura |
| Ping a DNS públicos | Igual | 1.1.1.1 / 8.8.8.8 | `Test-Internet.ps1` | Pérdida y jitter (calidad para Teams/VoIP) |
| Red interna (LAN) | Un PC en cada planta/VLAN | Servidor iperf3 en el CPD | `Test-RedInterna.ps1` | Cuellos de botella en uplinks, cableado o switches |
| Entre sedes | Un PC en la sede remota | Servidor iperf3 en el CPD | `Test-RedInterna.ps1` | Rendimiento real de la VPN/SD-WAN |
| Wifi | Portátil en cada zona | Servidor iperf3 | `Test-RedInterna.ps1` | Cobertura y capacidad por zona |

## Montaje (una vez)

1. Descarga `iperf3.exe` y `speedtest.exe` (Ookla CLI) en `bin\` y registra su SHA-256 en `bin\SHA256SUMS.txt` tras compararlo con el que publica el fabricante (pasos en `bin\LEEME.txt`). Los scripts no ejecutan un binario cuyo hash no esté registrado o no coincida.
2. En un servidor del CPD con tarjeta de 10 Gbps (o 1 Gbps), deja `iperf3.exe -s` como servicio o tarea programada, y abre TCP/UDP 5201 solo desde las redes internas.
3. Programa `Test-Internet.ps1` en el Programador de tareas 3 veces al día.
4. Los resultados se acumulan en `resultados\*.csv`. Pega las filas en la sección **Pruebas de red** del mapa interactivo para verlas en gráfico.

## Valores de referencia

- Enlace de 1 Gbps sano: 930-940 Mbps en TCP. Por debajo de 800 Mbps, revisar dúplex, cable o CPU.
- Enlace de 10 Gbps: ~9,4 Gbps con 4-8 flujos.
- Pérdida en LAN: 0 %. Cualquier pérdida sostenida es un problema.
- Jitter para voz/vídeo: < 30 ms; latencia en LAN < 1-2 ms.
- Internet: alerta si baja del 70 % de lo contratado de forma repetida.
- Haz siempre las pruebas por **cable**; por wifi miden el wifi, no la red.
