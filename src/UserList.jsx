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
import { Container, Row, Col, Table, Tabs, Tab, Form, Button } from 'react-bootstrap';

const teamOptions = ['전체', '1팀', '2팀', '3팀', '4팀', '5팀', '6팀', '개발관리부'];
const departmentOptions = ['전체', '1부서', '2부서', '운영부서', '기타부서'];
const statusOptions = ['재직', '퇴사', '가입대기'];
const levelOptions = ['대표', '파트장', '팀장', '과장', '대리', '주임', '사원'];
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
  const [tab, setTab] = useState('users');

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
        setData(json);
        setError(null);
      } catch (err) {
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
        setPendingData(json);
        setError(null);
      } catch (err) {
        setError(err.message);
        setPendingData([]);
      }
    };

    Promise.all([fetchUsers(), fetchPendingUsers()]).finally(() => setIsLoading(false));
  }, []);

  // 승인 핸들러
  const handleApprove = async (id) => {
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`/api/users/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setPendingData(pendingData.filter(user => user.id !== id));
      setData([...data, result.user]);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  // 거절 핸들러
  const handleReject = async (id) => {
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`/api/users/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setPendingData(pendingData.filter(user => user.id !== id));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  // userColumns 정의
  const userColumns = [
    {
      id: 'select',
      header: ({ table }) => (
        <Form.Check
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <Form.Check
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
      size: 50,
      enableSorting: false,
    },
    columnHelper.accessor('id', { header: 'ID', size: 60 }),
    columnHelper.accessor('name', { header: '이름', size: 100 }),
    columnHelper.accessor('email', { header: '이메일', size: 200 }),
    columnHelper.accessor('team', { header: '팀', size: 120, enableFiltering: true, filterFn: 'includesString' }),
    columnHelper.accessor('department', { header: '부서', size: 120, enableFiltering: true, filterFn: 'includesString' }),
    columnHelper.accessor('role', { header: '권한', size: 150 }),
    columnHelper.accessor('status', {
      header: '상태',
      size: 120,
      cell: ({ row, getValue }) => {
        const currentStatus = getValue();
        const [saving, setSaving] = React.useState(false);

        const handleChange = async (e) => {
          const newStatus = e.target.value;
          setSaving(true);
          try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`/api/users/${row.original.id}/status`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error(await res.text());
            setData(prev =>
              prev.map(u =>
                u.id === row.original.id ? { ...u, status: newStatus } : u
              )
            );
          } catch (err) {
            alert('상태 변경 실패: ' + err.message);
          } finally {
            setSaving(false);
          }
        };

        return (
          <Form.Select value={currentStatus} onChange={handleChange} disabled={saving}>
            {statusOptions.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Form.Select>
        );
      },
    }),
    columnHelper.accessor('level', {
      header: '직급',
      size: 120,
      cell: ({ row, getValue }) => {
        const currentLevel = getValue();
        const [saving, setSaving] = React.useState(false);

        const handleChange = async (e) => {
          const newLevel = e.target.value;
          setSaving(true);
          try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`/api/users/${row.original.id}/level`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ level: newLevel }),
            });
            if (!res.ok) throw new Error(await res.text());
            setData(prev =>
              prev.map(u =>
                u.id === row.original.id ? { ...u, level: newLevel } : u
              )
            );
          } catch (err) {
            alert('직급 변경 실패: ' + err.message);
          } finally {
            setSaving(false);
          }
        };

        return (
          <Form.Select value={currentLevel} onChange={handleChange} disabled={saving}>
            {levelOptions.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Form.Select>
        );
      },
    }),
  ];

  // pendingColumns 정의
  const pendingColumns = [
    columnHelper.accessor('id', { header: 'ID', size: 60 }),
    columnHelper.accessor('name', { header: '이름', size: 100 }),
    columnHelper.accessor('email', { header: '이메일', size: 200 }),
    columnHelper.accessor('team', { header: '팀', size: 120, enableFiltering: true, filterFn: 'includesString' }),
    columnHelper.accessor('department', { header: '부서', size: 120, enableFiltering: true, filterFn: 'includesString' }),
    columnHelper.accessor('level', { header: '직급', size: 120 }),
    {
      id: 'actions',
      header: '액션',
      cell: ({ row }) => (
        <div>
          <Button
            variant="success"
            size="sm"
            onClick={() => handleApprove(row.original.id)}
            className="me-2"
          >
            승인
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleReject(row.original.id)}
          >
            거절
          </Button>
        </div>
      ),
      size: 150,
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
    onColumnFiltersChange: setColumnFilters,
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

  if (isLoading) return <Container><p>로딩 중...</p></Container>;
  if (error) return <Container><p className="text-danger">에러: {error}</p></Container>;

  return (

    <section className='userlist_block'>
      <Container>
            <Tabs
              activeKey={tab}
              onSelect={(k) => setTab(k)}
              className="mb-3"
            >
              <Tab eventKey="users" title="직원목록" />
              <Tab eventKey="pending" title="대기목록" />
            </Tabs>
            <Form className="mb-4">
              <Row className="g-2">
                <Col md={6} lg={4}>
                  <Form.Control
                    type="text"
                    value={globalFilter ?? ''}
                    onChange={e => setGlobalFilter(e.target.value)}
                    placeholder="전체 검색"
                  />
                </Col>
                <Col md={3} lg={2}>
                  <Form.Select
                    value={table.getColumn('team')?.getFilterValue() || '전체'}
                    onChange={e =>
                      table.getColumn('team')?.setFilterValue(
                        e.target.value === '전체' ? undefined : e.target.value
                      )
                    }
                  >
                    {teamOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={3} lg={2}>
                  <Form.Select
                    value={table.getColumn('department')?.getFilterValue() || '전체'}
                    onChange={e =>
                      table.getColumn('department')?.setFilterValue(
                        e.target.value === '전체' ? undefined : e.target.value
                      )
                    }
                  >
                    {departmentOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>
            </Form>
            <Table striped bordered hover responsive>
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        style={{ width: header.getSize(), cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
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
                        <td key={cell.id} style={{ width: cell.column.getSize(), textAlign: 'center' }}>
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
                        <td colSpan={row.getVisibleCells().length} className="bg-light p-3">
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
            </Table>
            <div className="d-flex justify-content-between align-items-center mt-3">
              <Button
                variant="outline-primary"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                이전
              </Button>
              <span>
                페이지 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              </span>
              <Button
                variant="outline-primary"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                다음
              </Button>
            </div>
      </Container>
    </section>
  );
}

export default UserList;