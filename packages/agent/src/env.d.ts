interface ImportMetaEnv {
  readonly PUBLIC_MODEL_ENABLED?: string;
  readonly PUBLIC_MODEL_ACTIVE?: string;
  readonly PUBLIC_MODEL_REGISTRY_JSON?: string;
  readonly PUBLIC_MODEL_SYSTEM_PROMPT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
