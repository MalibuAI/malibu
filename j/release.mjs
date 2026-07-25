// Single accepted release for every public download path (the /host button and
// the /j invite flow). scripts/verify-referral-download.mjs runs as the Vercel
// prebuild gate and fails the production build unless these still match the
// immutable GitHub release, its checksum list, and its provenance.
export const MALIBU_RELEASE_TAG = 'v1.8.61';
export const MALIBU_DMG_SHA256 =
  '469a9d167ba69a2445f5ffd3b73032cb6f3ae76f63e26ff4bac78c0c26853f44';
export const MALIBU_DOWNLOAD_URL =
  'https://github.com/Augustas11/macprovider/releases/download/v1.8.61/Malibu-v1.8.61.dmg';
