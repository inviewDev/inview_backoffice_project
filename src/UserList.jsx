import React, { useEffect, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';

const columnHelper = createColumnHelper();

function UserList() {
  const [data, setData] = useState([]);
  const [pendingData, setPendingData] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [rowSelection, setRowSelection] = useState({});
  const [expanded, setExpanded] = useState({});
  const [columnOrder, setColumnOrder] = useState([]);
  const [tab, setTab] = useState('users'); // users or pending

  // 데이터 fetch
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setError('토큰이 없습니다.');
      setIsLoading(false);
      return;
    }

    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        console.log('Fetched users:', json);
        setData(json);
      } catch (err) {
        console.error('Fetch users error:', err.message);
        setError(err.message);
        setData([]);
      }
    };

    const fetchPendingUsers = async () => {
      try {
        const res = await fetch('/api/users/pending', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        console.log('Fetched pending users:', json);
        setPendingData(json);
      } catch (err) {
        console.error('Fetch pending users error:', err.message);
        setError(err.message);
        setPendingData([]);
      }
    };

    Promise.all([fetchUsers(), fetchPendingUsers()]).finally(() => setIsLoading(false));
  }, []);

  // 승인/거절 핸들러
  const handleApprove = async (id) => {
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`/api/users/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      console.log('Approve result:', result);
      setPendingData(pendingData.filter(user => user.id !== id));
      setData([...data, result.user]);
      setError(null);
    } catch (err) {
      console.error('Approve error:', err.message);
      setError(err.message);
    }
  };

  const handleReject = async (id) => {
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`/api/users/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      console.log('Reject result:', await res.json());
      setPendingData(pendingData.filter(user => user.id !== id));
      setError(null);
    } catch (err) {
      console.error('Reject error:', err.message);
      setError(err.message);
    }
  };

  // 컬럼 정의
  const userColumns = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
      size: 32,
      enableSorting: false,
    },
    columnHelper.accessor('id', { header: 'ID', size: 60 }),
    columnHelper.accessor('name', { header: '이름', size: 90 }),
    columnHelper.accessor('email', { header: '이메일', size: 180 }),
    columnHelper.accessor('team', {
      header: '팀',
      size: 110,
      enableFiltering: true,
      filterFn: 'includesString',
    }),
    columnHelper.accessor('department', {
      header: '부서',
      size: 120,
      enableFiltering: true,
      filterFn: 'includesString',
    }),
    columnHelper.accessor('status', { header: '상태', size: 100 }),
  ];

  const pendingColumns = [
    columnHelper.accessor('id', { header: 'ID', size: 60 }),
    columnHelper.accessor('name', { header: '이름', size: 90 }),
    columnHelper.accessor('email', { header: '이메일', size: 180 }),
    columnHelper.accessor('team', {
      header: '팀',
      size: 110,
      enableFiltering: true,
      filterFn: 'includesString',
    }),
    columnHelper.accessor('department', {
      header: '부서',
      size: 120,
      enableFiltering: true,
      filterFn: 'includesString',
    }),
    {
      id: 'actions',
      header: '액션',
      cell: ({ row }) => (
        <div>
          <button
            onClick={() => handleApprove(row.original.id)}
            style={{ marginRight: '8px', padding: '4px 8px', background: '#4caf50', color: 'white' }}
          >
            승인
          </button>
          <button
            onClick={() => handleReject(row.original.id)}
            style={{ padding: '4px 8px', background: '#f44336', color: 'white' }}
          >
            거절
          </button>
        </div>
      ),
      size: 120,
      enableSorting: false,
      enableFiltering: false,
    },
  ];

  // 테이블 인스턴스 생성
  const table = useReactTable({
    data: tab === 'users' ? data : pendingData,
    columns: tab === 'users' ? userColumns : pendingColumns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      rowSelection,
      expanded,
      columnOrder,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: updater => {
      setColumnFilters(updater);
      console.log('Column Filters:', updater);
    },
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    enableSorting: true,
    enableFilters: true,
    enableColumnFilters: true,
    enableRowSelection: true,
    enableColumnOrdering: true,
    enableExpanding: true,
    debugTable: true,
  });

  if (isLoading) return <p>로딩 중...</p>;
  if (error) return <p style={{ color: 'red' }}>에러: {error}</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>사용자 관리</h1>
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setTab('users')}
          style={{ marginRight: 8, padding: '8px 16px', background: tab === 'users' ? '#ddd' : '#fff' }}
        >
          사용자 목록
        </button>
        <button
          onClick={() => setTab('pending')}
          style={{ padding: '8px 16px', background: tab === 'pending' ? '#ddd' : '#fff' }}
        >
          가입 신청 목록
        </button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <input
          value={globalFilter ?? ''}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder="전체 검색"
          style={{ width: '100%', maxWidth: 400, padding: 4, marginBottom: 8, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={table.getColumn('team')?.getFilterValue() || ''}
            onChange={e => table.getColumn('team')?.setFilterValue(e.target.value)}
            placeholder="팀 필터"
            style={{ width: 200, padding: 4, fontSize: '12px' }}
          />
          <input
            value={table.getColumn('department')?.getFilterValue() || ''}
            onChange={e => table.getColumn('department')?.setFilterValue(e.target.value)}
            placeholder="부서 필터"
            style={{ width: 200, padding: 4, fontSize: '12px' }}
          />
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  style={{
                    border: '1px solid #b1b1b1',
                    padding: '8px',
                    cursor: header.column.getCanSort() ? 'pointer' : 'default',
                    width: header.getSize(),
                  }}
                  onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getCanSort() && (
                    <span>
                      {header.column.getIsSorted() === 'asc' && ' ▲'}
                      {header.column.getIsSorted() === 'desc' && ' ▼'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <React.Fragment key={row.id}>
              <tr>
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    style={{
                      border: '1px solid #eee',
                      padding: '4px',
                      textAlign: 'center',
                      width: cell.column.getSize(),
                    }}
                  >
                    {row.getCanExpand() && cell.column.id === 'name' ? (
                      <span
                        style={{ cursor: 'pointer', marginRight: 4 }}
                        onClick={() => row.toggleExpanded()}
                      >
                        {row.getIsExpanded() ? '▼' : '▶'}{' '}
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </span>
                    ) : (
                      flexRender(cell.column.columnDef.cell, cell.getContext())
                    )}
                  </td>
                ))}
              </tr>
              {row.getIsExpanded() && (
                <tr>
                  <td colSpan={row.getVisibleCells().length} style={{ background: '#f2f2f9', padding: 8 }}>
                    <div>
                      <strong>상세정보</strong>
                      <pre>{JSON.stringify(row.original, null, 2)}</pre>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 10, userSelect: 'none' }}>
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          이전
        </button>{' '}
        <span>
          페이지 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
        </span>{' '}
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          다음
        </button>
      </div>
    </div>
  );
}

export default UserList;