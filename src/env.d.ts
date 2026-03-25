interface ImportMetaEnv {
  readonly PUBLIC_MODEL_ENABLED?: string;
  readonly PUBLIC_MODEL_BASE_URL?: string;
  readonly PUBLIC_MODEL_API_KEY?: string;
  readonly PUBLIC_MODEL_NAME?: string;
  readonly PUBLIC_MODEL_SYSTEM_PROMPT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
