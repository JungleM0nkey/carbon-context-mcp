# Carbon AI Chat (`@carbon/ai-chat`)

IBM Carbon's chat framework is **`@carbon/ai-chat`** — an opinionated, extensible AI chat UI shipped
in **both React** (`<ChatContainer>`, `<ChatCustomElement>`) **and web components**
(`<cds-aichat-container>`, `<cds-aichat-custom-element>`) from one ESM-only package. For us, **React
is primary**. Same four themes (white/g10/g90/g100), IBM Plex, Carbon AI styling, built-in
accessibility. Use the `carbon_ai_chat` MCP tool for the live topic catalog, the response-type
shapes, and runnable snippets.

## The one thing to get right: it is backend-agnostic

`@carbon/ai-chat` is a **UI layer only**. It is **NOT a watsonx / Assistant SDK** and ships no
built-in assistant. **You** own the LLM/server call. The wiring is:

1. Give the chat a `messaging.customSendMessage(request, options, instance)` callback.
2. Inside it, call **your** backend with `request.input.text` (honor `options.signal`, an AbortSignal).
3. Push the reply back through the instance: `instance.messaging.addMessage(...)` (complete) or
   `instance.messaging.addMessageChunk(...)` (streaming).

The `assistantName` default `'watsonx'` and the Watsonx avatar are just overridable cosmetics.

```bash
npm install @carbon/ai-chat @carbon/web-components   # web-components is a REQUIRED peer (>=2.54)
```
```tsx
import { ChatContainer, type PublicConfig, MessageResponseTypes } from '@carbon/ai-chat';

async function customSendMessage(request, options, instance) {
  const text = await callYourBackend(request.input.text ?? '', { signal: options.signal });
  instance.messaging.addMessage({ output: { generic: [{ response_type: MessageResponseTypes.TEXT, text }] } });
}
const config: PublicConfig = { messaging: { customSendMessage } };   // define OUTSIDE render
export default () => <ChatContainer {...config} />;
```

## No CSS import — it lives in shadow DOM

The chat renders in **shadow DOM and self-injects Carbon tokens**, so there is **no required
stylesheet**. Do not invent `@carbon/ai-chat/styles.css`. (`@carbon/styles/css/styles.css` only
styles the *host page* — Plex + reset — and is optional.) The single conditional stylesheet is
`@carbon/ai-chat/css/chat-float-layout.css`, only when you hand-apply float classes to
`ChatCustomElement` (`ChatContainer` does it for you).

## Config is one `PublicConfig` object (flattened as React props)

In React, every `PublicConfig` field is a top-level prop on `<ChatContainer>`/`<ChatCustomElement>`.
The load-bearing one is `messaging`. Others you'll reach for: `injectCarbonTheme`, `aiEnabled`,
`header`, `launcher`, `homescreen`, `layout`, `serviceDeskFactory`. Capture the **`ChatInstance`** via
the `onBeforeRender={(instance) => …}` prop.

> **Stable config:** re-creating the config/messaging object inline on every render triggers a
> deep-equal diff that **restarts the chat**. Define it outside render or memoize it.

## Responses are typed `GenericItem`s, not HTML

A bot reply is a `MessageResponse` whose `output.generic` is an array of `GenericItem`s, each with a
`response_type`: `text` (markdown), `option`, `button`, `card`, `carousel`, `grid`, `image`/`video`/
`audio`, `iframe`, `date`, `conversational_search` (RAG w/ citations), `connect_to_agent`, `pause`,
`inline_error`, and **`user_defined`**. Prefer these typed items over raw HTML strings. For your own
React, emit a `user_defined` item and pass `renderUserDefinedResponse={(state, instance) => ReactNode}`.
Ask `carbon_ai_chat` with `responseType='<type>'` for each item's exact shape.

## Theming

Force a theme with `injectCarbonTheme: CarbonTheme.WHITE | G10 | G90 | G100` (otherwise it inherits
the host page). `aiEnabled` (default `true`) is the Carbon **AI gradient** styling. Recolor the shell
with `--cds-aichat-*` and `--cds-*` custom properties — **never literal hex**.

## Layout

Float vs full-area is a **component choice, not a flag**:
- `ChatContainer` / `<cds-aichat-container>` → floating launcher + popover.
- `ChatCustomElement` / `<cds-aichat-custom-element>` → you size/place it via `className` (sidebar,
  fullscreen, nested). It's 0×0 until opened; use its `onViewChange`/`onViewPreChange` props to size.

## Next.js / SSR

Client-only (needs `window` + custom elements). App Router: mark the chat module `'use client'` **and**
load it with `next/dynamic(() => import('./Chat'), { ssr: false })`, or it throws on the server.

## Human handoff

Use `serviceDeskFactory: (params) => Promise<ServiceDesk>` and implement `ServiceDesk`
(`startChat`/`sendMessageToAgent`/`endChat`/`areAnyAgentsOnline?`), driven by the provided
`ServiceDeskCallback` and the `human_agent:*` events. Emit a `connect_to_agent` response to offer it.

## "Fake Carbon AI chat" — avoid

- Treating it like a watsonx Assistant client (there is no built-in assistant — you implement
  `customSendMessage`).
- Importing a made-up CSS file to "fix" styling (it's shadow-DOM, self-styled).
- Rendering it during SSR instead of `'use client'` + `dynamic(ssr:false)`.
- Recreating config inline each render (restarts the chat).
- Skipping the `@carbon/web-components` peer dep.
- Hand-rolling rich content as HTML instead of typed `GenericItem`s / `user_defined` React.
- Hardcoding colors instead of `injectCarbonTheme` + `--cds-aichat-*` tokens.

> Package: `@carbon/ai-chat` (Apache-2.0), ESM-only, peers `@carbon/web-components >=2.54`,
> React 17–19. Companion: `@carbon/ai-chat-components` (lower-level building blocks).
> Docs: https://chat.carbondesignsystem.com · Repo: https://github.com/carbon-design-system/carbon-ai-chat
