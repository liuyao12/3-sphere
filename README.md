# S³ Atlas

An interactive stereographic projection of the 3-sphere, with toggles for:

- a separating Clifford torus;
- linked circles from the Hopf fibration;
- the regular 4-simplex (5-cell), with five tetrahedral chambers;
- the 600-cell, reconstructed as 120 vertices, 720 edges, and 600 tetrahedra;
- the dual 120-cell, reconstructed as 600 vertices and 1,200 edges;
- selected Hopf fibers and the polytope cells they cross;
- cell-centered inside views with clickable shared faces.

The site is plain HTML, CSS, and JavaScript. Serve the directory locally with any static server, or open the published GitHub Pages URL.

Shareable modes include `?mode=hopf`, `?mode=4-simplex`, `?mode=600-cell`, and `?mode=120-cell`.

## Local preview

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
