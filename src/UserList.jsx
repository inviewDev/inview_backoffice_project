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
import { Container, Row, Col, Table, Tabs, Tab, Form, Button, Alert, Modal } from 'react-bootstrap';

const teamOptions = ['전체', '1팀', '2팀', '3팀', '4팀', '5팀', '6팀', '개발관리부'];
const departmentOptions = ['전체', '1부서', '2부서', '운영부서', '기타부서'];
const statusOptions = ['전체', '재직', '퇴사', '가입대기'];
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
  const [bulkAction, setBulkAction] = useState(''); // 벌크 액션 선택
  const [bulkSaving, setBulkSaving] = useState(false); // 벌크 액션 로딩

  // Modal 상태 관리
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalVariant, setModalVariant] = useState('success'); // success or danger

  // 데이터 fetch 함수 (재사용 위해 별도 추출)
  const fetchUsers = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setError('토큰이 없습니다.');
      return;
    }
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
    const token = localStorage.getItem('access_token');
    if (!token) {
      setError('토큰이 없습니다.');
      return;
    }
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

  // 초기 데이터 fetch
  useEffect(() => {
    Promise.all([fetchUsers(), fetchPendingUsers()]).finally(() => setIsLoading(false));
  }, []);

  // Modal 표시 함수
  const showCustomModal = (message, variant = 'success') => {
    setModalMessage(message);
    setModalVariant(variant);
    setShowModal(true);
  };

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
      showCustomModal('사용자 승인 완료');
      await fetchUsers(); // 재조회
    } catch (err) {
      setError(err.message);
      showCustomModal('승인 실패: ' + err.message, 'danger');
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
      showCustomModal('사용자 거절 완료');
      await fetchUsers(); // 재조회
    } catch (err) {
      setError(err.message);
      showCustomModal('거절 실패: ' + err.message, 'danger');
    }
  };

  // 벌크 액션 핸들러 (상태 변경만 예시로 구현, 필요시 확장)
  const handleBulkAction = async () => {
    if (!bulkAction || Object.keys(rowSelection).length === 0) return;
    const token = localStorage.getItem('access_token');
    // 실제 사용자 ID 추출 (행 인덱스가 아닌 original.id 사용)
    const selectedUsers = table.getSelectedRowModel().rows; 
    const selectedIds = selectedUsers.map(row => row.original.id);
    setBulkSaving(true);
    const failedResults = [];
    const failedIds = [];
    const successIds = []; // 성공한 ID 모음
    try {
      for (let i = 0; i < selectedIds.length; i++) {
        const id = selectedIds[i];
        const res = await fetch(`/api/users/${id}/status`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: bulkAction }),
        });
        if (!res.ok) {
          let errorMessage = 'Unknown error';
          try {
            const errorData = await res.json();
            errorMessage = errorData.error || errorData.message || '상태 변경 실패';
          } catch (jsonErr) {
            try {
              errorMessage = await res.text();
            } catch (textErr) {
              // 그대로 둠
            }
          }
          failedResults.push(errorMessage);
          failedIds.push(id);
        } else {
          // 성공한 경우 서버 응답에서 업데이트된 사용자 데이터 추출
          try {
            const response = await res.json();
            const updatedUser = response.user || response; // 서버 응답 형식에 맞게 (message, user)
            successIds.push({ id, updatedUser });
          } catch (jsonErr) {
            // JSON 파싱 실패 시, 로컬 업데이트 정보 임시 저장
            successIds.push({ id, updatedUser: { ...data.find(u => u.id === id), status: bulkAction } });
          }
        }
      }
      // 성공한 모든 변경을 한 번에 적용 (배치 업데이트)
      if (successIds.length > 0) {
        setData(prev =>
          prev.map(u => {
            const successUpdate = successIds.find(s => s.id === u.id);
            return successUpdate ? successUpdate.updatedUser : u;
          })
        );
      }
      if (failedResults.length > 0) {
        setError(`일부 실패 (${failedIds.length}명): ${failedResults.join('; ')}`);
        showCustomModal(`벌크 액션 완료: 성공 ${selectedIds.length - failedIds.length}명, 실패 ${failedIds.length}명`, 'danger');
      } else {
        setError(null);
        setRowSelection({}); // 선택 해제
        setBulkAction('');
        showCustomModal(`${selectedIds.length}명 상태 변경 완료`);
      }
      // 변경 즉시 전체 데이터 재조회 (최신화)
      await fetchUsers();
    } catch (err) {
      setError(`벌크 액션 처리 중 오류: ${err.message}`);
      showCustomModal('벌크 액션 실패: ' + err.message, 'danger');
    } finally {
      setBulkSaving(false);
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
      enableFiltering: true,
      filterFn: 'includesString',
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
            // 로컬 즉시 업데이트
            setData(prev =>
              prev.map(u =>
                u.id === row.original.id ? { ...u, status: newStatus } : u
              )
            );
            showCustomModal('상태 변경 완료');
            // 변경 즉시 전체 데이터 재조회
            await fetchUsers();
          } catch (err) {
            showCustomModal('상태 변경 실패: ' + err.message, 'danger');
          } finally {
            setSaving(false);
          }
        };

        return (
          <Form.Select value={currentStatus} onChange={handleChange} disabled={saving}>
            {statusOptions.slice(1).map(opt => (
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
            // 로컬 즉시 업데이트
            setData(prev =>
              prev.map(u =>
                u.id === row.original.id ? { ...u, level: newLevel } : u
              )
            );
            showCustomModal('직급 변경 완료');
            // 변경 즉시 전체 데이터 재조회
            await fetchUsers();
          } catch (err) {
            showCustomModal('직급 변경 실패: ' + err.message, 'danger');
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

  // pendingColumns 정의 (체크박스 없음, 단일 액션만)
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
    enableRowSelection: tab === 'users', // pending 탭에서는 선택 비활성화
    enableColumnOrdering: true,
    enableExpanding: true,
    debugTable: true,
  });

  const selectedCount = Object.keys(rowSelection).filter(key => rowSelection[key]).length;

  if (isLoading) return <Container><p>로딩 중...</p></Container>;
  if (error) return <Container><p className="text-danger">에러: {error}</p></Container>;

  return (
    <>
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
          
          {/* 벌크 액션 UI - users 탭에서만 */}
          {tab === 'users' && selectedCount > 0 && (
            <Alert variant="info" className="mb-3">
              <strong>{selectedCount}명 선택됨</strong>
              <Form.Select
                value={bulkAction}
                onChange={e => setBulkAction(e.target.value)}
                className="d-inline-block w-auto ms-3"
                disabled={bulkSaving}
              >
                <option value="">-----------</option>
                <option value="재직">재직처리</option>
                <option value="퇴사">퇴사처리</option>
              </Form.Select>
              <Button
                variant="primary"
                size="sm"
                onClick={handleBulkAction}
                disabled={!bulkAction || bulkSaving}
                className="ms-2"
              >
                {bulkSaving ? '처리 중...' : '실행'}
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setRowSelection({})}
                className="ms-1"
              >
                선택 해제
              </Button>
            </Alert>
          )}

          <Form className="mb-4">
            <Row className="g-2">
              <Col md={6} lg={3}>
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
              {tab === 'users' && (
                <Col md={3} lg={2}>
                  <Form.Select
                    value={table.getColumn('status')?.getFilterValue() || '전체'}
                    onChange={e =>
                      table.getColumn('status')?.setFilterValue(
                        e.target.value === '전체' ? undefined : e.target.value
                      )
                    }
                  >
                    {statusOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              )}
              {tab === 'pending' && (
                <Col md={3} lg={3}>
                  <span className="form-control-plaintext text-muted">대기 목록: 상태는 '가입대기'로 고정</span>
                </Col>
              )}
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

      {/* Custom Width Modal */}
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        centered
        className="custom-width-modal"
        size="sm" // 기본 크기, 필요시 lg/sm 조정
      >
        <Modal.Header closeButton className={`border-${modalVariant === 'success' ? 'success' : 'danger'}`}>
          <Modal.Title className={`text-${modalVariant}`}>
            {modalVariant === 'success' ? '성공' : '실패'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className={`text-${modalVariant}`}>
          {modalMessage}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            닫기
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default UserList;