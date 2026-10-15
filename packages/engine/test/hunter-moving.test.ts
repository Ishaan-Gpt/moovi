import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stillForMovingRequest, stillKind } from '../src/tasks/hunter';

test('a scroll or footage request refuses a still while a video exists', () => {
  assert.match(stillForMovingRequest('scroll', '/a/bench-proof.png', true)!, /scroll capture/);
  assert.match(stillForMovingRequest('footage', '/a/photo.jpg', true)!, /moving video/);
  assert.equal(stillForMovingRequest('scroll', '/a/site-scroll.mp4', true), null);
  assert.equal(stillForMovingRequest('footage', '/a/clip.webm', true), null);
});

test('a still may stand in when no video exists, and is then named for what it is', () => {
  assert.equal(stillForMovingRequest('scroll', '/a/hero.png', false), null);
  assert.equal(stillForMovingRequest('logo', '/a/logo.png', true), null);
  assert.equal(stillKind('scroll'), 'capture');
  assert.equal(stillKind('footage'), 'photo');
  assert.equal(stillKind('logo'), 'logo');
});
