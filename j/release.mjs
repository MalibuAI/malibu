// Single accepted release for every public download path (the /host button and
// the /j invite flow). scripts/verify-referral-download.mjs runs as the Vercel
// prebuild gate and fails the production build unless these still match the
// immutable GitHub release, its checksum list, and its provenance.
export const MALIBU_RELEASE_TAG = 'v1.8.69';
export const MALIBU_DMG_SHA256 =
  '34f316b2cced53f2ddceb6e5e50e5cb9b721e18d08266879523e2082d88c6c7f';
export const MALIBU_DOWNLOAD_URL =
  'https://github.com/Augustas11/macprovider/releases/download/v1.8.69/Malibu-v1.8.69.dmg';
