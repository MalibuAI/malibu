import {
  canonicalHTTPSURL,
  isCanonicalLandingLocation,
  parseReferralFragment,
  readBoundedUTF8,
  validationView,
} from './referral-fragment.mjs';
import { MALIBU_DOWNLOAD_URL } from './release.mjs';

const VALIDATION_URL = 'https://coordinator.streamvc.live/v1/referrals/validate';
const MAX_RESPONSE_BYTES = 4096;

let referralCode = isCanonicalLandingLocation(window.location)
  ? parseReferralFragment(window.location.hash)?.code ?? null
  : null;
window.history.replaceState(null, '', '/j');

const status = document.querySelector('#status');
const title = document.querySelector('#title');
const message = document.querySelector('#message');
const invite = document.querySelector('#invite');
const inviteCode = document.querySelector('#invite-code');
const actions = document.querySelector('#actions');
const download = document.querySelector('#download');
const copy = document.querySelector('#copy');
const copyStatus = document.querySelector('#copy-status');
const retry = document.querySelector('#retry');
const requestAccess = document.querySelector('#request-access');
const nextStep = document.querySelector('#next-step');

download.href = MALIBU_DOWNLOAD_URL;
let retryCount = 0;

function render(view) {
  invite.hidden = view !== 'valid';
  actions.hidden = view !== 'valid';
  nextStep.hidden = view !== 'valid';
  retry.hidden = view !== 'unavailable' || !referralCode || retryCount >= 2;
  requestAccess.hidden = true;
  copyStatus.textContent = '';

  const content = {
    checking: ['Checking invite', 'One moment while Malibu verifies this invitation.'],
    valid: ['You’re invited.', 'Join Malibu’s private pre-beta compute network and put your Mac to work.'],
    expired: ['This invite expired.', 'Ask your inviter for a new Malibu invite.'],
    exhausted: ['This invite filled up.', 'All available spots were claimed. Ask your inviter for another invite.'],
    revoked: ['This invite is no longer active.', 'Ask your inviter for a new Malibu invite.'],
    invalid: ['This invite link is invalid.', 'Check that you copied the complete Malibu invite link.'],
    unavailable: ['We couldn’t check this invite.', 'Please try the same link again in a moment.'],
  }[view];

  status.textContent = view === 'valid' ? 'Malibu pre-beta invitation' : 'Malibu pre-beta';
  title.textContent = content[0];
  message.textContent = content[1];
}

async function validate(code) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(VALIDATION_URL, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
      signal: controller.signal,
    });
    if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return { view: 'unavailable', requestAccessURL: null };
    }
    const declaredLength = response.headers.get('content-length');
    if (declaredLength !== null
      && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_RESPONSE_BYTES)) {
      return { view: 'unavailable', requestAccessURL: null };
    }
    const body = await readBoundedUTF8(response, MAX_RESPONSE_BYTES);
    if (body === null) return { view: 'unavailable', requestAccessURL: null };
    const payload = JSON.parse(body);
    return {
      view: validationView(payload),
      requestAccessURL: canonicalHTTPSURL(payload.request_access_url),
    };
  } catch {
    return { view: 'unavailable', requestAccessURL: null };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function checkReferral() {
  render('checking');
  const result = await validate(referralCode);
  render(result.view);
  if (result.view !== 'valid' && result.requestAccessURL) {
    requestAccess.href = result.requestAccessURL;
    requestAccess.hidden = false;
  }
}

if (!referralCode) {
  render('invalid');
} else {
  inviteCode.textContent = referralCode;
  await checkReferral();
}

copy.addEventListener('click', async () => {
  if (!referralCode) return;
  try {
    await navigator.clipboard.writeText(referralCode);
    copyStatus.textContent = 'Invite code copied.';
  } catch {
    copyStatus.textContent = 'Copy failed. Select the code above to copy it.';
  }
});

retry.addEventListener('click', async () => {
  if (!referralCode || retryCount >= 2) return;
  retryCount += 1;
  await checkReferral();
});

window.addEventListener('pagehide', () => {
  referralCode = null;
  inviteCode.textContent = '';
  copyStatus.textContent = '';
  download.removeAttribute('href');
  requestAccess.removeAttribute('href');
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.replace('/j');
});
