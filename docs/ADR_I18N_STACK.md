# ADR: i18n Tech Stack Selection

## Context
The application is a client-side React SPA built with Vite. It needs robust Russian language support (primary) with plans for English.
Requirements include:
- Pluralization (complex RU rules)
- Interpolation parameters
- Rich text support
- Vercel compatibility

## Decision
We select **`i18next` + `react-i18next`**.

## Rationale
1.  **Architecture Fit**: The project uses Vite, not Next.js. `next-intl` is optimized for Next.js App Router and Server Components. `i18next` is the standard for client-side React.
2.  **Existing Footprint**: These libraries are already installed in `package.json`, minimizing friction.
3.  **Feature Set**:
    - **Plurals**: Excellent support for v4 format (ICU-like) including Russian 1/2/5 rules.
    - **Namespaces**: Allows splitting translations (`common`, `research`, `sku`) to keep bundles manageable.
    - **Ecosystem**: Massive community, plugins for browser detection (already installed), backend loading, etc.
4.  **Vercel/CDN**: Fully compatible with static deployments. Translation JSONs are just static assets.

## Alternatives Considered
-   **`next-intl`**: Rejected. Requires Next.js specific routing/setup which would complicate the Vite build.
-   **`@formatjs/intl` (React Intl)**: Good standard, but verbose API (`<FormattedMessage>`) compared to `t()`. Adoption cost is higher given `i18next` is already present.

## Consequences
-   We will use `t('key', { count: 5 })` syntax.
-   Translations will live in `src/i18n/locales/{lang}/{namespace}.json`.
-   We need to ensure `i18next` instance is strictly initialized before React renders to avoid "flash of keys".
