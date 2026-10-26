import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal, Spinner } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faRotateRight, faStop } from '@fortawesome/free-solid-svg-icons';
import '../styles/room_usage.css';

const POLL_INTERVAL = 3000;

function startTime(value) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value));
}

export default function RoomUsage({ user }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyRoom, setBusyRoom] = useState(null);
  const [stopTarget, setStopTarget] = useState(null);
  const readController = useRef(null);
  const actionController = useRef(null);
  const mutating = useRef(false);
  const mounted = useRef(false);

  const refresh = useCallback(async () => {
    if (mutating.current || (readController.current && !readController.current.signal.aborted)) return;
    const controller = new AbortController();
    readController.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 10000);
    setRefreshing(true);
    try {
      const response = await fetch('/api/rooms', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '교육실 사용현황을 불러오지 못했습니다.');
      if (!Array.isArray(data.rooms) || data.rooms.length !== 4) throw new Error('교육실 사용현황을 확인할 수 없습니다.');
      if (!controller.signal.aborted && mounted.current) {
        setRooms(data.rooms);
        setLoadError('');
      }
    } catch (error) {
      if ((!controller.signal.aborted || timedOut) && mounted.current) {
        setLoadError(timedOut ? '사용 현황 조회가 지연되고 있습니다. 다시 시도해주세요.' : error.message);
      }
    } finally {
      window.clearTimeout(timeout);
      if (readController.current === controller) readController.current = null;
      if ((!controller.signal.aborted || timedOut) && mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh();
    const timer = window.setInterval(refreshVisible, POLL_INTERVAL);
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      readController.current?.abort();
      actionController.current?.abort();
    };
  }, [refresh, user.id]);

  async function changeUsage(room, action) {
    if (mutating.current) return;
    mutating.current = true;
    readController.current?.abort();
    const controller = new AbortController();
    actionController.current = controller;
    setBusyRoom(room.id);
    setActionError('');
    setStopTarget(null);
    setRefreshing(false);
    try {
      const response = await fetch(`/api/rooms/${room.id}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ revision: room.revision }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '공간 상태를 변경하지 못했습니다.');
      if (!data.room) throw new Error('변경된 공간 상태를 확인할 수 없습니다.');
      if (!controller.signal.aborted && mounted.current) {
        setRooms(previous => previous.map(item => item.id === data.room.id ? data.room : item));
      }
    } catch (error) {
      if (!controller.signal.aborted && mounted.current) setActionError(error.message);
    } finally {
      mutating.current = false;
      if (!controller.signal.aborted && mounted.current) {
        setBusyRoom(null);
        await refresh();
      }
    }
  }

  const availableCount = rooms.filter(room => !room.isOccupied).length;
  const error = loadError || actionError;

  return (
    <section className="dash_room_section" aria-labelledby="room_usage_title">
      <div className="dash_room_heading">
        <h2 id="room_usage_title" className="dash_section_title">교육실 사용현황</h2>
        <div className="dash_room_heading_actions">
          {!loading && !loadError && <span>사용 가능 <strong>{availableCount}/4</strong></span>}
          <button type="button" className="dash_room_refresh" onClick={() => refresh()} disabled={refreshing || Boolean(busyRoom)} title="사용 현황 새로고침" aria-label="사용 현황 새로고침">
            <FontAwesomeIcon icon={faRotateRight} spin={refreshing} />
          </button>
        </div>
      </div>
      <div className="dash_panel dash_room_panel" aria-busy={loading || Boolean(busyRoom)}>
        {error && <p className="dash_room_error" role="alert">{error}</p>}
        {loading ? (
          <div className="dash_room_state"><Spinner animation="border" size="sm" /> 사용 현황을 불러오는 중...</div>
        ) : rooms.length === 0 ? (
          <div className="dash_room_state">사용 현황을 확인할 수 없습니다.</div>
        ) : (
          <table className="dash_room_table" aria-label="교육실 및 대회의실 사용 현황">
            <colgroup><col className="dash_room_name_column" /><col className="dash_room_status_column" /><col /><col className="dash_room_action_column" /></colgroup>
            <thead><tr><th scope="col">공간</th><th scope="col">상태</th><th scope="col">사용 정보</th><th scope="col">사용</th></tr></thead>
            <tbody>
              {rooms.map(room => (
                <tr key={room.id} data-room-id={room.id}>
                  <th scope="row">{room.name}</th>
                  <td><span className={`dash_room_status ${room.isOccupied ? 'occupied' : 'available'}`}>{room.isOccupied ? '사용중' : '사용 가능'}</span></td>
                  <td>
                    {room.isOccupied ? <div className="dash_room_user">
                      <span title={[room.userName || '삭제된 직원', room.userTeam].filter(Boolean).join(' · ')}>{room.userName || '삭제된 직원'}{room.userTeam && <small> / {room.userTeam}</small>}</span>
                      <time dateTime={room.startedAt}>{startTime(room.startedAt)} 시작</time>
                    </div> : <span className="dash_room_empty"></span>}
                  </td>
                  <td>
                    {!room.isOccupied ? (
                      <button type="button" className="dash_room_action start" disabled={Boolean(busyRoom) || Boolean(loadError)} onClick={() => changeUsage(room, 'start')} aria-label={`${room.name} 사용 시작`}>
                        {busyRoom === room.id ? <Spinner animation="border" size="sm" /> : <FontAwesomeIcon icon={faPlay} />} 사용 시작
                      </button>
                    ) : room.canStop ? (
                      <button type="button" className="dash_room_action stop" disabled={Boolean(busyRoom) || Boolean(loadError)} onClick={() => room.userId === user.id ? changeUsage(room, 'stop') : setStopTarget(room)} aria-label={`${room.name} 사용 종료`}>
                        {busyRoom === room.id ? <Spinner animation="border" size="sm" /> : <FontAwesomeIcon icon={faStop} />} 사용 종료
                      </button>
                    ) : <span className="dash_room_empty">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal show={Boolean(stopTarget)} onHide={() => setStopTarget(null)} centered>
        <Modal.Header closeButton><Modal.Title>공간 사용 종료</Modal.Title></Modal.Header>
        <Modal.Body>{stopTarget?.userName || '다른 직원'}님이 사용 중인 {stopTarget?.name}의 사용을 종료하시겠습니까?</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setStopTarget(null)}>취소</Button>
          <Button variant="primary" onClick={() => changeUsage(stopTarget, 'stop')}>사용 종료</Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}
