/** GitHub OAuth entrypoint for Malibu console (gateway handoff flow). */

export function authCallbackUrl() {
  return `${location.origin}/console/auth/callback.html`;
}

export function startGitHubSignIn() {
  const params = new URLSearchParams({
    return_to: authCallbackUrl(),
    action: 'mint',
  });
  location.assign(`/auth/github/start?${params}`);
}
