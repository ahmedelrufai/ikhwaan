export function paginate<T>(items: T[], requestedPage: number, pageSize: number) {
    const size = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 10;
    const pages = Math.max(1, Math.ceil(items.length / size));
    const page = Math.min(pages, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
    const offset = (page - 1) * size;
    return { items: items.slice(offset, offset + size), page, pages, start: items.length ? offset + 1 : 0, end: Math.min(items.length, offset + size), total: items.length };
}
