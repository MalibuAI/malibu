// Single accepted release for every public download path (the /host button and
// the /j invite flow). scripts/verify-referral-download.mjs runs as the Vercel
// prebuild gate and fails the production build unless these still match the
// immutable GitHub release, its checksum list, and its provenance.
export const MALIBU_RELEASE_TAG = 'v1.8.67';
export const MALIBU_DMG_SHA256 =
  '0ebf55c17a357e3c3978956170632145818775afe08f4ac7447da8e309fdade3';
export const MALIBU_DOWNLOAD_URL =
  'https://github.com/Augustas11/macprovider/releases/download/v1.8.67/Malibu-v1.8.67.dmg';
