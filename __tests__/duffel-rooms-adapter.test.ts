import { describe, it, expect } from 'vitest';
import { groupDuffelRooms } from '@/lib/adapters/duffel-rooms-adapter';
import type { NormalizedRoom, NormalizedRoomRate } from '@/lib/adapters/duffel-rooms-adapter';

function mkRate(overrides: Partial<NormalizedRoomRate> = {}): NormalizedRoomRate {
  return {
    id: 'rate-1',
    total_amount: '100.00',
    total_currency: 'USD',
    board_type: 'room_only',
    payment_type: 'pay_now',
    quantity_available: 3,
    cancellation_timeline: [],
    ...overrides,
  };
}

function mkRoom(overrides: Partial<NormalizedRoom> = {}): NormalizedRoom {
  return {
    name: 'Deluxe King Room',
    beds: [{ type: 'king', count: 1 }],
    photos: [],
    rates: [mkRate()],
    ...overrides,
  };
}

describe('groupDuffelRooms()', () => {
  it('1. merges same name+beds duplicates into one entry with combined rates', () => {
    const a = mkRoom({ rates: [mkRate({ id: 'r1', total_amount: '120.00' })] });
    const b = mkRoom({ rates: [mkRate({ id: 'r2', total_amount: '95.00' })] });
    const result = groupDuffelRooms([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].rates.map(r => r.id)).toEqual(['r1', 'r2']);
  });

  it('2. folds a realistic 5-rate-plan duplicate scenario into one room', () => {
    const rooms = ['refundable', 'non_refundable', 'member', 'breakfast', 'prepay'].map((tag, i) =>
      mkRoom({ rates: [mkRate({ id: tag, total_amount: String(100 + i) })] }),
    );
    const result = groupDuffelRooms(rooms);
    expect(result).toHaveLength(1);
    expect(result[0].rates).toHaveLength(5);
  });

  it('3. keeps different room types separate — different name, same beds', () => {
    const a = mkRoom({ name: 'Deluxe King Room' });
    const b = mkRoom({ name: 'Executive King Room' });
    expect(groupDuffelRooms([a, b])).toHaveLength(2);
  });

  it('4. keeps different room types separate — same name, different beds', () => {
    const a = mkRoom({ beds: [{ type: 'king', count: 1 }] });
    const b = mkRoom({ beds: [{ type: 'double', count: 2 }] });
    expect(groupDuffelRooms([a, b])).toHaveLength(2);
  });

  it('5. beds order-independence — same beds in different order still merge', () => {
    const a = mkRoom({ beds: [{ type: 'king', count: 1 }, { type: 'sofa', count: 1 }] });
    const b = mkRoom({ beds: [{ type: 'sofa', count: 1 }, { type: 'king', count: 1 }] });
    expect(groupDuffelRooms([a, b])).toHaveLength(1);
  });

  it('6. first non-empty photos wins, not concatenated', () => {
    const a = mkRoom({ photos: [] });
    const b = mkRoom({ photos: [{ url: 'a.jpg' }] });
    const result = groupDuffelRooms([a, b]);
    expect(result[0].photos).toEqual([{ url: 'a.jpg' }]);
  });

  it('7. two non-empty photo sources — only the first is kept', () => {
    const a = mkRoom({ photos: [{ url: 'first.jpg' }] });
    const b = mkRoom({ photos: [{ url: 'second.jpg' }] });
    const result = groupDuffelRooms([a, b]);
    expect(result[0].photos).toEqual([{ url: 'first.jpg' }]);
  });

  it('8. name/beds are taken from the first occurrence', () => {
    const a = mkRoom({ name: 'Deluxe King Room' });
    const b = mkRoom({ name: 'DELUXE KING ROOM' });
    const result = groupDuffelRooms([a, b]);
    expect(result[0].name).toBe('Deluxe King Room');
  });

  it('9. case/whitespace-insensitive key matching still merges', () => {
    const a = mkRoom({ name: 'Deluxe King Room' });
    const b = mkRoom({ name: '  deluxe king room  ' });
    expect(groupDuffelRooms([a, b])).toHaveLength(1);
  });

  it('10. empty input returns empty array', () => {
    expect(groupDuffelRooms([])).toEqual([]);
  });

  it('11. single room with no duplicates is returned unchanged', () => {
    const room = mkRoom();
    const result = groupDuffelRooms([room]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(room);
  });

  it('12. rooms with empty beds merge without throwing', () => {
    const a = mkRoom({ beds: [] });
    const b = mkRoom({ beds: [] });
    expect(() => groupDuffelRooms([a, b])).not.toThrow();
    expect(groupDuffelRooms([a, b])).toHaveLength(1);
  });

  it('13. preserves first-seen order across interleaved groups', () => {
    const a1 = mkRoom({ name: 'A' });
    const b1 = mkRoom({ name: 'B' });
    const a2 = mkRoom({ name: 'A' });
    const c1 = mkRoom({ name: 'C' });
    const b2 = mkRoom({ name: 'B' });
    const result = groupDuffelRooms([a1, b1, a2, c1, b2]);
    expect(result.map(r => r.name)).toEqual(['A', 'B', 'C']);
  });
});
