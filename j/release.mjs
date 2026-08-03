// Single accepted release for every public download path (the /host button and
// the /j invite flow). scripts/verify-referral-download.mjs runs as the Vercel
// prebuild gate and fails the production build unless these still match the
// immutable GitHub release, its checksum list, and its provenance.
export const MALIBU_RELEASE_TAG = 'v1.8.47';
export const MALIBU_DMG_SHA256 =
  '0b16189319a1f3afb62610de337fb0bf45c9257d65f86aaaa1a99946435bfed8';
export const MALIBU_DOWNLOAD_URL =
  'https://github.com/Augustas11/macprovider/releases/download/v1.8.47/Malibu-v1.8.47.dmg';
