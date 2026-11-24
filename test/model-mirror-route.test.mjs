import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const HOST = [{ type: 'host', value: 'models.malibu.tech' }];
// GLM-5.3-Flash: the catalog's pinned upstream revision was deleted, so the
// mirror serves its signed manifest here and redirects files to a pinned copy.
const GLM_SHA256 = '7299b6a71a38490e378e9eb6524c426392aa96e3fd561007e0540134bbef48f9';

async function modelRoutes() {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  return config.redirects.filter((redirect) =>
    redirect.has?.some((condition) =>
      condition.type === 'host' && condition.value === 'models.malibu.tech'
    )
  );
}

test('models.malibu.tech redirects every other object path to the public model store', async () => {
  const routes = await modelRoutes();
  assert.deepEqual(routes.at(-1), {
    source: '/:path*',
    has: HOST,
    destination: 'https://hgkdfutu6jsprxz5.public.blob.vercel-storage.com/:path*',
    permanent: false,
  });
});

test('models.malibu.tech serves the GLM-5.3-Flash snapshot ahead of the catch-all', async () => {
  const routes = await modelRoutes();
  assert.deepEqual(routes.slice(0, 2), [
    {
      source: `/${GLM_SHA256}/manifest`,
      has: HOST,
      destination: `https://malibu.tech/model-mirror/${GLM_SHA256}/manifest`,
      permanent: false,
    },
    {
      source: `/${GLM_SHA256}/files/:path*`,
      has: HOST,
      destination: 'https://huggingface.co/aug11/GLM-5.3-Flash-oQ4e-mtp/resolve/2b2bdf90dd3db97a65736aea1cf8e08147c0252f/:path*',
      permanent: false,
    },
  ]);
  const manifest = await readFile(new URL(`../public/model-mirror/${GLM_SHA256}/manifest`, import.meta.url));
  assert.equal(createHash('sha256').update(manifest).digest('hex'), GLM_SHA256);
});
