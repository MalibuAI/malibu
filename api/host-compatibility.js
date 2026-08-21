const MAX_BODY_BYTES = 16_384;

function readBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string' && Buffer.byteLength(req.body) > MAX_BODY_BYTES) {
      return Promise.reject(Object.assign(new Error('request body too large'), { statusCode: 413, code: 'payload_too_large' }));
    }
    if ((Buffer.isBuffer(req.body) || req.body instanceof Uint8Array) && req.body.byteLength > MAX_BODY_BYTES) {
      return Promise.reject(Object.assign(new Error('request body too large'), { statusCode: 413, code: 'payload_too_large' }));
    }
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body) && !(req.body instanceof Uint8Array)) {
      const approxBytes = Buffer.byteLength(JSON.stringify(req.body || {}));
      if (approxBytes > MAX_BODY_BYTES) {
        return Promise.reject(Object.assign(new Error('request body too large'), { statusCode: 413, code: 'payload_too_large' }));
      }
    }
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('request body too large'), { statusCode: 413, code: 'payload_too_large' }));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function parseBody(rawBody) {
  let body;
  try {
    if (typeof rawBody === 'string') body = JSON.parse(rawBody || '{}');
    else if (Buffer.isBuffer(rawBody) || rawBody instanceof Uint8Array) body = JSON.parse(Buffer.from(rawBody).toString('utf8') || '{}');
    else body = rawBody || {};
  } catch {
    const err = new Error('request body must be JSON');
    err.statusCode = 400;
    err.code = 'invalid_json';
    throw err;
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const err = new Error('request body must be an object');
    err.statusCode = 400;
    err.code = 'invalid_request';
    throw err;
  }
  const keys = Object.keys(body);
  const hardware = body.hardware;
  if (keys.some((key) => key !== 'hardware') || !hardware || typeof hardware !== 'object' || Array.isArray(hardware)) {
    const err = new Error('request body must contain hardware');
    err.statusCode = 400;
    err.code = 'invalid_hardware_profile';
    throw err;
  }
  const hardwareKeys = Object.keys(hardware);
  if (hardwareKeys.some((key) => key !== 'chip' && key !== 'ramGb')) {
    const err = new Error('hardware may only include chip and ramGb');
    err.statusCode = 400;
    err.code = 'invalid_hardware_profile';
    throw err;
  }
  return { hardware };
}

module.exports = async function handler(req, res) {
  const sendJSON = (status, body, cacheControl = 'no-store') => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify(body));
  };

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJSON(405, { error: 'method_not_allowed' });
    return;
  }

  try {
    const {
      enrichCompatibilityWithCanIRunSpeeds,
      evaluateHostCompatibility,
    } = await import('../j/host-compatibility.mjs');
    const rawBody = await readBody(req);
    const { hardware } = parseBody(rawBody);
    const result = await enrichCompatibilityWithCanIRunSpeeds(
      evaluateHostCompatibility(hardware),
      { timeoutMs: 900 },
    );
    sendJSON(200, result, 'no-store');
  } catch (error) {
    const known = error && Number.isInteger(error.statusCode);
    const status = known ? error.statusCode : 500;
    sendJSON(status, {
      error: known ? (error.code || 'invalid_hardware_profile') : 'internal_error',
      message: status >= 500 ? undefined : error.message,
    });
  }
};
