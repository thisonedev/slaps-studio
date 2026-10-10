// One entry per image model the desktop app can load, matching the IMAGE_MODELS
// keys in apps/desktop/electron/diffusion.cjs. Add a model in both places.
export const IMAGE_MODEL_OPTIONS = [
  { value: 'sd2.1', label: 'Fast (Stable Diffusion 2.1)' },
  { value: 'flux2-klein', label: 'High Quality (FLUX.2 Klein)' },
];
