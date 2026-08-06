(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CemSBlockbenchAdapter = api;
}(typeof globalThis === 'undefined' ? this : globalThis, function () {
function vec3(value, fallback) {
  return Array.isArray(value) && value.length === 3 ? value.slice() : fallback.slice();
}

function mat3Multiply(a, b) {
  const out = Array(9).fill(0);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    out[row * 3 + col] = a[row * 3] * b[col] + a[row * 3 + 1] * b[col + 3] + a[row * 3 + 2] * b[col + 6];
  }
  return out;
}

function mat3Vector(m, v) {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}

function transpose(m) {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

function eulerMatrix(rotation) {
  const [rx, ry, rz] = rotation.map((angle) => angle * Math.PI / 180);
  const sx = Math.sin(rx), cx = Math.cos(rx), sy = Math.sin(ry), cy = Math.cos(ry), sz = Math.sin(rz), cz = Math.cos(rz);
  const x = [1, 0, 0, 0, cx, sx, 0, -sx, cx];
  const y = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
  const z = [cz, sz, 0, -sz, cz, 0, 0, 0, 1];
  return mat3Multiply(z, mat3Multiply(y, x));
}

function uniformScale(group, cubeName) {
  const scale = group.scale;
  if (!scale) return 1;
  const values = Array.isArray(scale) ? scale : [scale, scale, scale];
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) throw new Error(`cube "${cubeName}" has invalid group scale`);
  if (values[0] !== values[1] || values[1] !== values[2]) throw new Error(`cube "${cubeName}" has non-uniform scale in group "${group.name || 'unnamed'}"`);
  return values[0];
}

function bakedTransform(cube, from, to) {
  const name = cube.name || 'unnamed';
  const cubeRotation = vec3(cube.rotation, [0, 0, 0]);
  const cubePivot = vec3(cube.origin, from);
  let center = to.map((value, axis) => (value + from[axis]) / 2);
  let rotation = eulerMatrix(cubeRotation);
  center = cubePivot.map((value, axis) => value + mat3Vector(rotation, center.map((item, index) => item - cubePivot[index]))[axis]);
  let sizeScale = 1;
  let parent = cube.parent;
  while (parent) {
    const parentRotation = eulerMatrix(vec3(parent.rotation, [0, 0, 0]));
    const parentOrigin = vec3(parent.origin, [0, 0, 0]);
    const scale = uniformScale(parent, name);
    center = parentOrigin.map((value, axis) => value + mat3Vector(parentRotation, center.map((item, index) => item - parentOrigin[index]))[axis] * scale);
    rotation = mat3Multiply(parentRotation, rotation);
    sizeScale *= scale;
    parent = parent.parent;
  }
  const inverseRotation = transpose(rotation);
  return {
    origin: mat3Vector(inverseRotation, center),
    size: to.map((value, axis) => (value - from[axis]) / 2 * sizeScale),
    pivot: [0, 0, 0],
    rotationMatrix: rotation
  };
}

function toCemPart(cube, index) {
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
  const rotation = vec3(cube.rotation, [0, 0, 0]);
  const hasParent = Boolean(cube.parent);
  const multiAxis = rotation.filter((angle) => angle !== 0).length > 1;
  const baked = (hasParent || multiAxis) ? bakedTransform(cube, from, to) : null;
  const part = {
    name: cube.name || `cube_${index + 1}`,
    type: 'cube',
    origin: baked ? baked.origin : to.map((value, axis) => (value + from[axis]) / 2),
    size: baked ? baked.size : to.map((value, axis) => (value - from[axis]) / 2),
    // CEM-S's ADD_BOX_ROTATE subtracts rotPivot after applying Rotation;
    // negating Blockbench's pivot yields the standard rotate-around-pivot transform.
    pivot: baked ? baked.pivot : vec3(cube.origin, from).map((value) => value === 0 ? 0 : -value),
    rotation
  };
  if (baked) part.rotationMatrix = baked.rotationMatrix;
  if (faces.some(Boolean)) part.faces = faces;
  return part;
}

function toCemModel(name, cubes) {
  if (!Array.isArray(cubes)) throw new Error('cubes must be an array');
  return {name: name || 'cem_model', parts: cubes.map(toCemPart)};
}

return {toCemModel};
}));
