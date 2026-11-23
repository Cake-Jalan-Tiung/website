export const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
export const toBase64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
export const toBase64Url = (bytes: ArrayBuffer | Uint8Array) => toBase64(bytes).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
