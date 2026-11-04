# DuoMe

Mockups 3D del iPhone Duo en sus tres posiciones (cerrado, semiabierto y abierto), cada una en vertical u horizontal. Subís una imagen por vista, girás el Duo con el mouse y exportás un PNG sin fondo.

## Qué hace

- **Modelo 1:1.** El Duo está modelado en milímetros con las medidas publicadas: 117,8 mm de alto, 84,1 mm de ancho cerrado, 164,6 mm abierto, 11,3 mm de grosor cerrado y 5,2 mm abierto. Las pantallas usan su tamaño físico real, calculado a partir de la resolución y la densidad:
  - exterior: 5,4 in, 1398 x 2034 px a 460 ppi (77,2 x 112,3 mm)
  - interior: 7,6 in, 2670 x 1878 px a 430 ppi (157,7 x 110,9 mm)
- **Seis vistas.** Cerrado, semiabierto (libro parado o apoyado como laptop) y abierto, en vertical u horizontal. Cada vista tiene su propia imagen y muestra el tamaño recomendado.
- **Bisagra libre.** El dial y el campo de grados mueven la bisagra entre 0° y 180°, con topes en 0°, 90° y 180°.
- **Cámara.** Arrastrá el Duo para girarlo y usá la rueda para acercarte. También hay encuadres rápidos (Frente, Tres cuartos, Perfil, Cenital) y controles de giro e inclinación.
- **Carga de imágenes.** Arrastrá una imagen sobre su lugar, hacé clic para elegirla, soltala sobre el Duo o pegala con ⌘V. Si soltás varias juntas, DuoMe propone dónde va cada una según su forma.
- **Exportar PNG.** Se recorta al contorno del Duo, en 2K, 4K u 8K, con fondo transparente y sombra opcional.
- **Pantalla completa y vista previa** para ver solo el Duo. Esc sale.
- **Apariencia clara y oscura** según el sistema. También responde a movimiento reducido, transparencia reducida y más contraste.


## Usarlo en tu compu

Necesitás Node 20 o superior.

```bash
npm install
npm run dev
```

Abrí la dirección que muestra la terminal (por defecto http://localhost:5173).

Para generar la versión final en `dist/`:

```bash
npm run build
npm run preview
```


## Notas

- iPhone y iPhone Duo son marcas de Apple Inc. Este proyecto no está afiliado a Apple.
