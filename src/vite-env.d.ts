/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_FIRECRAWL_API_KEY: string
    readonly VITE_OPENROUTER_API_KEY: string
    readonly VITE_GOOGLE_API_KEY: string
    readonly VITE_STRICT_MODE: string
    readonly VITE_IMAGE_POLICY: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
