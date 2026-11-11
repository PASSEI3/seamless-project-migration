import { describe, it, expect } from 'vitest';
import { fitWithin } from './imageCompression';

describe('photo resize to max 1080px', () => {
  it('shrinks a 4000x3000 photo to 1080x810', () => expect(fitWithin(4000, 3000)).toEqual({ width: 1080, height: 810 }));
  it('shrinks a portrait 3024x4032 photo to 810x1080', () => expect(fitWithin(3024, 4032)).toEqual({ width: 810, height: 1080 }));
  it('keeps a photo already within 1080px', () => expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 }));
});
