'use strict';

// Image generation through the SDK's sdcpp-generation engine. Each entry in
// IMAGE_MODELS is one option in the studio's model picker.

const { createLazyModel } = require('./media-models.cjs');

const IMAGE_MODELS = {
  'sd2.1': {
    label: 'Stable Diffusion 2.1 (2.3GB, fast)',
    registryKeys: ['SD_V2_1_1B_Q8_0'],
    buildLoadArgs: (sdk) => ({
      modelSrc: sdk.SD_V2_1_1B_Q8_0,
      modelType: 'sdcpp-generation',
      modelConfig: { prediction: 'v' },
    }),
  },
  'flux2-klein': {
    label: 'FLUX.2 [klein] (higher quality, slower)',
    registryKeys: ['FLUX_2_KLEIN_4B_Q4_0', 'QWEN3_4B_INST_Q4_K_M', 'FLUX_2_KLEIN_4B_VAE'],
    buildLoadArgs: (sdk) => ({
      modelSrc: sdk.FLUX_2_KLEIN_4B_Q4_0,
      modelType: 'sdcpp-generation',
      modelConfig: { llmModelSrc: sdk.QWEN3_4B_INST_Q4_K_M, vaeModelSrc: sdk.FLUX_2_KLEIN_4B_VAE },
    }),
    // FLUX's guidance-distilled sampling needs its own cfg_scale/guidance
    // pair; SD 2.1's classifier-free defaults would wash the image out.
    genArgs: { guidance: 3.5, cfg_scale: 1 },
  },
};

const imageLazyByKey = new Map();

function lazyFor(registry, byKeyMap, key, label) {
  const entry = registry[key];
  if (!entry) throw new Error(`unknown model "${key}"`);
  if (!byKeyMap.has(key)) {
    byKeyMap.set(
      key,
      createLazyModel({
        label: `${label}:${key}`,
        // The picker's own label minus its trailing size/speed note, e.g.
        // "Stable Diffusion 2.1 (2.3GB, fast)" -> "Stable Diffusion 2.1".
        modelName: entry.label.replace(/\s*\([^)]*\)\s*$/, ''),
        modelKind: label,
        registryKeys: entry.registryKeys,
        buildLoadArgs: entry.buildLoadArgs,
      }),
    );
  }
  return byKeyMap.get(key);
}

function listImageModels() {
  return Object.entries(IMAGE_MODELS).map(([key, v]) => ({ key, label: v.label }));
}

// diffusion() exposes no requestId, so a stop cancels by the model it runs on.
let currentImageModelId = null;
let imageCancelled = false;

async function generateImage(prompt, modelKey, opts = {}) {
  const key = modelKey && IMAGE_MODELS[modelKey] ? modelKey : Object.keys(IMAGE_MODELS)[0];
  const sdk = require('@qvac/sdk');
  imageCancelled = false;
  const modelId = await lazyFor(IMAGE_MODELS, imageLazyByKey, key, 'image').ensureLoaded();
  if (imageCancelled) throw new Error('Image generation stopped.');
  // Only what the caller pinned is sent; the rest stays on the engine defaults.
  const pinned = Object.fromEntries(
    ['width', 'height', 'seed', 'steps'].filter((k) => Number.isInteger(opts[k])).map((k) => [k, opts[k]]),
  );
  const { outputs } = sdk.diffusion({ modelId, prompt, ...IMAGE_MODELS[key].genArgs, ...pinned });
  currentImageModelId = modelId;
  try {
    const buffers = await outputs;
    if (imageCancelled) throw new Error('Image generation stopped.');
    return `data:image/png;base64,${Buffer.from(buffers[0]).toString('base64')}`;
  } finally {
    currentImageModelId = null;
  }
}

/** Stops the image generation in flight, including one still loading its model. Safe with nothing running. */
async function cancelImage() {
  imageCancelled = true;
  for (const lazy of imageLazyByKey.values()) await lazy.cancelLoad();
  if (!currentImageModelId) return;
  const sdk = require('@qvac/sdk');
  await sdk.cancel({ modelId: currentImageModelId }).catch(() => {});
}

async function unloadAll() {
  for (const lazy of imageLazyByKey.values()) await lazy.unload();
}

/** Stops any image model that is still loading or downloading. */
async function cancelLoad() {
  for (const lazy of imageLazyByKey.values()) await lazy.cancelLoad();
}

module.exports = {
  IMAGE_MODELS,
  cancelLoad,
  listImageModels,
  generateImage,
  cancelImage,
  unload: unloadAll,
};
