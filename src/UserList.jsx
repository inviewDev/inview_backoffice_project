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
import TablePagination from './components/TablePagination';
import './styles/user_list.css';

const teamOptions = ['전체', '1팀', '2팀', '3팀', '4팀', '5팀', '6팀', '개발관리부'];
const departmentOptions = ['전체', '1부서', '2부서', '운영부서', '기타부서'];
const statusOptions = ['전체', '재직', '퇴사', '가입대기'];
const levelOptions = ['대표', '파트장', '팀장', '과장', '대리', '주임', '사원'];
const roleOptions = ['전체관리자', '관리자', '팀장', '사용자'];
const accountTeamOptions = teamOptions.slice(1);
const masterLoginIds = new Set(['cchee', 'cchee@gmail.com']);
const adVisibilityScopeOptions = [
  { value: 'own', label: '본인 광고만' },
  { value: 'team', label: '소속팀 광고' },
  { value: 'department', label: '소속부서 광고' },
  { value: 'all', label: '전체 광고' },
];
const adVisibilityScopeLabels = adVisibilityScopeOptions.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});
const adDeletePermissionLabels = {
  true: '허용',
  false: '미허용',
};
const adEditPermissionLabels = {
  true: '허용',
  false: '미허용',
};
const adPaymentStatusPermissionLabels = {
  true: '허용',
  false: '미허용',
};
const teamDepartmentMapping = {
  '1팀': '1부서',
  '3팀': '1부서',
  '4팀': '1부서',
  '2팀': '2부서',
  '5팀': '2부서',
  '6팀': '2부서',
  '개발관리부': '운영부서',
};
const columnHelper = createColumnHelper();

function isMasterLoginId(loginId) {
  return masterLoginIds.has(String(loginId || '').trim().toLowerCase());
}

function UserList({ user: currentUser }) {
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
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState([]);
  const [bulkDeleteSaving, setBulkDeleteSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [accountTarget, setAccountTarget] = useState(null);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountForm, setAccountForm] = useState({
    loginId: '',
    team: '',
    role: '',
    adVisibilityScope: 'own',
    canEditAds: false,
    canEditAdPaymentStatus: false,
    canDeleteAds: false,
    resetPassword: false,
  });
  const isMaster = currentUser?.role === '전체관리자';
  const isRootMaster = isMasterLoginId(currentUser?.email);

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
    // 실제 사용자 ID 추출 (행 인덱스가 아닌 original.id 사용)
    const selectedUsers = table.getSelectedRowModel().rows.map(row => row.original);
    const selectedIds = selectedUsers.map(user => user.id);

    if (bulkAction === 'delete') {
      setBulkDeleteTargets(selectedUsers);
      return;
    }

    const token = localStorage.getItem('access_token');
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
          } catch {
            try {
              errorMessage = await res.text();
            } catch {
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
          } catch {
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

  const handleBulkDelete = async () => {
    if (!isMaster || bulkDeleteTargets.length === 0) return;

    const token = localStorage.getItem('access_token');
    const targetIds = bulkDeleteTargets.map(user => user.id);
    setBulkDeleteSaving(true);

    try {
      const res = await fetch('/api/users/bulk-delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userIds: targetIds }),
      });
      const responseText = await res.text();
      let payload = {};

      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        payload = { error: responseText };
      }

      if (!res.ok) {
        throw new Error(payload.error || '사용자 일괄 삭제에 실패했습니다.');
      }

      const deletedIds = new Set(payload.deletedUserIds || targetIds);
      setData(prev => prev.filter(user => !deletedIds.has(user.id)));
      setPendingData(prev => prev.filter(user => !deletedIds.has(user.id)));
      setRowSelection({});
      setBulkAction('');
      setBulkDeleteTargets([]);
      showCustomModal(payload.message || `${deletedIds.size}명의 사용자 계정이 삭제되었습니다.`);
      await Promise.all([fetchUsers(), fetchPendingUsers()]);
    } catch (err) {
      console.error('Bulk delete users error:', err);
      showCustomModal('사용자 일괄 삭제 실패: ' + err.message, 'danger');
    } finally {
      setBulkDeleteSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;

    const token = localStorage.getItem('access_token');
    setDeleteSaving(true);

    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(async () => ({ error: await res.text() }));

      if (!res.ok) {
        throw new Error(payload.error || '사용자 삭제에 실패했습니다.');
      }

      setData(prev => prev.filter(user => user.id !== deleteTarget.id));
      setPendingData(prev => prev.filter(user => user.id !== deleteTarget.id));
      setRowSelection({});
      setDeleteTarget(null);
      showCustomModal('사용자 삭제가 완료되었습니다.');
      await Promise.all([fetchUsers(), fetchPendingUsers()]);
    } catch (err) {
      console.error('Delete user error:', err);
      showCustomModal('사용자 삭제 실패: ' + err.message, 'danger');
    } finally {
      setDeleteSaving(false);
    }
  };

  const openAccountSettings = targetUser => {
    setAccountTarget(targetUser);
    setAccountForm({
      loginId: targetUser.email || '',
      team: targetUser.level === '대표' ? '대표' : targetUser.team || '',
      role: targetUser.role || '사용자',
      adVisibilityScope: isMasterLoginId(targetUser.email) ? 'all' : targetUser.adVisibilityScope || 'own',
      canEditAds: isMasterLoginId(targetUser.email) ? true : Boolean(targetUser.canEditAds),
      canEditAdPaymentStatus: isMasterLoginId(targetUser.email) ? true : Boolean(targetUser.canEditAdPaymentStatus),
      canDeleteAds: isMasterLoginId(targetUser.email) ? true : Boolean(targetUser.canDeleteAds),
      resetPassword: false,
    });
  };

  const closeAccountSettings = (force = false) => {
    if (accountSaving && !force) return;
    setAccountTarget(null);
    setAccountForm({
      loginId: '',
      team: '',
      role: '',
      adVisibilityScope: 'own',
      canEditAds: false,
      canEditAdPaymentStatus: false,
      canDeleteAds: false,
      resetPassword: false,
    });
  };

  const handleAccountSettingsSave = async event => {
    event.preventDefault();
    if (!accountTarget || !isMaster) return;

    if (
      accountForm.resetPassword &&
      !window.confirm(`${accountTarget.name}님의 비밀번호를 1111로 초기화하시겠습니까?`)
    ) {
      return;
    }

    const token = localStorage.getItem('access_token');
    setAccountSaving(true);

    try {
      const requestPayload = { ...accountForm };
      if (!isRootMaster) {
        delete requestPayload.adVisibilityScope;
        delete requestPayload.canEditAds;
        delete requestPayload.canEditAdPaymentStatus;
        delete requestPayload.canDeleteAds;
      }

      const res = await fetch(`/api/users/${accountTarget.id}/account-settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });
      const responseText = await res.text();
      let payload = {};

      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        payload = { error: responseText };
      }

      if (!res.ok) {
        throw new Error(payload.error || '계정 설정 저장에 실패했습니다.');
      }

      setData(prev =>
        prev.map(user => (user.id === accountTarget.id ? payload.user : user))
      );
      setPendingData(prev =>
        prev.map(user => (user.id === accountTarget.id ? payload.user : user))
      );
      closeAccountSettings(true);
      showCustomModal(payload.message || '계정 설정이 저장되었습니다.');
      await Promise.all([fetchUsers(), fetchPendingUsers()]);
    } catch (err) {
      console.error('Update account settings error:', err);
      showCustomModal('계정 설정 저장 실패: ' + err.message, 'danger');
    } finally {
      setAccountSaving(false);
    }
  };

  // userColumns 정의
  const userColumns = [
    ...(isMaster ? [{
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
    }] : []),
    columnHelper.accessor('id', { header: 'ID', size: 60 }),
    columnHelper.accessor('name', { header: '이름', size: 100 }),
    columnHelper.accessor('email', { header: '아이디', size: 200 }),
    columnHelper.accessor('team', { header: '팀', size: 120, enableFiltering: true, filterFn: 'includesString' }),
    columnHelper.accessor('department', { header: '부서', size: 120, enableFiltering: true, filterFn: 'includesString' }),
    columnHelper.accessor('role', { header: '권한', size: 150 }),
    ...(isRootMaster ? [
      columnHelper.accessor('adVisibilityScope', {
        header: '광고열람',
        size: 130,
        cell: info => adVisibilityScopeLabels[info.getValue()] || '본인 광고만',
      }),
      columnHelper.accessor('canEditAds', {
        header: '광고수정',
        size: 110,
        cell: info => adEditPermissionLabels[String(Boolean(info.getValue()))],
      }),
      columnHelper.accessor('canEditAdPaymentStatus', {
        header: '상태수정',
        size: 110,
        cell: info => adPaymentStatusPermissionLabels[String(Boolean(info.getValue()))],
      }),
      columnHelper.accessor('canDeleteAds', {
        header: '광고삭제',
        size: 110,
        cell: info => adDeletePermissionLabels[String(Boolean(info.getValue()))],
      }),
    ] : []),
    ...(isMaster ? [{
      id: 'accountSettings',
      header: '계정설정',
      cell: ({ row }) => (
        <Button
          variant="outline-primary"
          size="sm"
          className="userlist_account_button"
          onClick={() => openAccountSettings(row.original)}
        >
          설정
        </Button>
      ),
      size: 96,
      enableSorting: false,
      enableFiltering: false,
    }] : []),
    columnHelper.accessor('status', {
      header: '상태',
      size: 120,
      enableFiltering: true,
      filterFn: 'includesString',
      cell: ({ row, getValue }) => {
        const currentStatus = getValue();

        const handleChange = async (e) => {
          const newStatus = e.target.value;
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
          }
        };

        return isMaster ? (
          <Form.Select value={currentStatus} onChange={handleChange}>
            {statusOptions.slice(1).map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Form.Select>
        ) : (
          <span>{currentStatus}</span>
        );
      },
    }),
    columnHelper.accessor('level', {
      header: '직급',
      size: 120,
      cell: ({ row, getValue }) => {
        const currentLevel = getValue();

        const handleChange = async (e) => {
          const newLevel = e.target.value;
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
          }
        };

        return isMaster ? (
          <Form.Select value={currentLevel} onChange={handleChange}>
            {levelOptions.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Form.Select>
        ) : (
          <span>{currentLevel}</span>
        );
      },
    }),
    ...(isMaster ? [{
      id: 'delete',
      header: '삭제',
      cell: ({ row }) => (
        <Button
          variant="outline-danger"
          size="sm"
          className="userlist_delete_button"
          onClick={() => setDeleteTarget(row.original)}
          disabled={row.original.id === currentUser?.id}
        >
          삭제
        </Button>
      ),
      size: 90,
      enableSorting: false,
      enableFiltering: false,
    }] : []),
  ];

  // pendingColumns 정의 (체크박스 없음, 단일 액션만)
  const pendingColumns = [
    columnHelper.accessor('id', { header: 'ID', size: 60 }),
    columnHelper.accessor('name', { header: '이름', size: 100 }),
    columnHelper.accessor('email', { header: '아이디', size: 200 }),
    columnHelper.accessor('team', { header: '팀', size: 120, enableFiltering: true, filterFn: 'includesString' }),
    columnHelper.accessor('department', { header: '부서', size: 120, enableFiltering: true, filterFn: 'includesString' }),
    columnHelper.accessor('level', { header: '직급', size: 120 }),
    {
      id: 'actions',
      header: '액션',
      cell: ({ row }) => isMaster ? (
        <div className="userlist_action_buttons">
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
          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => setDeleteTarget(row.original)}
            disabled={row.original.id === currentUser?.id}
          >
            삭제
          </Button>
        </div>
      ) : (
        <span className="userlist_readonly_text">조회 전용</span>
      ),
      size: 220,
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
    enableRowSelection: row =>
      isMaster &&
      tab === 'users' &&
      row.original.id !== currentUser?.id,
    enableColumnOrdering: true,
    enableExpanding: true,
    debugTable: false,
  });

  const selectedCount = Object.keys(rowSelection).filter(key => rowSelection[key]).length;
  const accountDepartment =
    accountTarget?.level === '대표'
      ? '대표'
      : teamDepartmentMapping[accountForm.team] || accountTarget?.department || '기타부서';
  const availableAccountTeams =
    accountTarget?.level === '대표'
      ? ['대표']
      : accountTarget?.team && !accountTeamOptions.includes(accountTarget.team)
        ? [accountTarget.team, ...accountTeamOptions]
        : accountTeamOptions;

  if (isLoading) {
    return (
      <section className="userlist_block">
        <div className="userlist_state">로딩 중...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="userlist_block">
        <Alert variant="danger" className="userlist_error">에러: {error}</Alert>
      </section>
    );
  }

  return (
    <>
      <section className="userlist_block">
        <Container className="userlist_container">
          <div className="userlist_header">
            <div className="userlist_summary">
              <span>{data.length}명</span>
              <strong>{pendingData.length}건 대기</strong>
            </div>
          </div>
          <Tabs
            activeKey={tab}
            onSelect={(k) => setTab(k)}
            className="userlist_tabs"
          >
            <Tab eventKey="users" title="직원목록" />
            <Tab eventKey="pending" title="대기목록" />
          </Tabs>
          
          {/* 벌크 액션 UI - users 탭에서만 */}
          {isMaster && tab === 'users' && selectedCount > 0 && (
            <Alert variant="info" className="userlist_bulk_alert">
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
                <option value="delete">삭제</option>
              </Form.Select>
              <Button
                variant={bulkAction === 'delete' ? 'danger' : 'primary'}
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

          <Form className="userlist_filter">
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
          <div className="userlist_table_card">
            <div className="userlist_table_wrap">
          <Table responsive className="userlist_table">
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
                        <span className="userlist_sort_mark">
                          {header.column.getIsSorted() === 'asc' && '▲'}
                          {header.column.getIsSorted() === 'desc' && '▼'}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={table.getVisibleLeafColumns().length} className="userlist_empty">
                    표시할 직원 정보가 없습니다.
                  </td>
                </tr>
              ) : table.getRowModel().rows.map(row => (
                <React.Fragment key={row.id}>
                  <tr>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} style={{ width: cell.column.getSize(), textAlign: 'center' }}>
                        {row.getCanExpand() && cell.column.id === 'name' ? (
                          <span
                            className="userlist_expand_button"
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
                      <td colSpan={row.getVisibleCells().length} className="userlist_detail_row">
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
            </div>
          </div>
          <div className="userlist_pager">
            <TablePagination
              pageIndex={table.getState().pagination.pageIndex}
              pageCount={table.getPageCount()}
              onPageChange={page => table.setPageIndex(page)}
            />
          </div>
        </Container>
      </section>

      <Modal
        show={bulkDeleteTargets.length > 0}
        onHide={() => !bulkDeleteSaving && setBulkDeleteTargets([])}
        centered
        className="custom-width-modal userlist_bulk_delete_modal"
      >
        <Modal.Header closeButton={!bulkDeleteSaving}>
          <Modal.Title className="text-danger">직원 일괄 삭제</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="userlist_bulk_delete_title">
            선택한 {bulkDeleteTargets.length}명의 계정을 삭제할까요?
          </p>
          <div className="userlist_bulk_delete_list">
            {bulkDeleteTargets.map(target => (
              <div key={target.id}>
                <strong>{target.name || '-'}</strong>
                <span>{target.email || '-'}</span>
              </div>
            ))}
          </div>
          <p className="userlist_delete_modal_warn">
            선택된 직원의 개인 메모, 일정, 광고, 회사 및 급여 데이터도 함께 삭제됩니다.
            삭제 후에는 복구할 수 없습니다.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setBulkDeleteTargets([])}
            disabled={bulkDeleteSaving}
          >
            취소
          </Button>
          <Button variant="danger" onClick={handleBulkDelete} disabled={bulkDeleteSaving}>
            {bulkDeleteSaving ? '삭제 중...' : `${bulkDeleteTargets.length}명 삭제`}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={Boolean(accountTarget)}
        onHide={closeAccountSettings}
        centered
        className="custom-width-modal userlist_account_modal"
      >
        <Form onSubmit={handleAccountSettingsSave}>
          <Modal.Header closeButton={!accountSaving}>
            <Modal.Title>계정 설정</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="userlist_account_subject">
              <strong>{accountTarget?.name || '-'}</strong>
              <span>{accountTarget?.email || '-'}</span>
            </div>

            <div className="userlist_account_form">
              <label className="userlist_account_row">
                <span>아이디</span>
                <div>
                  <Form.Control
                    type="text"
                    value={accountForm.loginId}
                    onChange={event =>
                      setAccountForm(prev => ({ ...prev, loginId: event.target.value.trim() }))
                    }
                    disabled={accountSaving}
                    autoComplete="off"
                    required
                  />
                  <small>아이디는 영문과 숫자만 사용할 수 있습니다.</small>
                </div>
              </label>

              <label className="userlist_account_row">
                <span>팀</span>
                <Form.Select
                  value={accountForm.team}
                  onChange={event =>
                    setAccountForm(prev => ({ ...prev, team: event.target.value }))
                  }
                  disabled={accountSaving || accountTarget?.level === '대표'}
                  required
                >
                  {availableAccountTeams.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Form.Select>
              </label>

              <div className="userlist_account_row">
                <span>부서</span>
                <div className="userlist_account_readonly">{accountDepartment}</div>
              </div>

              <label className="userlist_account_row">
                <span>권한</span>
                <Form.Select
                  value={accountForm.role}
                  onChange={event =>
                    setAccountForm(prev => ({ ...prev, role: event.target.value }))
                  }
                  disabled={accountSaving || accountTarget?.id === currentUser?.id}
                  required
                >
                  {roleOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Form.Select>
              </label>

              {isRootMaster && (
                <>
                  <label className="userlist_account_row">
                    <span>광고열람</span>
                    <div>
                      <Form.Select
                        value={accountForm.adVisibilityScope}
                        onChange={event =>
                          setAccountForm(prev => ({ ...prev, adVisibilityScope: event.target.value }))
                        }
                        disabled={accountSaving || isMasterLoginId(accountTarget?.email)}
                      >
                        {adVisibilityScopeOptions.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Form.Select>
                      <small>
                        팀/부서 기준은 대상 사용자의 현재 소속 기준으로 적용됩니다.
                        {isMasterLoginId(accountTarget?.email) ? ' 마스터 계정은 전체 광고 열람으로 고정됩니다.' : ''}
                      </small>
                    </div>
                  </label>

                  <label className="userlist_permission_toggle">
                    <Form.Check
                      type="checkbox"
                      checked={accountForm.canEditAds}
                      onChange={event =>
                        setAccountForm(prev => ({ ...prev, canEditAds: event.target.checked }))
                      }
                      disabled={accountSaving || isMasterLoginId(accountTarget?.email)}
                    />
                    <span>
                      <strong>광고상품 수정권한</strong>
                      <small>
                        광고관리 상세에서 광고상품 정보를 수정할 수 있습니다.
                        {isMasterLoginId(accountTarget?.email) ? ' 마스터 계정은 항상 허용됩니다.' : ''}
                      </small>
                    </span>
                  </label>

                  <label className="userlist_permission_toggle">
                    <Form.Check
                      type="checkbox"
                      checked={accountForm.canEditAdPaymentStatus}
                      onChange={event =>
                        setAccountForm(prev => ({ ...prev, canEditAdPaymentStatus: event.target.checked }))
                      }
                      disabled={accountSaving || isMasterLoginId(accountTarget?.email)}
                    />
                    <span>
                      <strong>결제상태 수정권한</strong>
                      <small>
                        광고관리 상세에서 결제상태만 별도로 수정할 수 있습니다.
                        {isMasterLoginId(accountTarget?.email) ? ' 마스터 계정은 항상 허용됩니다.' : ''}
                      </small>
                    </span>
                  </label>

                  <label className="userlist_permission_toggle">
                    <Form.Check
                      type="checkbox"
                      checked={accountForm.canDeleteAds}
                      onChange={event =>
                        setAccountForm(prev => ({ ...prev, canDeleteAds: event.target.checked }))
                      }
                      disabled={accountSaving || isMasterLoginId(accountTarget?.email)}
                    />
                    <span>
                      <strong>광고상품 삭제권한</strong>
                      <small>
                        광고관리 상세에서 광고상품을 삭제할 수 있습니다.
                        {isMasterLoginId(accountTarget?.email) ? ' 마스터 계정은 항상 허용됩니다.' : ''}
                      </small>
                    </span>
                  </label>
                </>
              )}

              <label className="userlist_password_reset">
                <Form.Check
                  type="checkbox"
                  checked={accountForm.resetPassword}
                  onChange={event =>
                    setAccountForm(prev => ({ ...prev, resetPassword: event.target.checked }))
                  }
                  disabled={accountSaving}
                />
                <span>
                  <strong>비밀번호 초기화</strong>
                  <small>저장하면 비밀번호가 1111로 변경됩니다.</small>
                </span>
              </label>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={closeAccountSettings} disabled={accountSaving}>
              취소
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={
                accountSaving ||
                !accountForm.loginId ||
                !accountForm.team ||
                !accountForm.role
              }
            >
              {accountSaving ? '저장 중...' : '저장'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={Boolean(deleteTarget)}
        onHide={() => !deleteSaving && setDeleteTarget(null)}
        centered
        className="custom-width-modal userlist_delete_modal"
        size="sm"
      >
        <Modal.Header closeButton={!deleteSaving}>
          <Modal.Title className="text-danger">사용자 삭제</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="userlist_delete_modal_title">
            {deleteTarget?.name || '-'} 계정을 삭제할까요?
          </p>
          <p className="userlist_delete_modal_desc">
            {deleteTarget?.email || '-'}
          </p>
          <p className="userlist_delete_modal_warn">
            연결된 개인 메모, 일정, 광고, 급여 데이터도 함께 삭제됩니다.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteSaving}>
            취소
          </Button>
          <Button variant="danger" onClick={handleDeleteUser} disabled={deleteSaving}>
            {deleteSaving ? '삭제 중...' : '삭제'}
          </Button>
        </Modal.Footer>
      </Modal>

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
