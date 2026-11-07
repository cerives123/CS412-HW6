function createCube() {
  const positions = new Float32Array([
    -1, -1,  1,   1, -1,  1,   1,  1,  1,  -1,  1,  1,   // front
     1, -1, -1,  -1, -1, -1,  -1,  1, -1,   1,  1, -1,   // back
    -1,  1,  1,   1,  1,  1,   1,  1, -1,  -1,  1, -1,   // top
    -1, -1, -1,   1, -1, -1,   1, -1,  1,  -1, -1,  1,   // bottom
     1, -1,  1,   1, -1, -1,   1,  1, -1,   1,  1,  1,   // right
    -1, -1, -1,  -1, -1,  1,  -1,  1,  1,  -1,  1, -1    // left
  ]);
  const faceNormals = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]];
  const normals = new Float32Array(faceNormals.flatMap(n => [...n, ...n, ...n, ...n]));

  // Tangent; bitangent = cross(N, T)
  const faceTangents = [[1, 0, 0], [-1, 0, 0], [1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]];
  const tangents = new Float32Array(faceTangents.flatMap(t => [...t, ...t, ...t, ...t]));

  const texCoords = new Float32Array(faceNormals.flatMap(() => [0, 0, 1, 0, 1, 1, 0, 1]));

  const indices = new Uint16Array([
     0,  1,  2,   0,  2,  3,   // front
     4,  5,  6,   4,  6,  7,   // back
     8,  9, 10,   8, 10, 11,   // top
    12, 13, 14,  12, 14, 15,   // bottom
    16, 17, 18,  16, 18, 19,   // right
    20, 21, 22,  20, 22, 23    // left
  ]);
  return { positions, normals, tangents, texCoords, indices };
}


function createCylinder(segments = 64, uRepeat = 3) {
  const positions = [], normals = [], tangents = [], texCoords = [], indices = [];

  // Side: theta grows with u, so T points along the circle and B = cross(N, T) points up
  for (let i = 0; i <= segments; i++) {
    const u = i / segments, theta = 2 * Math.PI * u;
    const s = Math.sin(theta), c = Math.cos(theta);
    for (const y of [-1, 1]) {
      positions.push(s, y, c);
      normals.push(s, 0, c);
      tangents.push(c, 0, -s);
      texCoords.push(u * uRepeat, (y + 1) / 2);
    }
  }
  for (let i = 0; i < segments; i++) {
    const k = 2 * i;
    indices.push(k, k + 2, k + 3, k, k + 3, k + 1);
  }

  // Caps: planar mapping of x, z into the texture, T = +x on both
  for (const y of [1, -1]) {
    const center = positions.length / 3;
    positions.push(0, y, 0);
    normals.push(0, y, 0);
    tangents.push(1, 0, 0);
    texCoords.push(0.5, 0.5);
    for (let i = 0; i <= segments; i++) {
      const theta = 2 * Math.PI * i / segments;
      const s = Math.sin(theta), c = Math.cos(theta);
      positions.push(s, y, c);
      normals.push(0, y, 0);
      tangents.push(1, 0, 0);
      texCoords.push(0.5 + 0.5 * s, 0.5 - 0.5 * y * c);  // keeps cross(N, T) along +v
    }
    for (let i = 0; i < segments; i++) {
      const a = center + 1 + i, b = a + 1;
      if (y > 0) indices.push(center, a, b);
      else indices.push(center, b, a);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    tangents: new Float32Array(tangents),
    texCoords: new Float32Array(texCoords),
    indices: new Uint16Array(indices)
  };
}


//Sphere for The Eye Orb
function createSphere(segments = 48, rings = 32) {
  const positions = [], normals = [], tangents = [],
        texCoords = [], indices = [];

  for (let j = 0; j <= rings; j++) {
    const v = j / rings;
    const phi = v * Math.PI;

    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const theta = (u - 0.5) * 2 * Math.PI;

      const s = Math.sin(theta), c = Math.cos(theta);
      const sp = Math.sin(phi), cp = Math.cos(phi);

      positions.push(sp * s, cp, sp * c);
      normals.push(sp * s, cp, sp * c);
      tangents.push(c, 0, -s);
      texCoords.push(u, 1 - v);
    }
  }

  const row = segments + 1;
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < segments; i++) {
      const k = j * row + i;
      indices.push(
        k, k + row, k + 1,
        k + 1, k + row, k + row + 1
      );
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    tangents: new Float32Array(tangents),
    texCoords: new Float32Array(texCoords),
    indices: new Uint16Array(indices)
  };
}

// Torus for The Halo
function createTorus(segments = 64, tubeSegments = 24) {
  const positions = [], normals = [], tangents = [],
        texCoords = [], indices = [];

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const theta = 2 * Math.PI * u;
    const s = Math.sin(theta), c = Math.cos(theta);

    for (let j = 0; j <= tubeSegments; j++) {
      const v = j / tubeSegments;
      const phi = 2 * Math.PI * v;
      const sp = Math.sin(phi), cp = Math.cos(phi);
      const r = 0.77 + 0.23 * cp;

      positions.push(r * s, 0.23 * sp, r * c);
      normals.push(cp * s, sp, cp * c);
      tangents.push(c, 0, -s);
      texCoords.push(u, v);
    }
  }

  const row = tubeSegments + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < tubeSegments; j++) {
      const k = i * row + j;
      indices.push(
        k, k + row, k + 1,
        k + 1, k + row, k + row + 1
      );
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    tangents: new Float32Array(tangents),
    texCoords: new Float32Array(texCoords),
    indices: new Uint16Array(indices)
  };
}


// Cone for The Fang
function createCone(segments = 64, rings = 24) {
  const positions = [], normals = [], tangents = [],
        texCoords = [], indices = [];

  // Multiple rings to curve the fang
  for (let j = 0; j <= rings; j++) {
    const v = j / rings;

    const y = -1 + 2 * v;

    //Fang gets narrower toward the tip
    const radius = 0.65 * Math.pow(1 - v, 1.35) + 0.005;

    // Bend the tip sideways
    const bendX = 0.5 * v * v;
    const bendZ = -0.13 * v * v;
    const dr = -0.65 * 1.35 * Math.pow(1 - v, 0.35);
    const dbx = 1.0 * v;
    const dbz = -0.26 * v;

    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const a = u * 2 * Math.PI;
      const s = Math.sin(a), c = Math.cos(a);

      positions.push(
        bendX + radius * s,
        y,
        bendZ + radius * c
      );

      // Normals account for the curved surface
      const nx = 2 * s;
      const ny = -(dr + dbx * s + dbz * c);
      const nz = 2 * c;
      const len = Math.hypot(nx, ny, nz);

      normals.push(nx / len, ny / len, nz / len);
      tangents.push(c, 0, -s);
      texCoords.push(u, v);
    }
  }
  const row = segments + 1;

  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < segments; i++) {
      const k = j * row + i;

      indices.push(
        k, k + 1, k + row,
        k + 1, k + row + 1, k + row
      );
    }
  }

  // Bottom cap
  const center = positions.length / 3;
  positions.push(0, -1, 0);
  normals.push(0, -1, 0);
  tangents.push(1, 0, 0);
  texCoords.push(0.5, 0.5);

  for (let i = 0; i <= segments; i++) {
    const a = i * 2 * Math.PI / segments;
    const s = Math.sin(a), c = Math.cos(a);

    positions.push(0.655 * s, -1, 0.655 * c);
    normals.push(0, -1, 0);
    tangents.push(1, 0, 0);
    texCoords.push(0.5 + 0.5 * s, 0.5 + 0.5 * c);
  }

  for (let i = 0; i < segments; i++) {
    indices.push(
      center, center + 2 + i, center + 1 + i
    );
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    tangents: new Float32Array(tangents),
    texCoords: new Float32Array(texCoords),
    indices: new Uint16Array(indices)
  };
}
