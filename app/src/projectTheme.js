/** Project-local values. The locked shared snapshot remains the source of truth. */
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const fail = message => { throw new Error(message); };

export function validateProjectTheme(project) {
  if (!object(project?.snapshot) || !Array.isArray(project.snapshot.tokens)) fail('项目缺少有效的规范快照。');
  const overrides = project.themeOverrides ?? {};
  if (!object(overrides)) fail('项目规范覆盖必须是对象。');
  const tokens = new Map(project.snapshot.tokens.map(token => [token.id, token]));
  for (const [id, values] of Object.entries(overrides)) {
    const token = tokens.get(id);
    if (!token) fail(`项目规范引用了不存在的变量「${id}」，请先处理覆盖再升级。`);
    if (!object(values) || !Object.keys(values).length) fail(`变量「${token.name}」的项目覆盖不能为空。`);
    for (const [key, value] of Object.entries(values)) {
      if (!['value', 'darkValue'].includes(key)) fail(`变量「${token.name}」只允许覆盖浅色值或深色值。`);
      const expected = ['number', 'duration'].includes(token.type) ? 'number' : token.type === 'boolean' ? 'boolean' : 'string';
      if (typeof value !== expected || (expected === 'number' && !Number.isFinite(value))) fail(`变量「${token.name}」的项目覆盖需要有效的 ${expected} 值。`);
      if (token.type === 'duration' && value < 0) fail(`变量「${token.name}」的时长不能小于 0。`);
      if (typeof value === 'number' && Number.isFinite(token.min) && value < token.min) fail(`变量「${token.name}」不能小于 ${token.min}。`);
      if (typeof value === 'number' && Number.isFinite(token.max) && value > token.max) fail(`变量「${token.name}」不能大于 ${token.max}。`);
    }
  }
  return true;
}

/** Resolve aliases with project overrides, then materialize only overridden tokens. */
export function applyProjectTheme(project) {
  validateProjectTheme(project);
  const snapshot = clone(project.snapshot);
  const overrides = project.themeOverrides ?? {};
  const tokens = new Map(project.snapshot.tokens.map(token => [token.id, token]));
  function resolve(id, dark, visited = new Set()) {
    const token = tokens.get(id);
    if (!token) fail(`找不到项目变量「${id}」。`);
    if (visited.has(id)) fail(`项目变量存在循环引用「${id}」。`);
    const field = dark ? 'darkValue' : 'value';
    if (own(overrides[id] || {}, field)) return overrides[id][field];
    if (dark && token.darkValue !== undefined && token.darkValue !== null) return token.darkValue;
    if (token.alias) return resolve(token.alias, dark, new Set([...visited, id]));
    // Changing a light-mode value never silently changes its inherited dark mode.
    return token.value;
  }
  snapshot.tokens = snapshot.tokens.map(token => {
    if (!own(overrides, token.id)) return token;
    const effective = { ...token, value: resolve(token.id, false), darkValue: resolve(token.id, true) };
    delete effective.alias;
    return effective;
  });
  return snapshot;
}

export const resolveProjectTheme = applyProjectTheme;

export function resetProjectThemeValue(overrides, tokenId, field) {
  const next = clone(overrides || {});
  if (!next[tokenId]) return next;
  if (field) delete next[tokenId][field];
  else delete next[tokenId];
  if (next[tokenId] && !Object.keys(next[tokenId]).length) delete next[tokenId];
  return next;
}
