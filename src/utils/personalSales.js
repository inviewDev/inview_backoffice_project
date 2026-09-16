export function selectPersonalSales(rows, { department = '', team = '', search = '', sort = 'approvedAmount', direction = 'desc' } = {}) {
  const words = search.trim().toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean);
  const filtered = rows.filter(row => {
    const text = `${row.name || ''} ${row.department || ''} ${row.team || ''}`.toLocaleLowerCase('ko-KR');
    return row.count > 0 && (!department || row.department === department) && (!team || row.team === team)
      && words.every(word => text.includes(word));
  });
  return filtered.sort((a, b) => {
    const comparison = typeof a[sort] === 'number'
      ? a[sort] - b[sort]
      : String(a[sort] ?? '').localeCompare(String(b[sort] ?? ''), 'ko');
    return (direction === 'asc' ? comparison : -comparison) || String(a.id).localeCompare(String(b.id), 'ko', { numeric: true });
  });
}

export function personalSalesCsv(rows, columns = [['name', '이름'], ['department', '부서'], ['team', '팀'], ['approvedAmount', '승인금액'], ['netProfit', '순이익'], ['count', '건수']]) {
  const escapeCell = value => {
    const text = typeof value === 'string' && /^[\s]*[=+@-]/.test(value) ? `'${value}` : String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  };
  const values = [
    columns.map(([, label]) => label),
    ...rows.map(row => columns.map(([key]) => row[key])),
  ];
  return '\uFEFF' + values.map(row => row.map(escapeCell).join(',')).join('\r\n');
}
