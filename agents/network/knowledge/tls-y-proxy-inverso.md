> Adaptado de DevOps-Security-Agent-Skills (BagelHole, MIT): ssl-tls-management, reverse-proxy.

# TLS y proxy inverso

## Antes de empezar
Busca en la memoria corporativa: dominios y subdominios en uso, quién controla el DNS, qué proxy está instalado (Caddy, nginx, Traefik), qué servicio va detrás de cada nombre y la fecha de vencimiento de cada certificado. Confirma si la IP pública de la oficina es fija o cambia: si cambia, se necesita DNS dinámico y los certificados pueden fallar al renovarse. Lo que falte, márcalo FALTANTE. No escribas IPs ni claves en el entregable.

## Arquitectura recomendada
Un solo proxy inverso escucha en 80 y 443, termina TLS y reenvía por HTTP a los servicios internos (contenedores en la red de Docker o puertos en `127.0.0.1`). Ningún servicio interno se publica directo a internet. Un subdominio por servicio (por ejemplo, uno para n8n y otro para la API) facilita certificados, reglas y logs separados.

## Certificados
- Let's Encrypt con renovación automática: Caddy lo hace solo; con nginx, certbot con temporizador de systemd y un gancho que recargue el proxy.
- Requisitos para emitir: el registro DNS ya apunta a la IP pública y el puerto 80 llega desde internet (reto HTTP). Si no, la emisión falla y el servicio "parece caído".
- Comodines (`*.dominio`) requieren reto DNS y una credencial del proveedor de DNS: guárdala con permisos 600, nunca en el repositorio.
- Probar la renovación (`certbot renew --dry-run`) después de cualquier cambio de proxy o firewall.
- Vigilar vencimientos con alertas a 30 y a 7 días (referencia general de la fuente) y mantener un inventario de certificados.
- Llaves privadas con permisos 600; si una llave se expone, revocar y reemitir.

## Configuración TLS
- Solo TLS 1.2 y 1.3.
- Redirigir HTTP a HTTPS con 301, dejando accesible la ruta `/.well-known/acme-challenge/`.
- HSTS (`Strict-Transport-Security`) solo cuando todo el dominio y subdominios ya sirven HTTPS; un `preload` mal puesto es difícil de deshacer.
- Encabezados: `X-Content-Type-Options nosniff`, `X-Frame-Options DENY` (o la política que la app necesite), `Referrer-Policy strict-origin-when-cross-origin`.
- Cadena completa (certificado intermedio incluido) o algunos clientes fallarán.
- Verificar con una prueba externa de TLS después de cada cambio.

## Reenvío al servicio
- Pasar `Host`, `X-Real-IP`, `X-Forwarded-For` y `X-Forwarded-Proto`; sin este último aparecen redirecciones a `http` y contenido mixto.
- La app debe confiar solo en los encabezados del proxy (en n8n, `N8N_PROXY_HOPS=1`).
- WebSockets (el editor de n8n los usa): `proxy_http_version 1.1` con encabezados `Upgrade` y `Connection`, y tiempo de lectura amplio en esa ruta.
- Límites de tasa por zona para endpoints públicos (webhooks, login), con ráfaga razonable.
- Rutas de administración solo desde la red privada (lista de IP o Tailscale).

## Diagnóstico rápido
| Síntoma | Causa probable | Qué revisar |
|---|---|---|
| 502 | Servicio detenido o dirección incorrecta | Que el contenedor esté arriba y la dirección de `proxy_pass` |
| 504 | Servicio lento | Tiempo de lectura del proxy y rendimiento del servicio |
| Contenido mixto o bucle de redirección | Falta `X-Forwarded-Proto` o la app no confía en el proxy | Encabezados y configuración de la app |
| WebSocket se corta | Tiempo de espera por defecto | Ampliar tiempo de lectura en esa ruta |
| No renueva | Puerto 80 cerrado o DNS no apunta | Router, firewall y registro DNS |
| Falla el saludo TLS | Cadena incompleta | Incluir el intermedio |

## Qué entregar
Mapa nombre → servicio interno → puerto, estado de cada certificado (emisor, vencimiento, renovación probada), configuración propuesta en bloques comentados, pruebas de verificación y cómo revertir (copia de la configuración anterior y prueba de sintaxis antes de recargar: `nginx -t` o `caddy validate`).

## Errores comunes
- Recargar el proxy sin probar la sintaxis.
- Publicar el puerto del servicio además del proxy.
- Cerrar el puerto 80 y romper la renovación.
- Activar HSTS con `preload` antes de tener todo en HTTPS.
- Confiar en `X-Forwarded-For` de cualquier origen.
