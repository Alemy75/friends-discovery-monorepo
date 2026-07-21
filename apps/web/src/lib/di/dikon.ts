// Vendored from https://github.com/temoncher/dikon (temoncher) — copy-in DI library, no npm package.
// Kept verbatim; do not edit.
/**
 * Creates a dikon when called without arguments.
 *
 * ```ts
 * const createHttpClient = (baseUrl: string) => ({
 *     get: <T>(path: string) => fetch(`${baseUrl}${path}`).then((r) => r.json() as Promise<T>),
 * });
 *
 * const di = dikon()
 *     .require<{ config: { readonly baseUrl: string } }>()
 *     .provide({ httpClient: ({ config }) => createHttpClient(config.baseUrl) })
 *     .build({ config: { baseUrl: 'https://api.example.com' } });
 *
 * await di.httpClient.get<readonly { id: number; title: string }[]>('/posts');
 * ```
 */
export function dikon(): Dikon<{}, {}> {
  return createDikon([]);
}

/**
 * Iterates already-created service instances, starting from the given
 * container and then walking parent dikon containers through the prototype
 * chain. It does not initialize unread lazy services, and it does not include
 * required build values supplied to `build(...)`.
 *
 * ```ts
 * const rootDi = dikon()
 *     .provide({
 *         rootService() {
 *             return { id: 'root' };
 *         },
 *     })
 *     .build();
 *
 * const routeDi = dikon()
 *     .require<typeof rootDi>()
 *     .provide({
 *         routeService({ rootService }) {
 *             return { rootId: rootService.id };
 *         },
 *     })
 *     .build(undefined, rootDi);
 *
 * routeDi.routeService;
 *
 * for (const [key, instance, ownerDi] of dikon.instances(routeDi)) {
 *     // Stop before root services so route-only handling does not touch app-scoped instances.
 *     if (ownerDi === rootDi) {
 *         break;
 *     }
 *
 *     // Handle route-owned instances only.
 * }
 * ```
 */
dikon.instances = function instances(
  container: object,
): IterableIterator<readonly [key: PropertyKey, instance: unknown, di: object]> {
  return iterateInstances(container);
};

/**
 * The single runtime export for dikon.
 *
 * ```ts
 * import { dikon } from './dikon';
 *
 * const di = dikon()
 *     .require<{ config: { readonly num: number } }>()
 *     .provide({
 *         value({ config }) {
 *             return config.num + 2;
 *         },
 *     })
 *     .build({ config: { num: 40 } });
 *
 * console.log(di.value); // 42
 * ```
 */
export namespace dikon {
  /**
   * Extracts the built container type from a composed dikon.
   *
   * Use this when you export a reusable dikon builder and want a matching
   * container type without exporting the internal type ledgers.
   *
   * ```ts
   * export const appDiModule = dikon()
   *     .require<{ config: { readonly baseUrl: string } }>()
   *     .provide({
   *         url({ config }) {
   *             return `${config.baseUrl}/posts`;
   *         },
   *     });
   *
   * export type AppDi = dikon.Of<typeof appDiModule>;
   *
   * const getPostsUrl = (di: AppDi) => di.url;
   * ```
   */
  export type Of<T extends AnyDikon> = Built<DikonAvailable<T>>;
}

/**
 * A composable DI module builder.
 *
 * The generic parameters are internal type ledgers:
 *
 * - `TProvided` contains services created by provider layers.
 * - `TRequires` contains values still needed from `build(...)`, a parent, or
 *   compatible providers added directly or through `.use(...)`.
 *
 * dikon declares these parameters invariant so TypeScript does not
 * recalculate variance through every fluent step, which matters for long
 * `.use(...)` chains.
 *
 * ```ts
 * const appDiModule = dikon()
 *     .require<{ config: { readonly baseUrl: string } }>()
 *     .provide({
 *         url({ config }) {
 *             return `${config.baseUrl}/posts`;
 *         },
 *     });
 *
 * const di = appDiModule.build({ config: { baseUrl: 'https://api.test' } });
 *
 * di.url; // 'https://api.test/posts'
 * ```
 */
interface Dikon<in out TProvided, in out TRequires> {
  [__dikonTypes]: {
    provided: TProvided;
    requires: TRequires;
  };
  /**
   * Declares dependencies that must be supplied to `build(...)`, inherited
   * from a parent, or satisfied by compatible providers added directly or
   * through `.use(...)`. A requirement cannot redeclare an existing key.
   *
   * ```ts
   * interface Config {
   *     readonly baseUrl: string;
   * }
   *
   * const di = dikon()
   *     .require<{ config: Config }>()
   *     .provide({
   *         url({ config }) {
   *             return `${config.baseUrl}/posts`;
   *         },
   *     })
   *     .build({ config: { baseUrl: 'https://api.test' } });
   *
   * di.url; // 'https://api.test/posts'
   * ```
   */
  require<TNewRequires extends object>(
    ...conflictingKeys: Extract<
      keyof TNewRequires,
      keyof Available<TProvided, TRequires>
    > extends never
      ? []
      : [conflictingKeys: Extract<keyof TNewRequires, keyof Available<TProvided, TRequires>>]
  ): Dikon<TProvided, Merge<TRequires, TNewRequires>>;
  /**
   * Adds a layer of services. Factories can read dependencies that existed
   * before this layer, including required values and parent services. Existing
   * provided keys cannot be replaced here. A compatible service can satisfy a
   * required key, including after dependent providers were declared.
   *
   * ```ts
   * const createHttpClient = (baseUrl: string) => ({
   *     get: <T>(path: string) => fetch(`${baseUrl}${path}`).then((r) => r.json() as Promise<T>),
   * });
   *
   * const di = dikon()
   *     .require<{ config: { readonly baseUrl: string } }>()
   *     .provide({ httpClient: ({ config }) => createHttpClient(config.baseUrl) })
   *     .build({ config: { baseUrl: 'https://api.example.com' } });
   *
   * await di.httpClient.get<readonly { id: number; title: string }[]>('/posts');
   * ```
   */
  provide<
    TNewDeps extends {
      [K in keyof TNewDeps]: (
        di: Built<SimplifyOmit<Available<TProvided, TRequires>, K>>,
      ) => unknown;
    },
  >(
    newDeps: TNewDeps,
    ...typeErrors: [ProviderIssues<TNewDeps, TProvided, TRequires>] extends [never]
      ? []
      : [typeErrors: ProviderIssues<TNewDeps, TProvided, TRequires>]
  ): Dikon<Merge<TProvided, ToInstances<TNewDeps>>, SimplifyOmit<TRequires, keyof TNewDeps>>;
  /**
   * Replaces an existing provided service while preserving its public type.
   * Required inputs cannot be overridden, and factories cannot read sibling
   * services replaced in the same override layer.
   *
   * ```ts
   * const di = dikon()
   *     .provide({
   *         clock() {
   *             return { now: () => Date.now() };
   *         },
   *     })
   *     .override({
   *         clock: () => ({ now: () => 0 }),
   *     })
   *     .build();
   *
   * di.clock.now(); // 0
   * ```
   */
  override<const TKeys extends PropertyKey>(newDeps: {
    [K in TKeys]: K extends keyof TProvided
      ? (di: Built<SimplifyOmit<Available<TProvided, TRequires>, TKeys>>) => TProvided[K]
      : never;
  }): Dikon<TProvided, TRequires>;
  /**
   * Builds a container with lazy services. Each service factory runs only when
   * the service is first read, then the instance is cached on that container.
   * Choose this when startup should stay cheap or some services may never be
   * used. Factory side effects and errors happen on first read.
   *
   * ```ts
   * const parent = dikon()
   *     .provide({
   *         config() {
   *             return { baseUrl: 'https://api.test' };
   *         },
   *     })
   *     .build();
   *
   * const child = dikon()
   *     .require<typeof parent>()
   *     .provide({
   *         url({ config }) {
   *             return `${config.baseUrl}/posts`;
   *         },
   *     })
   *     .build(undefined, parent);
   *
   * child.url; // 'https://api.test/posts'
   * ```
   *
   * Pass `undefined` as the first argument when the child has no local
   * required values and only needs a parent container.
   *
   * When a parent object is passed, the container uses it as its prototype.
   * Local required values and services shadow parent values. If the parent
   * is another dikon container, inherited lazy services stay cached on that
   * parent.
   */
  build<TParent extends object>(
    ...args: ParentBuildArgs<TRequires, TParent>
  ): Built<Available<TProvided, TRequires>>;
  build(...args: StandaloneBuildArgs<TRequires>): Built<Available<TProvided, TRequires>>;
  /**
   * Merges another standalone DI module into this one. That DI module is authored
   * as its own `dikon()` chain with concrete types, so its services and
   * requirements are type-checked once, in isolation, instead of being
   * re-instantiated against this dikon's generic type parameters.
   *
   * Its services are appended after the current layers. Services on either side
   * satisfy matching requirements when their types are assignable; remaining
   * requirements bubble up to build time. Provider collisions and incompatible
   * requirement types are rejected. Use `.override(...)` after composition when
   * a service should be replaced.
   *
   * ```ts
   * const createHttpClient = (baseUrl: string) => ({
   *     get: <T>(path: string) => fetch(`${baseUrl}${path}`).then((r) => r.json() as Promise<T>),
   * });
   *
   * const httpClientDiModule = dikon()
   *     .require<{ config: { readonly baseUrl: string } }>()
   *     .provide({ httpClient: ({ config }) => createHttpClient(config.baseUrl) });
   *
   * const di = dikon()
   *     .use(httpClientDiModule)
   *     .build({ config: { baseUrl: 'https://api.example.com' } });
   *
   * await di.httpClient.get<readonly { id: number; title: string }[]>('/posts');
   * ```
   */
  use<TOther extends AnyDikon>(
    other: TOther,
    ...typeErrors: [UseIssues<TProvided, TRequires, TOther>] extends [never]
      ? []
      : [typeErrors: UseIssues<TProvided, TRequires, TOther>]
  ): Dikon<
    Merge<TProvided, DikonProvided<TOther>>,
    SimplifyOmit<
      MergeRequirements<TRequires, DikonRequires<TOther>>,
      keyof Merge<TProvided, DikonProvided<TOther>>
    >
  >;
}

type AnyFunction = (...args: any[]) => any;
type Simplify<T> = {
  [K in keyof T]: T[K];
} & {};
type SimplifyOmit<T, K extends PropertyKey> = Simplify<{
  [P in keyof T as P extends K ? never : P]: T[P];
}>;
type Merge<A, B> = Simplify<SimplifyOmit<A, keyof B> & B>;
type ToInstances<T> = Simplify<{
  [K in keyof T]: T[K] extends AnyFunction ? ReturnType<T[K]> : never;
}>;
type Built<T> = Readonly<T>;
type Available<TProvided, TRequires> = Merge<TRequires, TProvided>;

type FactoryMap = Record<PropertyKey, (di: unknown) => unknown>;
type InstanceCache = Map<PropertyKey, unknown>;
type AnyDikon = Dikon<any, any>;

type DikonProvided<T extends AnyDikon> = T[typeof __dikonTypes]['provided'];
type DikonRequires<T extends AnyDikon> = T[typeof __dikonTypes]['requires'];
type DikonAvailable<T extends AnyDikon> = Available<DikonProvided<T>, DikonRequires<T>>;

type IncompatibleFactoryKeys<TFactories, TExpected> = {
  [K in Extract<keyof TFactories, keyof TExpected>]: TFactories[K] extends AnyFunction
    ? ReturnType<TFactories[K]> extends TExpected[K]
      ? never
      : K
    : K;
}[Extract<keyof TFactories, keyof TExpected>];

type ProviderIssues<TFactories, TProvided, TRequires> =
  | Extract<keyof TFactories, keyof TProvided>
  | IncompatibleFactoryKeys<TFactories, TRequires>;

type IncompatibleKeys<TActual, TExpected> = {
  [K in Extract<keyof TActual, keyof TExpected>]: TActual[K] extends TExpected[K] ? never : K;
}[Extract<keyof TActual, keyof TExpected>];

type IncompatibleRequirementKeys<A, B> = {
  [K in Extract<keyof A, keyof B>]: A[K] extends B[K] ? never : B[K] extends A[K] ? never : K;
}[Extract<keyof A, keyof B>];

type UseIssues<TProvided, TRequires, TOther extends AnyDikon> =
  | Extract<keyof TProvided, keyof DikonProvided<TOther>>
  | IncompatibleKeys<DikonProvided<TOther>, TRequires>
  | IncompatibleKeys<TProvided, DikonRequires<TOther>>
  | IncompatibleRequirementKeys<TRequires, DikonRequires<TOther>>;

type MergeRequirements<A, B> = Simplify<{
  [K in keyof A | keyof B]: K extends keyof A
    ? K extends keyof B
      ? A[K] extends B[K]
        ? A[K]
        : B[K] extends A[K]
          ? B[K]
          : never
      : A[K]
    : K extends keyof B
      ? B[K]
      : never;
}>;

// Build argument types mirror the runtime calling forms:
// - no unsatisfied requirements: build()
// - standalone requirements: build(requires)
// - parent-satisfied requirements: build(undefined, parent)
// - mixed local and parent requirements: build(localRequires, parent)
type HasNoKeys<T> = keyof T extends never ? true : false;
type StandaloneBuildArgs<TRequires> =
  HasNoKeys<TRequires> extends true ? [] : [requires: TRequires];
type ParentSatisfiedKeys<TRequires, TParent extends object> = {
  [K in keyof TRequires]: K extends keyof TParent
    ? TParent[K] extends TRequires[K]
      ? K
      : never
    : never;
}[keyof TRequires];
type UnsatisfiedParentRequires<TRequires, TParent extends object> = SimplifyOmit<
  TRequires,
  ParentSatisfiedKeys<TRequires, TParent>
>;
type ParentBuildArgsWithUnsatisfied<TRequires, TParent extends object, TUnsatisfiedRequires> =
  HasNoKeys<TUnsatisfiedRequires> extends true
    ? [requires: Merge<TUnsatisfiedRequires, Partial<TRequires>> | undefined, parent: TParent]
    : [requires: Merge<Partial<TRequires>, TUnsatisfiedRequires>, parent: TParent];
type ParentBuildArgs<TRequires, TParent extends object> = ParentBuildArgsWithUnsatisfied<
  TRequires,
  TParent,
  UnsatisfiedParentRequires<TRequires, TParent>
>;

// Phantom type channel used by `dikon.Of` and composition helpers. No runtime
// property with this key is ever written to a dikon object.
declare const __dikonTypes: unique symbol;

const __layers = Symbol('__layers');

interface InternalDikon {
  readonly [__layers]: readonly FactoryMap[];
}

/**
 * We use symbol to avoid conflicts with the __instances key,
 * which can be declared by the user
 */
const __instances = Symbol('__instances');

const dikonMethods = Object.freeze({
  require(this: AnyDikon & InternalDikon) {
    // Purely a type-level declaration; it adds no layer, so sharing the dikon is safe.
    return this;
  },
  provide(this: AnyDikon & InternalDikon, layerObj: FactoryMap) {
    const layer = snapshotFactories(layerObj);
    reportNonFunctionFactories(layer);

    return createDikon([...this[__layers], layer]);
  },
  override(this: AnyDikon & InternalDikon, overrideObj: FactoryMap) {
    const layer = snapshotFactories(overrideObj);
    reportNonFunctionFactories(layer);

    return createDikon([...this[__layers], layer]);
  },
  build(this: AnyDikon & InternalDikon, buildRequires?: object, parent?: object) {
    return buildContainer(this, buildRequires, parent);
  },
  use(this: AnyDikon & InternalDikon, other: AnyDikon & InternalDikon) {
    return createDikon([...this[__layers], ...other[__layers]]);
  },
});

// DI modules are immutable: provide/override/use return a fresh DI module over a new layers array
// rather than mutating in place. A dikon composed once at module scope can be shared and
// built repeatedly without one branch's overrides leaking into another.
function createDikon(layers: readonly FactoryMap[]): Dikon<{}, {}> {
  const instance = Object.create(dikonMethods) as InternalDikon;
  Object.defineProperty(instance, __layers, {
    value: Object.freeze(layers),
    configurable: false,
    enumerable: false,
    writable: false,
  });

  return Object.freeze(instance) as unknown as Dikon<{}, {}>;
}

function buildContainer<TProvided, TRequires>(
  instance: Dikon<TProvided, TRequires> & InternalDikon,
  buildRequires: object | undefined,
  parent: object | undefined,
): Available<TProvided, TRequires> {
  const di = createContainer(buildRequires, parent);
  const instanceCache = defineInstanceCache(di);
  const resolvingServices = new Set<PropertyKey>();

  for (const layer of instance[__layers]) {
    for (const serviceName of getOwnEnumerableKeys(layer)) {
      Object.defineProperty(di, serviceName, {
        get() {
          if (instanceCache.has(serviceName)) {
            return instanceCache.get(serviceName);
          }

          if (resolvingServices.has(serviceName)) {
            throw new Error(`[DI] Circular dependency while resolving ${String(serviceName)}`);
          }

          resolvingServices.add(serviceName);

          try {
            const serviceFactory = layer[serviceName];
            const instance = serviceFactory?.(di);

            instanceCache.set(serviceName, instance);

            return instance;
          } finally {
            resolvingServices.delete(serviceName);
          }
        },
        configurable: true, // needed so that existing keys can be overwritten
        enumerable: true,
      });
    }
  }

  return di as Available<TProvided, TRequires>;
}

function createContainer(
  requires: object | undefined,
  parent: object | undefined,
): Record<PropertyKey, unknown> {
  const container = Object.create(parent ?? Object.prototype) as Record<PropertyKey, unknown>;

  if (requires !== undefined) {
    for (const key of getOwnEnumerableKeys(requires)) {
      defineReadonlyProperty(container, key, (requires as Record<PropertyKey, unknown>)[key]);
    }
  }

  return container;
}

function defineInstanceCache(container: Record<PropertyKey, unknown>): InstanceCache {
  const instanceCache: InstanceCache = new Map();

  Object.defineProperty(container, __instances, {
    value: instanceCache,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  return instanceCache;
}

function* iterateInstances(
  container: object,
): IterableIterator<readonly [key: PropertyKey, instance: unknown, di: object]> {
  let current: object | null = container;

  while (current !== null) {
    const instanceCache = getInstanceCache(current);

    if (instanceCache !== undefined) {
      const entries = [...instanceCache.entries()];

      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];

        if (entry === undefined) {
          continue;
        }

        const [key, instance] = entry;

        yield [key, instance, current];
      }
    }

    current = Object.getPrototypeOf(current);
  }
}

function getInstanceCache(container: object): InstanceCache | undefined {
  if (!Object.prototype.hasOwnProperty.call(container, __instances)) {
    return undefined;
  }

  const value = (container as Record<PropertyKey, unknown>)[__instances];

  return value instanceof Map ? value : undefined;
}

function snapshotFactories(deps: FactoryMap): FactoryMap {
  return Object.freeze({ ...deps }) as FactoryMap;
}

function defineReadonlyProperty(
  obj: Record<PropertyKey, unknown>,
  key: PropertyKey,
  value: unknown,
): void {
  Object.defineProperty(obj, key, {
    value,
    configurable: true,
    enumerable: true,
    writable: false,
  });
}

function reportNonFunctionFactories(deps: FactoryMap): void {
  for (const serviceName of getOwnEnumerableKeys(deps)) {
    if (typeof deps[serviceName] !== 'function') {
      // Keep runtime permissive; TypeScript is the main guardrail, and this
      // warning catches plain JavaScript or `any` misuse without changing flow.
      console.error(`[DI] Provided ${String(serviceName)} factory is not a function`);
    }
  }
}

function getOwnEnumerableKeys(obj: object): PropertyKey[] {
  return Reflect.ownKeys(obj).filter((key) => Object.prototype.propertyIsEnumerable.call(obj, key));
}
