#!/usr/bin/env python3
# Lee HTML completo por stdin, escribe los bytes del PDF a stdout y {"pages": N} a stderr.
# Nunca toca el host ni la red (el contenedor que lo ejecuta corre con --network none): si el
# HTML referencia una imagen remota, WeasyPrint simplemente no puede cargarla y sigue sin ella.
import json
import sys

from weasyprint import HTML


def main() -> None:
    html = sys.stdin.read()
    document = HTML(string=html).render()
    sys.stderr.write(json.dumps({"pages": len(document.pages)}))
    sys.stderr.write("\n")
    sys.stderr.flush()
    document.write_pdf(target=sys.stdout.buffer)


if __name__ == "__main__":
    main()
