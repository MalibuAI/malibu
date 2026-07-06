/** GitHub OAuth entrypoint for Malibu console (gateway handoff flow). */

// OAuth must start on the gateway host: GitHub callbacks land on
// api.streamvc.live, and mp_oauth_session is scoped to that origin.
// Starting via malibu.tech/auth/* sets the cookie on the wrong domain.
const OAUTH_ORIGIN = 'https://api.streamvc.live';

export function authCallbackUrl() {
  return `${location.origin}/console/auth/callback.html`;
}

export function startGitHubSignIn() {
  const params = new URLSearchParams({
    return_to: authCallbackUrl(),
    action: 'mint',
  });
  location.assign(`${OAUTH_ORIGIN}/auth/github/start?${params}`);
}
