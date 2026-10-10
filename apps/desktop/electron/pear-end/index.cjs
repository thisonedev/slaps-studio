// Facade owning the identity and the stores. identity/manager.cjs and
// state-store.cjs stay directly requirable.
const { createManager } = require('../identity/manager.cjs');
const { openRootStore, corestoreDir } = require('../root-store.cjs');
const { createStoreFromRoot } = require('../state-store.cjs');
const { createCatalogStore } = require('../catalog-store.cjs');

/**
 * @param {string} userDataDir
 * @param {{ getSafeStorage?: () => import('electron').SafeStorage | null }} [opts]
 */
function createPearEnd(userDataDir, opts = {}) {
  const getSafeStorage = opts.getSafeStorage || (() => null);

  let identityManager = null;
  let rootStorePromise = null;
  let stateStorePromise = null;
  let catalogStorePromise = null;

  function identity() {
    if (!identityManager) {
      identityManager = createManager(userDataDir, { safeStorage: getSafeStorage() });
    }
    return identityManager;
  }

  // One Corestore instance per userDataDir (RocksDB allows one open handle),
  // shared by every namespaced store below via `.namespace()`.
  function rootStore() {
    if (!rootStorePromise) {
      rootStorePromise = openRootStore(userDataDir);
    }
    return rootStorePromise;
  }

  function store() {
    if (!stateStorePromise) {
      stateStorePromise = rootStore().then((root) => createStoreFromRoot(root, userDataDir));
    }
    return stateStorePromise;
  }

  // Brand kits and saved designs: where each reads or writes what it saved,
  // separate from the flat KV store() above.
  function catalog() {
    if (!catalogStorePromise) {
      catalogStorePromise = rootStore().then((root) =>
        createCatalogStore(root, { dataDir: corestoreDir(userDataDir) }),
      );
    }
    return catalogStorePromise;
  }

  // Closes the shared root directly, so this works even if only catalog()
  // was ever touched and store() never was.
  async function shutdown() {
    if (rootStorePromise) {
      const root = await rootStorePromise.catch(() => null);
      if (root) await root.close().catch(() => {});
    }
  }

  return { identity, store, catalog, shutdown };
}

module.exports = { createPearEnd };
