import { describe, expect, it } from 'vitest';
import {
  DAYS_PER_WEEK,
  HOURS_PER_DAY,
  MILLISECONDS_PER_DAY,
  MILLISECONDS_PER_HOUR,
  MILLISECONDS_PER_MINUTE,
  MILLISECONDS_PER_SECOND,
  MINUTES_PER_HOUR,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
} from './time.js';

describe('time constants', () => {
  it('compose correctly across seconds and milliseconds', () => {
    expect(SECONDS_PER_HOUR).toBe(SECONDS_PER_MINUTE * MINUTES_PER_HOUR);
    expect(SECONDS_PER_DAY).toBe(SECONDS_PER_HOUR * HOURS_PER_DAY);
    expect(MILLISECONDS_PER_MINUTE).toBe(
      MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE,
    );
    expect(MILLISECONDS_PER_HOUR).toBe(
      MILLISECONDS_PER_MINUTE * MINUTES_PER_HOUR,
    );
    expect(MILLISECONDS_PER_DAY).toBe(MILLISECONDS_PER_HOUR * HOURS_PER_DAY);
  });

  it('uses canonical base unit values', () => {
    expect(SECONDS_PER_MINUTE).toBe(60);
    expect(MINUTES_PER_HOUR).toBe(60);
    expect(HOURS_PER_DAY).toBe(24);
    expect(DAYS_PER_WEEK).toBe(7);
    expect(MILLISECONDS_PER_DAY).toBe(
      SECONDS_PER_DAY * MILLISECONDS_PER_SECOND,
    );
  });
});
