"""Sirve la carpeta practica/ solo en local (127.0.0.1), con los tipos de archivo correctos.
Windows a veces dice que un .js es texto y el navegador no lo corre; aquí se fuerzan los tipos."""
import http.server
import os
import sys
import webbrowser
import threading

PUERTO = 8642
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'practica')

TIPOS = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.gz': 'application/octet-stream',
    '': 'application/octet-stream',
}


class Manejador(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=RAIZ, **k)

    def guess_type(self, path):
        return TIPOS.get(os.path.splitext(path)[1].lower(), super().guess_type(path))

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


def main():
    if not os.path.isfile(os.path.join(RAIZ, 'app', 'index.html')):
        print('No encuentro practica/app/index.html. Corre: npm run build:practica')
        sys.exit(1)
    if not os.path.isfile(os.path.join(RAIZ, 'datos', 'nq', 'manifest.json')):
        print('No encuentro los datos en practica/datos/nq/.')
        sys.exit(1)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PUERTO), Manejador)
    url = f'http://127.0.0.1:{PUERTO}/app/'
    print(f'Stunks esta corriendo en {url}')
    print('Para apagarlo, cierra esta ventana.')
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    srv.serve_forever()


if __name__ == '__main__':
    main()
