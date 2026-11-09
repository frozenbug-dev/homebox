import { Headers, Request, Response, XMLHttpRequest, fetch } from 'react-native-nitro-fetch'

// Swap the built-in networking stack for nitro-fetch (Cronet on Android, URLSession on iOS)
// so every `fetch` call — including ones made by libraries — goes through it.
Object.assign(globalThis, { fetch, Headers, Request, Response, XMLHttpRequest })
