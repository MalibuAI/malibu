import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('models.malibu.tech redirects every object path to the public model store', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const route = config.redirects.find((redirect) =>
    redirect.has?.some((condition) =>
      condition.type === 'host' && condition.value === 'models.malibu.tech'
    )
  );

  assert.deepEqual(route, {
    source: '/:path*',
    has: [{ type: 'host', value: 'models.malibu.tech' }],
    destination: 'https://hgkdfutu6jsprxz5.public.blob.vercel-storage.com/:path*',
    permanent: false,
  });
});
