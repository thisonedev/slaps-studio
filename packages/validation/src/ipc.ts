import { z } from 'zod';
import { USERNAME_RE } from './username.js';

export const stateKeySchema = z.string().min(1).max(256);

/** Bounded value the renderer's studio:state:set may write; see state-store.cjs. */
export const MAX_STATE_VALUE_BYTES = 1_000_000;
const utf8 = new TextEncoder();
export const stateValueSchema = z.unknown().refine(
  (v) => {
    try {
      return utf8.encode(JSON.stringify(v) ?? '').byteLength <= MAX_STATE_VALUE_BYTES;
    } catch {
      return false;
    }
  },
  { message: `state value exceeds ${MAX_STATE_VALUE_BYTES} bytes when serialized` },
);

/** studio:state:set takes a single object argument, validated as one unit. */
export const stateSetSchema = z
  .object({
    key: stateKeySchema,
    value: stateValueSchema,
  })
  .strict();

/** Keep in sync with CATALOG_KINDS in apps/desktop/electron/catalog-store.cjs. */
/** Keep in sync with CATALOG_KINDS in apps/desktop/electron/catalog-store.cjs. */
export const catalogKindSchema = z.enum(['ic-designs', 'brand-kits']);
export const catalogIdSchema = z.string().min(1).max(256);
export const catalogTitleSchema = z.string().min(1).max(200);

/** Bounded value a saved catalog entry (a design, a brand kit) may hold. */
export const MAX_CATALOG_PAYLOAD_BYTES = 5_000_000;
export const catalogPayloadSchema = z.unknown().refine(
  (v) => {
    if (v === undefined) return false;
    try {
      return utf8.encode(JSON.stringify(v) ?? '').byteLength <= MAX_CATALOG_PAYLOAD_BYTES;
    } catch {
      return false;
    }
  },
  { message: `catalog payload must be set and at most ${MAX_CATALOG_PAYLOAD_BYTES} bytes serialized` },
);

/** A library card's sketch; small enough that listing never loads payloads. */
export const MAX_CATALOG_PREVIEW_BYTES = 64_000;
export const catalogPreviewSchema = z.unknown().refine(
  (v) => {
    try {
      return utf8.encode(JSON.stringify(v ?? null)).byteLength <= MAX_CATALOG_PREVIEW_BYTES;
    } catch {
      return false;
    }
  },
  { message: `catalog preview exceeds ${MAX_CATALOG_PREVIEW_BYTES} bytes serialized` },
);

export const catalogKeySchema = z
  .object({
    kind: catalogKindSchema,
    id: catalogIdSchema,
  })
  .strict();

export const catalogSaveSchema = z
  .object({
    kind: catalogKindSchema,
    id: catalogIdSchema,
    title: catalogTitleSchema,
    payload: catalogPayloadSchema,
    preview: catalogPreviewSchema.optional(),
  })
  .strict();

export const catalogRenameSchema = z
  .object({
    kind: catalogKindSchema,
    id: catalogIdSchema,
    title: catalogTitleSchema,
  })
  .strict();

/** studio:catalog:list takes an optional kind filter, explicit null for "all". */
export const catalogListSchema = catalogKindSchema.nullable();

/** How long copied text marked for scrubbing may sit on the clipboard. */
export const CLIPBOARD_SCRUB_MS = 90_000;

export const clipboardCopySchema = z.object({
  text: z.string().min(1).max(8192),
  /** 0 leaves the text in place; capped to keep the scrub timer bounded. */
  scrubAfterMs: z.number().int().min(0).max(10 * 60_000).default(CLIPBOARD_SCRUB_MS),
});

export const studioGenerateImageSchema = z.object({
  prompt: z.string().min(1).max(2_000),
  model: z.string().min(1).max(64).optional(),
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(),
  seed: z.number().int().min(0).max(2_147_483_647).optional(),
  steps: z.number().int().min(1).max(60).optional(),
});


/** A bundled sound's name: lower-case words joined by hyphens, which is also all a file name in
 *  the sounds folder can be, so the name can never point outside it. */
export const soundNameSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);

/** A model cache entry id, used as a relative path under the models root; `removeModel()` containment-checks the resolved result too, so this is the earlier of two gates. */
export const modelIdSchema = z
  .string()
  .min(1)
  .max(256)
  .refine((v) => !v.includes('\0') && !v.includes('\\') && !v.startsWith('/'), {
    message: 'modelId must be a relative path with no backslashes or NUL',
  })
  .refine((v) => v.split('/').every((seg) => seg && seg !== '.' && seg !== '..'), {
    message: 'modelId must not contain empty or traversal segments',
  });


/** A download batch: a scope label plus the catalogue ids to fetch in order. */
export const modelDownloadQueueSchema = z.object({
  scope: z.string().min(1).max(256),
  names: z.array(z.string().regex(/^[A-Z0-9_]{1,128}$/)).min(1).max(50),
});

/** Mirrors identity/manager.cjs's own >=12-word check; belt-and-suspenders at the IPC boundary. */
export function isPlausibleMnemonic(v: unknown): v is string {
  return typeof v === 'string' && v.trim().split(/\s+/).length >= 12 && v.length <= 1024;
}
export const identityMnemonicSchema = z
  .string()
  .refine(isPlausibleMnemonic, { message: 'mnemonic must be at least 12 words' });


// The same rule the identity manager applies, so a bad name stops at the IPC boundary.
export const identityUsernameSchema = z
  .object({ username: z.string().max(64).trim().regex(USERNAME_RE) })
  .strict();


export function parseIpc<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`${label}: ${detail}`);
  }
  return result.data;
}
