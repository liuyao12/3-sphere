# S³ Atlas

An interactive stereographic projection of the 3-sphere, with toggles for:

- a separating Clifford torus;
- linked circles from the Hopf fibration;
- the 600-cell, reconstructed as 120 vertices, 720 edges, and 600 tetrahedra;
- the 100 tetrahedra adjacent to a 100-triangle toroidal boundary.

The site is plain HTML, CSS, and JavaScript. Serve the directory locally with any static server, or open the published GitHub Pages URL.

## Geometry note

Choosing one decagonal great circle in the 600-cell and taking every tetrahedron incident to one of its vertices produces a 150-cell solid torus. Its boundary has 100 triangular faces and 50 vertices. Exactly 100 of the solid torus's tetrahedra touch that boundary. This is the combinatorial seam visualized by the “100 boundary cells” layer.

## Local preview

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
