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

function scaleVector(group, elementName) {
  const scale = group.scale;
  if (!scale) return [1, 1, 1];
  const values = Array.isArray(scale) ? scale : [scale, scale, scale];
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value) || value === 0)) throw new Error(`element "${elementName}" has invalid group scale`);
  return values;
}

function scaleMatrix(scale) {
  return [scale[0], 0, 0, 0, scale[1], 0, 0, 0, scale[2]];
}

function length3(value) {
  return Math.hypot(value[0], value[1], value[2]);
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function bakedTransform(cube, from, to) {
  const name = cube.name || 'unnamed';
  const cubeRotation = vec3(cube.rotation, [0, 0, 0]);
  const cubePivot = vec3(cube.origin, from);
  let center = to.map((value, axis) => (value + from[axis]) / 2);
  let linear = eulerMatrix(cubeRotation);
  center = cubePivot.map((value, axis) => value + mat3Vector(linear, center.map((item, index) => item - cubePivot[index]))[axis]);
  let parent = cube.parent;
  while (parent) {
    const parentRotation = eulerMatrix(vec3(parent.rotation, [0, 0, 0]));
    const parentOrigin = vec3(parent.origin, [0, 0, 0]);
    const scale = scaleVector(parent, name);
    const parentLinear = mat3Multiply(parentRotation, scaleMatrix(scale));
    center = parentOrigin.map((value, axis) => value + mat3Vector(parentLinear, center.map((item, index) => item - parentOrigin[index]))[axis]);
    linear = mat3Multiply(parentLinear, linear);
    parent = parent.parent;
  }
  const columns = [[linear[0], linear[3], linear[6]], [linear[1], linear[4], linear[7]], [linear[2], linear[5], linear[8]]];
  const axisScales = columns.map(length3);
  const normalized = columns.map((column, index) => column.map(value => value / axisScales[index]));
  if (Math.abs(dot3(normalized[0], normalized[1])) > 1e-5 || Math.abs(dot3(normalized[0], normalized[2])) > 1e-5 || Math.abs(dot3(normalized[1], normalized[2])) > 1e-5) {
    throw new Error(`cube "${name}" has a sheared transform that CEM-S boxes cannot represent`);
  }
  const rotation = [normalized[0][0], normalized[1][0], normalized[2][0], normalized[0][1], normalized[1][1], normalized[2][1], normalized[0][2], normalized[1][2], normalized[2][2]];
  const inverseRotation = transpose(rotation);
  return {
    origin: mat3Vector(inverseRotation, center),
    size: to.map((value, axis) => (value - from[axis]) / 2 * axisScales[axis]),
    pivot: [0, 0, 0],
    rotationMatrix: rotation
  };
}

function subtract(a, b) {
  return a.map((value, index) => value - b[index]);
}

function transformPoint(element, point, anchorOrigin) {
  let transformed = point.slice();
  let current = element;
  while (current) {
    const origin = vec3(current.origin, [0, 0, 0]);
    const rotation = eulerMatrix(vec3(current.rotation, [0, 0, 0]));
    const scale = scaleVector(current, element.name || 'unnamed');
    transformed = origin.map((value, axis) => value + mat3Vector(rotation, transformed.map((item, pointAxis) => (item - origin[pointAxis]) * scale[pointAxis]))[axis]);
    current = current.parent;
  }
  return subtract(transformed, anchorOrigin);
}

function nearlyEqual(a, b, epsilon = 1e-5) {
  return Math.abs(a - b) <= epsilon;
}

function sameVec3(a, b) {
  return a.every((value, index) => nearlyEqual(value, b[index]));
}

function toCemSquareParts(mesh, index, anchorOrigin = [0, 0, 0]) {
  const vertices = mesh.vertices || {};
  const faces = mesh.faces || {};
  const parts = [];
  for (const [faceKey, face] of Object.entries(faces)) {
    if (face?.enabled === false) continue;
    const ids = Array.isArray(face?.vertices) ? face.vertices : [];
    if (ids.length !== 4) throw new Error(`mesh "${mesh.name || 'unnamed'}" face "${faceKey}" must have four vertices for ADD_SQUARE`);
    const points = Object.fromEntries(ids.map(id => [id, vec3(vertices[id], [NaN, NaN, NaN])]));
    if (Object.values(points).some(point => point.some(value => !Number.isFinite(value)))) throw new Error(`mesh "${mesh.name || 'unnamed'}" face "${faceKey}" has an invalid vertex`);
    const uvById = face.uv || {};
    const uvPoints = ids.map(id => ({id, uv: uvById[id]}));
    if (uvPoints.some(item => !Array.isArray(item.uv) || item.uv.length !== 2 || item.uv.some(value => !Number.isFinite(value)))) throw new Error(`mesh "${mesh.name || 'unnamed'}" face "${faceKey}" requires per-vertex UV coordinates`);
    const uValues = uvPoints.map(item => item.uv[0]);
    const vValues = uvPoints.map(item => item.uv[1]);
    const minU = Math.min(...uValues), maxU = Math.max(...uValues), minV = Math.min(...vValues), maxV = Math.max(...vValues);
    if (nearlyEqual(minU, maxU) || nearlyEqual(minV, maxV)) throw new Error(`mesh "${mesh.name || 'unnamed'}" face "${faceKey}" has a zero-size UV rectangle`);
    const at = (u, v) => uvPoints.find(item => nearlyEqual(item.uv[0], u) && nearlyEqual(item.uv[1], v));
    const corners = [at(minU, minV), at(maxU, minV), at(minU, maxV), at(maxU, maxV)];
    if (corners.some(value => !value) || new Set(corners.map(value => value.id)).size !== 4) throw new Error(`mesh "${mesh.name || 'unnamed'}" face "${faceKey}" UV must be rectangular`);
    const localPoints = corners.slice(0, 3).map(item => points[item.id]);
    const expectedFourth = localPoints[1].map((value, axis) => value + localPoints[2][axis] - localPoints[0][axis]);
    if (!sameVec3(points[corners[3].id], expectedFourth)) throw new Error(`mesh "${mesh.name || 'unnamed'}" face "${faceKey}" must be a parallelogram for ADD_SQUARE`);
    parts.push({
      name: `${mesh.name || `mesh_${index + 1}`}/${faceKey}`,
      type: 'square',
      points: localPoints.map(point => transformPoint(mesh, point, anchorOrigin)),
      uv: [minU, minV, maxU - minU, maxV - minV]
    });
  }
  if (!parts.length) throw new Error(`mesh "${mesh.name || 'unnamed'}" has no exportable faces`);
  return parts;
}

function toCemCubePart(cube, index, anchorOrigin = [0, 0, 0]) {
  const from = vec3(cube.from, [0, 0, 0]);
  const to = vec3(cube.to, [0, 0, 0]);
  const faceOrder = ['down', 'up', 'north', 'east', 'south', 'west'];
  const faces = faceOrder.map((side) => {
    const face = cube.faces && cube.faces[side];
    if (face && face.enabled === false) return undefined;
    const uv = face && face.uv;
    if (!uv) return undefined;
    const rotation = ((Number(face.rotation) || 0) % 360 + 360) % 360;
    if (rotation === 90 || rotation === 270) throw new Error(`cube "${cube.name || 'unnamed'}" face "${side}" uses ${rotation}-degree UV rotation, which CEM-S ADD_BOX cannot represent`);
    if (rotation !== 0 && rotation !== 180) throw new Error(`cube "${cube.name || 'unnamed'}" face "${side}" has an invalid UV rotation`);
    return rotation === 180
      ? [uv[2], uv[3], uv[0] - uv[2], uv[1] - uv[3]]
      : [uv[0], uv[1], uv[2] - uv[0], uv[3] - uv[1]];
  });
  const rotation = vec3(cube.rotation, [0, 0, 0]);
  const hasParent = Boolean(cube.parent);
  const multiAxis = rotation.filter((angle) => angle !== 0).length > 1;
  const baked = (hasParent || multiAxis) ? bakedTransform(cube, from, to) : null;
  const part = {
    name: cube.name || `cube_${index + 1}`,
    type: 'cube',
    origin: subtract(baked ? baked.origin : to.map((value, axis) => (value + from[axis]) / 2), anchorOrigin),
    size: baked ? baked.size : to.map((value, axis) => (value - from[axis]) / 2),
    // CEM-S's ADD_BOX_ROTATE subtracts rotPivot after applying Rotation;
    // negating Blockbench's pivot yields the standard rotate-around-pivot transform.
    pivot: baked ? baked.pivot : vec3(cube.origin, from).map((value, axis) => {
      const shifted = anchorOrigin[axis] - value;
      return shifted === 0 ? 0 : shifted;
    }),
    rotation
  };
  if (baked) part.rotationMatrix = baked.rotationMatrix;
  if (faces.some(Boolean)) part.faces = faces;
  return part;
}

function isReferenceCube(cube, reference) {
  if (Array.isArray(reference?.guides) && reference.guides.includes(cube?.uuid)) return true;
  return typeof cube?.name === 'string' && cube.name.startsWith('[CEM-S Reference]');
}

function bindingForCube(cube, reference) {
  const bindings = reference?.bindings || {};
  let element = cube;
  while (element) {
    const key = element.uuid || element.name;
    if (key && Object.prototype.hasOwnProperty.call(bindings, key)) return bindings[key];
    element = element.parent;
  }
  return null;
}

function anchorOriginForCube(cube, reference) {
  const anchor = bindingForCube(cube, reference);
  if (!anchor) return [0, 0, 0];
  const referenceId = reference?.anchors?.[anchor];
  if (!referenceId) throw new Error(`bound reference anchor "${anchor}" is missing`);
  let element = cube.parent;
  while (element) {
    if (element.uuid === referenceId || element.name === referenceId) return vec3(element.origin, [0, 0, 0]);
    element = element.parent;
  }
  throw new Error(`bound reference anchor "${anchor}" is not present in the Outliner`);
}

function toCemModel(name, cubes, options = {}) {
  if (!Array.isArray(cubes)) throw new Error('cubes must be an array');
  const exportable = options.includeReference ? cubes : cubes.filter((cube) => !isReferenceCube(cube, options.reference));
  const parts = exportable.flatMap((element, index) => {
    const anchorOrigin = anchorOriginForCube(element, options.reference);
    return element.vertices && element.faces
      ? toCemSquareParts(element, index, anchorOrigin)
      : [toCemCubePart(element, index, anchorOrigin)];
  });
  return {name: name || 'cem_model', parts};
}

function toCemModels(name, cubes, options = {}) {
  const branches = options.branches || [];
  if (!Array.isArray(branches) || !branches.length) throw new Error('detection branches are required');
  if (branches.length === 1) return [{branch: branches[0], model: toCemModel(name, cubes, options)}];
  const buckets = new Map(branches.map(branch => [branch.anchor, []]));
  for (const cube of cubes.filter(item => options.includeReference || !isReferenceCube(item, options.reference))) {
    const anchor = bindingForCube(cube, options.reference);
    if (!anchor) throw new Error(`cube "${cube.name || 'unnamed'}" is not inside a detection anchor`);
    else if (buckets.has(anchor)) buckets.get(anchor).push(cube);
    else throw new Error(`cube "${cube.name || 'unnamed'}" is bound to anchor "${anchor}", but no detection branch targets it`);
  }
  return branches.map(branch => ({
    branch,
    model: toCemModel(`${name || 'cem_model'}_${branch.id}`, buckets.get(branch.anchor), options)
  }));
}

return {toCemModel, toCemModels, bindingForCube, isReferenceCube};
}));
