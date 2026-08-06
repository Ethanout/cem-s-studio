(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CemSBlockbenchAdapter = api;
}(typeof globalThis === 'undefined' ? this : globalThis, function () {
function vec3(value, fallback) {
  return Array.isArray(value) && value.length === 3 ? value.slice() : fallback.slice();
}

function assertNoRotatedParent(cube) {
  let parent = cube.parent;
  while (parent) {
    if (Array.isArray(parent.rotation) && parent.rotation.some((angle) => angle !== 0)) {
      throw new Error(`cube "${cube.name || 'unnamed'}" is inside rotated group "${parent.name || 'unnamed'}"; bake the group rotation before export`);
    }
    parent = parent.parent;
  }
}

function assertSingleAxisRotation(cube) {
  const activeAxes = vec3(cube.rotation, [0, 0, 0]).filter((angle) => angle !== 0);
  if (activeAxes.length > 1) throw new Error(`cube "${cube.name || 'unnamed'}" has multi-axis rotation; use one axis until Euler order support is added`);
}

function toCemPart(cube, index) {
  assertNoRotatedParent(cube);
  assertSingleAxisRotation(cube);
  const from = vec3(cube.from, [0, 0, 0]);
  const to = vec3(cube.to, [0, 0, 0]);
  const faceOrder = ['down', 'up', 'north', 'east', 'south', 'west'];
  const faces = faceOrder.map((side) => {
    const face = cube.faces && cube.faces[side];
    if (face && face.enabled === false) throw new Error(`cube "${cube.name || 'unnamed'}" has disabled face "${side}"; disabled faces are not supported`);
    if (face && face.rotation && face.rotation % 360 !== 0) throw new Error(`cube "${cube.name || 'unnamed'}" has rotated face "${side}"; rotate UVs manually before export`);
    const uv = face && face.uv;
    return uv && [uv[0], uv[1], uv[2] - uv[0], uv[3] - uv[1]];
  });
  const part = {
    name: cube.name || `cube_${index + 1}`,
    type: 'cube',
    origin: to.map((value, axis) => (value + from[axis]) / 2),
    size: to.map((value, axis) => (value - from[axis]) / 2),
    // CEM-S's ADD_BOX_ROTATE subtracts rotPivot after applying Rotation;
    // negating Blockbench's pivot yields the standard rotate-around-pivot transform.
    pivot: vec3(cube.origin, from).map((value) => value === 0 ? 0 : -value),
    rotation: vec3(cube.rotation, [0, 0, 0])
  };
  if (faces.some(Boolean)) part.faces = faces;
  return part;
}

function toCemModel(name, cubes) {
  if (!Array.isArray(cubes)) throw new Error('cubes must be an array');
  return {name: name || 'cem_model', parts: cubes.map(toCemPart)};
}

return {toCemModel};
}));
