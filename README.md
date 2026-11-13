# EVO-Gaiia

Web estática para editar **cartas** (sobre) y **postales** (chica/grande), guardar PNG y armar PDF de impresión.

- Cartas: Letter, 2 por hoja (±45°)
- Postales: A4, cantidad por diseño, calle de corte entre piezas

## Uso en la Mac (desarrollo)

```bash
cd ~/Documents/EVO-Gaiia
python3 -m http.server 8080
```

Abre: [http://localhost:8080](http://localhost:8080)

## GitHub Pages

Cuando esté publicado:

**https://akyo403-march.github.io/EVO-Gaiia/**

En el iPad abre esa URL (Safari).

## Flujo

1. **Editar** carta o postal → encuadra, texto, logo/recuadro → **Guardar PNG**
2. **Armar PDF** → carga PNG → **Vista previa** → **Descargar PDF**

## Notas

- Plantillas en `templates/` (`sobre`, `postal-chica`, `postal-grande`)
- Logos: `assets/logo-black.png` / `logo-white.png`
- Navegador moderno (Safari / Chrome)
