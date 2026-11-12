/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `'false'` desliga a camada de mocks (MSW). Padrão: ligada. */
  readonly VITE_ENABLE_MOCKS?: string
  readonly VITE_STANDALONE?: string
  readonly VITE_HASH_ROUTER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
