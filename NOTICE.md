# Attribution and scope

This application implements an ideal SI point-dipole forward model. Its source
is MIT licensed; third-party dependencies retain their own licenses.

- Three.js, React Three Fiber and Drei: 3D rendering and interaction (MIT).
- React: interface state and composition (MIT).
- uPlot: scientific line charts (MIT).
- Lucide: interface icons (ISC).
- Vite, TypeScript and Vitest: development/build/testing tools, under their
  respective upstream licenses.

The scientific blue/orange/yellow plotting convention is inspired by familiar
MATLAB figures. The continuous color ramp is independently interpolated; it is
not an exact implementation of a proprietary named colormap. MATLAB is a
trademark of The MathWorks, Inc.; this project is not affiliated with MathWorks.
See the [color-order documentation](https://www.mathworks.com/help/matlab/ref/colororder.html).

Interaction inspiration: [Induction Bench](https://github.com/thebuggeddev/electromagnetism).
No source artwork or finite-cylinder/coil model from that project is included.
The scene uses procedural geometry rather than external images or recordings.
