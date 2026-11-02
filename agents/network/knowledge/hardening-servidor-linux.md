> Adaptado de DevOps-Security-Agent-Skills (BagelHole, MIT) y headcount (cbrock84, MIT): linux-hardening, firewall-config, systems-administration, network-administration.

# Hardening del servidor Linux y firewall

## Antes de empezar
Busca en la memoria corporativa: distribución y versión, servicios que corren (contenedores Docker, PostgreSQL, apps Node, n8n, proxy), puertos abiertos en el equipo y redirigidos en el router, cómo se entra por SSH, uso de Tailscale y quién administra. No copies IPs ni secretos al entregable: refiérete a "IP LAN", "IP pública" y nombres de variable. Lo que falte, márcalo FALTANTE. Separa "observado con evidencia" (salida de `ss -tlnp`, `ufw status verbose`, `sshd -T`) de "por comprobar".

Tú auditas y propones; aplicar cambios lo hace un humano, en ventana avisada y con acceso de emergencia (consola física o teclado y monitor en la oficina) disponible.

## Primero: qué está expuesto
Regla: hacia internet solo el proxy inverso en 80/443. Base de datos, n8n y apps Node quedan detrás del proxy o accesibles solo por la red privada (Tailscale o LAN).
- Si hay puertos de PostgreSQL, n8n o apps redirigidos directo en el router, es hallazgo **alto**: propón cerrarlos en el router y entrar por Tailscale o por el proxy con TLS. Escala a ciberseguridad y a infrastructure-lead.
- Compara tres vistas: lo que escucha el equipo (`ss -tlnp`), lo que permite el firewall y lo que redirige el router. Las diferencias son hallazgos.
- Docker publica puertos saltándose UFW: un `ports: "5432:5432"` en Compose queda abierto aunque UFW diga que no. Las reglas propias van en la cadena `DOCKER-USER`, o publica solo en `127.0.0.1` o no publiques y usa la red interna de Docker.

## SSH
- `PermitRootLogin no`, `PasswordAuthentication no`, `PubkeyAuthentication yes`, `MaxAuthTries 3`.
- `AllowUsers` con la lista explícita de usuarios administradores.
- Ideal: SSH solo desde la red de Tailscale o la LAN, no desde internet.
- Antes de recargar `sshd`, deja una sesión abierta y prueba otra nueva: así no te quedas fuera.

## Usuarios y privilegios
- Una cuenta por persona; nada de cuentas compartidas. Sudo solo a quien lo necesita, con registro.
- Bloquear cuentas inactivas y dar de baja accesos el mismo día de una salida.
- Servicios con usuario propio sin privilegios; contenedores sin `--privileged` y sin montar el socket de Docker salvo necesidad justificada.

## Firewall
- Política por defecto: negar entrada, permitir salida. Permitir conexiones establecidas y loopback.
- Abrir solo lo necesario, con comentario de para qué sirve y quién lo pidió.
- Limitar intentos a SSH (`ufw limit`) y usar fail2ban o equivalente.
- Registrar lo rechazado con límite de tasa para no saturar los logs.
- Reglas persistentes tras reinicio y copia de la versión que funciona antes de cambiar.
- Revisión mensual: quitar lo que ya no tiene razón. Reglas acumuladas sin revisar terminan siendo "permitir todo con pasos extra".
- Segmenta la red de oficina: equipos de usuarios, servidor, invitados e IoT (cámaras, impresoras) separados; lo no administrado es la entrada recurrente.

## Sistema
- Actualizaciones con cadencia fija; los servicios expuestos a internet primero. Actualizaciones de seguridad automáticas y reinicios en ventana.
- Kernel (`/etc/sysctl.d/`): sin redirecciones ICMP ni enrutamiento de origen, `kernel.randomize_va_space = 2`, `fs.suid_dumpable = 0`.
- Permisos: `/etc/shadow` 600, `sshd_config` 600, `.env` de cada servicio 600 y fuera de git.
- Buscar archivos con escritura para todos y binarios SUID inesperados.
- `auditd` vigilando `/etc/passwd`, `/etc/shadow` y `/etc/sudoers`.
- Desactivar servicios que no se usan; AppArmor activo.
- Hora sincronizada (NTP): sin ella fallan TLS, logs y respaldos.

## Línea base y deriva
Documenta la configuración esperada (paquetes, servicios, puertos, usuarios, reglas). Lo que cambia sin registro es deriva: el comportamiento de un servidor que ya no coincide con su base es desconocido ante un parche o una restauración.

## Qué entregar
Tabla de hallazgos: control, estado observado, evidencia, riesgo (alto, medio, bajo), cambio propuesto, comando sugerido, cómo revertirlo y quién debe aprobarlo. Arriba, los tres hallazgos de mayor riesgo.

## Errores comunes
- Activar "negar todo" antes de permitir SSH y quedarse fuera.
- Creer que UFW protege puertos que publicó Docker.
- Abrir PostgreSQL o n8n a internet "para probar" y olvidarlo.
- Reglas sin persistir que desaparecen al reiniciar.
- Dar por aplicado un cambio que solo se propuso.
