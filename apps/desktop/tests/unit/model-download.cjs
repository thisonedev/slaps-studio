'use strict';

const test = require('brittle');

// downloadModel now pre-fetches over HTTPS before touching the (here, fake)
// SDK; without this, the real registry entries below would try a real
// multi-GB download.
process.env.STUDIO_NO_DIRECT_FETCH = '1';

const { downloadModel, cancelDownload, onDownloadProgress } = require('../../electron/models.cjs');
const { readRegistry } = require('../../shared/model-sideload.cjs');

test('model-download - downloads the registry constant a catalogue id names', async (t) => {
  const entry = readRegistry().get('QWEN3_4B_INST_Q4_K_M');
  const calls = [];
  const fakeSdk = {
    QWEN3_4B_INST_Q4_K_M: { name: 'QWEN3_4B_INST_Q4_K_M' },
    downloadAsset: ({ assetSrc, onProgress }) => {
      calls.push(assetSrc);
      onProgress({ downloaded: entry.expectedSize, total: entry.expectedSize });
      const done = Promise.resolve('QWEN3_4B_INST_Q4_K_M');
      done.requestId = 'req-qwen';
      return done;
    },
  };

  const progress = [];
  const off = onDownloadProgress((p) => progress.push(p));
  t.teardown(off);

  const result = await downloadModel('QWEN3_4B_INST_Q4_K_M', fakeSdk);
  t.is(result.downloaded, true);
  t.alike(calls, [fakeSdk.QWEN3_4B_INST_Q4_K_M], 'downloadAsset got the model constant');
  t.is(progress.length, 1);
  t.alike(progress[0], {
    name: 'QWEN3_4B_INST_Q4_K_M',
    label: entry.modelId,
    loaded: entry.expectedSize,
    total: entry.expectedSize,
  });
});

test('model-download - an id the studio does not use is rejected before touching the SDK', async (t) => {
  await t.exception(() => downloadModel('not-a-real-model.gguf', {}));
  await t.exception(() => downloadModel('WHISPER_TINY', {}), 'a real constant, but not an image model');
});

test('model-download - cancelDownload aborts the in-flight asset and reports cancelled', async (t) => {
  let rejectDownload;
  const pending = new Promise((_, rej) => {
    rejectDownload = rej;
  });
  pending.requestId = 'req-download-1';
  const cancelled = [];
  const fakeSdk = {
    QWEN3_4B_INST_Q4_K_M: { name: 'QWEN3_4B_INST_Q4_K_M' },
    downloadAsset: () => pending,
    cancel: async ({ requestId }) => {
      cancelled.push(requestId);
      rejectDownload(Object.assign(new Error('cancelled'), { name: 'InferenceCancelledError' }));
    },
  };
  const downloading = downloadModel('QWEN3_4B_INST_Q4_K_M', fakeSdk);
  await new Promise((r) => setImmediate(r));
  const stop = await cancelDownload();
  const result = await downloading;
  t.is(stop.cancelled, true);
  t.is(result.cancelled, true);
  t.is(result.downloaded, false);
  t.alike(cancelled, ['req-download-1']);
});

test('model-download - cancelDownload is a no-op when nothing is in flight', async (t) => {
  const stop = await cancelDownload();
  t.is(stop.cancelled, false);
});

