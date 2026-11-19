import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paginate } from '../src/lib/pagination.ts';
test('pagination handles empty results, last pages and filters shrinking results', () => {
    const items = Array.from({ length: 23 }, (_, i) => i + 1);
    assert.deepEqual(paginate(items, 3, 10).items, [21, 22, 23]);
    assert.equal(paginate(items, 3, 10).start, 21);
    assert.equal(paginate(items, 3, 10).end, 23);
    assert.equal(paginate(items.slice(0, 2), 3, 10).page, 1);
    const empty = paginate([], 10, 10);
    assert.deepEqual([empty.page, empty.pages, empty.start, empty.end], [1, 1, 0, 0]);
    assert.equal(paginate(items, -1, 10).page, 1);
    assert.equal(paginate(items, 1, 25).items.length, 23);
});
