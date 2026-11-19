export function csvResponse(rows: unknown[][], filename: string) {
    const csv = rows.map(row => row.map(value => '"' + String(value ?? '').replace(/"/g, '""').replace(/^[\s]*[=+@-]/, "'$&") + '"').join(',')).join('\r\n');
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' } });
}
