const registries = {};
const builtIns = {};
const validators = {};

export function defineType(type, validator) {
  if (registries[type]) {
    throw new Error(`Registry type "${type}" is already defined`);
  }
  registries[type] = new Map();
  builtIns[type] = new Set();
  validators[type] = validator;
}

export function registerBuiltIn(type, name, impl) {
  assertTypeDefined(type);
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

/** Test-only: reset all registries. Not exported in the bundle. */
export function _resetForTesting() {
  for (const key of Object.keys(registries)) {
    delete registries[key];
    delete builtIns[key];
    delete validators[key];
  }
}
