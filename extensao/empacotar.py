#!/usr/bin/env python3
"""Gera public/extensao/conferidor-guias-extensao.zip (baixado pelo botão do site)."""
import zipfile, pathlib
raiz = pathlib.Path(__file__).resolve().parent
saida = raiz.parent / 'public' / 'extensao' / 'conferidor-guias-extensao.zip'
saida.parent.mkdir(parents=True, exist_ok=True)
arquivos = ['manifest.json', 'captura-main.js', 'ponte.js', 'conferidor.js', 'fundo.js', 'LEIA-ME.md', 'icones/icon-32.png', 'icones/icon-192.png']
with zipfile.ZipFile(saida, 'w', zipfile.ZIP_DEFLATED) as z:
    for a in arquivos:
        zi = zipfile.ZipInfo('conferidor-guias-extensao/' + a, date_time=(2026, 1, 1, 0, 0, 0)); zi.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(zi, (raiz / a).read_bytes())
print('gerado', saida, saida.stat().st_size, 'bytes')
