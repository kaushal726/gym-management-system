/* Google Identity Services: loads Google's script once and renders its official sign-in button. */
const GIS_SRC = "https://accounts.google.com/gsi/client";

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize(options: { client_id: string; callback: (r: GoogleCredentialResponse) => void; ux_mode?: "popup"; auto_select?: boolean; use_fedcm_for_prompt?: boolean }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

let loading: Promise<void> | null = null;

export function loadGoogle(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load Google sign-in. Check your internet and try again."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Google allows one initialize per page; later buttons just swap which handler receives the sign-in. */
let initializedFor: string | null = null;
let handler: (credential: string) => void = () => undefined;

export async function renderGoogleButton(parent: HTMLElement, clientId: string, onCredential: (credential: string) => void): Promise<void> {
  await loadGoogle();
  const id = window.google!.accounts.id;
  handler = onCredential;
  if (initializedFor !== clientId) {
    id.initialize({ client_id: clientId, callback: (r) => handler(r.credential), ux_mode: "popup" });
    initializedFor = clientId;
  }
  parent.innerHTML = "";
  id.renderButton(parent, { type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "pill", width: Math.min(parent.clientWidth || 320, 400) });
}
