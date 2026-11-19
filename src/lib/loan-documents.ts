import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GridFSBucket } from 'mongodb';
import { mongoClient } from './mongodb.ts';
export type DocumentMetadata = {
    id: string;
    memberId: string;
    name: string;
    size: number;
    contentType: string;
    createdAt: string;
};
export function documentType(buffer: Buffer) {
    if (buffer.subarray(0, 5).toString() === '%PDF-')
        return 'application/pdf';
    if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        return 'image/png';
    if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
        return 'image/jpeg';
    throw new Error('Upload a PDF, PNG or JPEG file.');
}
async function database() {
    if (!process.env.MONGODB_URI) {
        if (process.env.NODE_ENV === 'production')
            throw new Error('MongoDB is required.');
        return null;
    }
    const client = await mongoClient();
    return { client, bucket: new GridFSBucket(client.db(process.env.MONGODB_DB || 'ikhwaan'), { bucketName: 'loanDocuments' }) };
}
const folder = () => path.join(process.env.PORTAL_DATA_DIR || path.join(process.cwd(), '.data'), 'loan-documents');
export async function saveDocument(memberId: string, file: File) {
    if (!file.size || file.size > 5 * 1024 * 1024)
        throw new Error('File must be between 1 byte and 5 MB.');
    const bytes = Buffer.from(await file.arrayBuffer()), contentType = documentType(bytes);
    const metadata: DocumentMetadata = { id: randomUUID(), memberId, name: file.name.replace(/[^\p{L}\p{N} ._-]/gu, '_').slice(0, 150) || 'document', size: bytes.length, contentType, createdAt: new Date().toISOString() };
    const db = await database();
    if (db) {
        await new Promise<void>((resolve, reject) => {
            const upload = db.bucket.openUploadStream(metadata.id, { metadata });
            upload.on('error', reject);
            upload.on('finish', () => resolve());
            upload.end(bytes);
        });
    }
    else {
        await mkdir(folder(), { recursive: true });
        await writeFile(path.join(folder(), metadata.id), bytes, { mode: 0o600 });
        await writeFile(path.join(folder(), `${metadata.id}.json`), JSON.stringify(metadata), { mode: 0o600 });
    }
    return metadata;
}
export async function findDocument(id: string, withBytes = false) {
    if (!/^[a-f0-9-]{36}$/.test(id))
        return null;
    const db = await database();
    if (db) {
        const file = await db.bucket.find({ filename: id }).next();
        if (!file)
            return null;
        const metadata = file.metadata as DocumentMetadata;
        const chunks: Buffer[] = [];
        if (withBytes)
            for await (const chunk of db.bucket.openDownloadStream(file._id))
                chunks.push(Buffer.from(chunk));
        return { metadata, bytes: withBytes ? Buffer.concat(chunks) : undefined };
    }
    try {
        const metadata = JSON.parse(await readFile(path.join(folder(), `${id}.json`), 'utf8')) as DocumentMetadata;
        return { metadata, bytes: withBytes ? await readFile(path.join(folder(), id)) : undefined };
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT')
            return null;
        throw error;
    }
}
