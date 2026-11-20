import assert from 'node:assert/strict';
import test from 'node:test';
import { isPrivateOrReservedIp, validateTargetUrl } from './urlGuard.service.js';

test('isPrivateOrReservedIp detects private, loopback, and metadata IPs', () => {
  assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('10.0.0.5'), true);
  assert.equal(isPrivateOrReservedIp('172.16.0.1'), true);
  assert.equal(isPrivateOrReservedIp('192.168.1.10'), true);
  assert.equal(isPrivateOrReservedIp('169.254.169.254'), true);
  assert.equal(isPrivateOrReservedIp('::1'), true);
  assert.equal(isPrivateOrReservedIp('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('8.8.8.8'), false);
  assert.equal(isPrivateOrReservedIp('1.1.1.1'), false);
});

test('validateTargetUrl blocks non-http schemes, embedded credentials, and localhost when private networks disallowed', async () => {
  await assert.rejects(() => validateTargetUrl('file:///etc/passwd', false), /http/);
  await assert.rejects(() => validateTargetUrl('https://user:pass@example.com', false), /credentials/);
  await assert.rejects(() => validateTargetUrl('http://localhost:3000', false), /blocked/);
  await assert.rejects(() => validateTargetUrl('http://169.254.169.254/latest/meta-data', false), /blocked/);
});

test('validateTargetUrl allows private IPs when allowPrivateNetworks is true', async () => {
  const url = await validateTargetUrl('http://192.168.1.50:8080/test', true);
  assert.equal(url, 'http://192.168.1.50:8080/test');
});
