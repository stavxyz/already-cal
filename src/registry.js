const registries = Object.create(null);
const builtIns = Object.create(null);
const validators = Object.create(null);

export function defineType(type, validator) {
  if (registries[type]) {
    throw new Error(`Registry type "${type}" is already defined`);
  }
  if (typeof validator !== "function") {
    throw new TypeError(
      `Registry "${type}": validator must be a function, got: ${typeof validator}`,
    );
  }
  registries[type] = new Map();
  builtIns[type] = new Set();
  validators[type] = validator;
}

export function registerBuiltIn(type, name, impl) {
  assertTypeDefined(type);
  if (typeof name !== "string" || name === "") {
    throw new Error(
      `Registry "${type}": name must be a non-empty string, got: ${typeof name}`,
    );
  }
  if (builtIns[type].has(name)) {
    throw new Error(
      `Registry "${type}": built-in "${name}" is already registered`,
    );
  }
  validators[type](name, impl);
  registries[type].set(name, impl);
  builtIns[type].add(name);
}

export function register(type, name, impl) {
  assertTypeDefined(type);
  if (typeof name !== "string" || name === "") {
    throw new Error(
      `Registry "${type}": name must be a non-empty string, got: ${typeof name}`,
    );
  }
  if (builtIns[type].has(name)) {
    throw new Error(
      `Registry "${type}": "${name}" is a built-in and cannot be overridden`,
    );
  }
  validators[type](name, impl);
  registries[type].set(name, impl);
}

/**
 * Retrieve a registered entry. Returns fallback (or undefined) if the type
 * is not defined or the name is not registered. Intentionally lenient —
 * get/has never throw so that rendering code can fall back gracefully,
 * while register/registerBuiltIn are strict and throw on misuse.
 */
export function get(type, name, fallback) {
  if (!registries[type]) return fallback;
  return registries[type].get(name) ?? fallback;
}

export function has(type, name) {
  if (!registries[type]) return false;
  return registries[type].has(name);
}

function assertTypeDefined(type) {
  if (!registries[type]) {
    throw new Error(`Registry type "${type}" is not defined`);
  }
}

/**
 * Test-only: reset all registries. Tree-shaken from the IIFE bundle
 * because nothing in the entry graph imports it.
 */
export function _resetForTesting() {
  for (const key of Object.keys(registries)) {
    delete registries[key];
    delete builtIns[key];
    delete validators[key];
  }
}
