# DuoMe

3D mockups of iPhone Duo in its three positions (closed, half-open and open), each one vertical or horizontal. Upload one image per view, rotate the Duo with your mouse and export a PNG with a transparent background.

## What it does

- **1:1 model.** The Duo is modeled in millimeters using its published measurements: 117.8 mm tall, 84.1 mm wide closed, 164.6 mm open, 11.3 mm thick closed and 5.2 mm open. The displays use their real physical size, calculated from resolution and pixel density:
  - outer: 5.4 in, 1398 x 2034 px at 460 ppi (77.2 x 112.3 mm)
  - inner: 7.6 in, 2670 x 1878 px at 430 ppi (157.7 x 110.9 mm)
- **Six views.** Closed, half-open (standing like a book or resting like a laptop) and open, vertical or horizontal. Each view has its own image and shows the recommended size.
- **Free hinge.** The dial and the degrees field move the hinge between 0° and 180°, with stops at 0°, 90° and 180°.
- **Hinge animation.** With *Animate hinge* on, the Duo opens and closes smoothly when you move the hinge, and its screens react like the real one: the outer display blurs and turns off, and the inner half that swings sharpens once it lies flat. *Play opening* and *Play closing* run the whole movement.
- **Camera.** Drag the Duo to rotate it and use the wheel to zoom. There are also quick framings (Front, Three-quarter, Side, Top) and turn and tilt controls.
- **Image upload.** Drag an image onto its slot, drop it on the Duo or paste it with ⌘V. If you drop several at once, DuoMe suggests where each one goes based on its shape.
- **PNG export.** Cropped to the outline of the Duo, at 2K, 4K or 8K, with a transparent background and optional shadow.
- **Full screen and preview** to see only the Duo. Esc exits.
- **Light and dark appearance** following the system. It also responds to reduced motion, reduced transparency and increased contrast.


## Run it on your computer

You need Node 20 or later.

```bash
npm install
npm run dev
```

Open the address shown in the terminal (by default http://localhost:5173).

To build the final version into `dist/`:

```bash
npm run build
npm run preview
```


## Notes

- iPhone and iPhone Duo are trademarks of Apple Inc. This project is not affiliated with Apple.
