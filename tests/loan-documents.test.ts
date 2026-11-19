import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentType } from '../src/lib/loan-documents.ts';
test('supporting documents are identified by bytes rather than a claimed filename', () => {
    assert.equal(documentType(Buffer.from('%PDF-1.7\n')), 'application/pdf');
    assert.equal(documentType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'image/png');
    assert.equal(documentType(Buffer.from([255, 216, 255, 224])), 'image/jpeg');
    assert.throws(() => documentType(Buffer.from('<html>not a PDF</html>')));
});
