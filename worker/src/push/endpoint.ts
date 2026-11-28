/* Only the browsers' own push services may be registered, so nobody can make the Worker send requests to a site of their choosing. */
const PUSH_SERVICE_HOSTS: readonly string[] = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
const PUSH_SERVICE_DOMAINS: readonly string[] = ["push.apple.com", "notify.windows.com"];

export function isPushServiceUrl(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  return PUSH_SERVICE_HOSTS.includes(url.hostname) || PUSH_SERVICE_DOMAINS.some((domain) => url.hostname.endsWith(`.${domain}`));
}
