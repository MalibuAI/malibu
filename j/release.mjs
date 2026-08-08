// Single accepted release for every public download path (the /host button and
// the /j invite flow). scripts/verify-referral-download.mjs runs as the Vercel
// prebuild gate and fails the production build unless these still match the
// immutable GitHub release, its checksum list, and its provenance.
export const MALIBU_RELEASE_TAG = 'v1.8.90';
export const MALIBU_DMG_SHA256 =
  '4cbe757232047314ca09772d08accd96683097a4777c90057b6c67e9aa8ac20e';
export const MALIBU_DOWNLOAD_URL =
  'https://github.com/Augustas11/macprovider/releases/download/v1.8.90/Malibu-v1.8.90.dmg';
