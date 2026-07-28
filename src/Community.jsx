import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Spinner } from 'react-bootstrap';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faChevronRight,
  faEye,
  faFloppyDisk,
  faMagnifyingGlass,
  faPen,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import RichTextEditor, { EMPTY_DOCUMENT } from './components/RichTextEditor';
import TablePagination from './components/TablePagination';
import './styles/community.css';

const BOARD_LABELS = {
  notice: '공지사항',
  board: '자유게시판',
};

function normalizeBoardType(value) {
  return value === 'board' ? 'board' : 'notice';
}

function formatCommunityDate(value, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(date);
}

async function parseApiResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function CommunityTabs({ boardType, onChange }) {
  return (
    <div className="community_tabs" role="tablist" aria-label="게시판 선택">
      {Object.entries(BOARD_LABELS).map(([value, label]) => (
        <button
          type="button"
          key={value}
          className={boardType === value ? 'active' : ''}
          onClick={() => onChange(value)}
          role="tab"
          aria-selected={boardType === value}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CommunityList({ boardType, onBoardChange }) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPosts = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    const params = new URLSearchParams({
      boardType,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search) params.set('search', search);

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/community/posts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await parseApiResponse(response);
      if (!response.ok) throw new Error(payload.error || '게시글 목록을 불러오지 못했습니다.');

      setPosts(Array.isArray(payload.posts) ? payload.posts : []);
      setTotal(Number(payload.pagination?.total) || 0);
      setTotalPages(Math.max(1, Number(payload.pagination?.totalPages) || 1));
      setCanWrite(Boolean(payload.permissions?.canWrite));
    } catch (fetchError) {
      console.error('Fetch community posts error:', fetchError);
      setPosts([]);
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }, [boardType, page, pageSize, search]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    setPage(1);
    setSearchInput('');
    setSearch('');
  }, [boardType]);

  const handleSearch = event => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <section className="community_block">
      <div className="community_panel">
        <header className="community_header">
          <div>
            <h1>{BOARD_LABELS[boardType]}</h1>
            <CommunityTabs boardType={boardType} onChange={onBoardChange} />
          </div>
          {canWrite && (
            <button
              type="button"
              className="community_primary_button"
              onClick={() => navigate(`/community/write?tab=${boardType}`)}
            >
              <span>글쓰기</span>
            </button>
          )}
        </header>

        <form className="community_search" onSubmit={handleSearch}>
          <label>
            <span>통합검색</span>
            <input
              type="search"
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              placeholder="제목, 내용, 작성자 검색"
            />
          </label>
          <button type="submit">
            <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
            <span>검색</span>
          </button>
        </form>

        {error && <Alert variant="danger" className="community_alert">{error}</Alert>}

        <div className="community_list_summary">
          <strong>전체 <span>{total.toLocaleString('ko-KR')}</span>개</strong>
        </div>

        <div className="community_post_list" aria-live="polite">
          {loading ? (
            <div className="community_list_state">
              <Spinner animation="border" size="sm" />
              <span>게시글을 불러오는 중입니다.</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="community_list_state">
              {search ? '검색 결과가 없습니다.' : '등록된 게시글이 없습니다.'}
            </div>
          ) : posts.map((post, index) => (
            <button
              type="button"
              className="community_post_item"
              key={post.id}
              onClick={() => navigate(`/community/${post.id}?tab=${boardType}`)}
            >
              <span className="community_post_number">
                {total - (page - 1) * pageSize - index}
              </span>

              <span className="community_post_body">
                <span className="community_post_title_row">
                  <span className={`community_post_type ${boardType}`}>
                    {boardType === 'notice' ? '공지' : '자유'}
                  </span>
                  <strong>{post.title}</strong>
                </span>
                <span className="community_post_list_meta">
                  <span className="community_author_name">{post.authorName}</span>
                  <time dateTime={post.createdAt}>{formatCommunityDate(post.createdAt)}</time>
                  <span className="community_post_views">
                    <FontAwesomeIcon icon={faEye} aria-hidden="true" />
                    {Number(post.viewCount || 0).toLocaleString('ko-KR')}
                  </span>
                </span>
              </span>

              <FontAwesomeIcon className="community_post_arrow" icon={faChevronRight} aria-hidden="true" />
            </button>
          ))}
        </div>

        <footer className="community_footer">
          <select
            value={pageSize}
            onChange={event => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            aria-label="페이지당 게시글 수"
          >
            {[10, 20, 30].map(value => <option key={value} value={value}>{value}개</option>)}
          </select>
          <TablePagination
            pageIndex={page - 1}
            pageCount={totalPages}
            onPageChange={nextPage => setPage(nextPage + 1)}
          />
          <span className="community_total">총 {total.toLocaleString('ko-KR')}개</span>
        </footer>
      </div>
    </section>
  );
}

function CommunityDetail({ boardType }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchPost = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/community/posts/${id}?trackView=true`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await parseApiResponse(response);
        if (!response.ok) throw new Error(payload.error || '게시글을 불러오지 못했습니다.');
        if (active) setPost(payload.post);
      } catch (fetchError) {
        console.error('Fetch community post error:', fetchError);
        if (active) setError(fetchError.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchPost();
    return () => { active = false; };
  }, [id]);

  const effectiveBoardType = normalizeBoardType(post?.boardType || boardType);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/community/posts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await parseApiResponse(response);
      if (!response.ok) throw new Error(payload.error || '게시글을 삭제하지 못했습니다.');
      navigate(`/community?tab=${effectiveBoardType}`, { replace: true });
    } catch (deleteError) {
      console.error('Delete community post error:', deleteError);
      setShowDeleteModal(false);
      setError(deleteError.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <section className="community_block">
        <div className="community_panel community_page_state">
          <Spinner animation="border" size="sm" />
          <span>게시글을 불러오는 중입니다.</span>
        </div>
      </section>
    );
  }

  if (error || !post) {
    return (
      <section className="community_block">
        <div className="community_panel">
          <Alert variant="danger" className="community_alert">{error || '게시글을 찾을 수 없습니다.'}</Alert>
          <button type="button" className="community_secondary_button" onClick={() => navigate(`/community?tab=${boardType}`)}>
            <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
            목록
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="community_block">
      <article className="community_panel community_detail_panel">
        <header className="community_detail_header">
          <span className="community_board_badge">{BOARD_LABELS[effectiveBoardType]}</span>
          <h1>{post.title}</h1>
          <div className="community_post_meta">
            <span>{post.authorName}</span>
            {post.authorTeam && <span>{post.authorTeam}</span>}
            <time dateTime={post.createdAt}>{formatCommunityDate(post.createdAt, true)}</time>
            <span><FontAwesomeIcon icon={faEye} aria-hidden="true" /> {Number(post.viewCount || 0).toLocaleString('ko-KR')}</span>
          </div>
        </header>

        <RichTextEditor value={post.content} readOnly />

        <footer className="community_detail_actions">
          <button type="button" className="community_secondary_button" onClick={() => navigate(`/community?tab=${effectiveBoardType}`)}>
            <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
            목록
          </button>
          <div>
            {post.canEdit && (
              <button type="button" className="community_edit_button" onClick={() => navigate(`/community/${post.id}/edit?tab=${effectiveBoardType}`)}>
                <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                수정
              </button>
            )}
            {post.canDelete && (
              <button type="button" className="community_delete_button" onClick={() => setShowDeleteModal(true)}>
                <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                삭제
              </button>
            )}
          </div>
        </footer>
      </article>

      <Modal show={showDeleteModal} onHide={() => !deleting && setShowDeleteModal(false)} centered className="community_modal">
        <Modal.Header closeButton={!deleting}>
          <Modal.Title>게시글 삭제</Modal.Title>
        </Modal.Header>
        <Modal.Body>삭제한 게시글은 복구할 수 없습니다. 삭제하시겠습니까?</Modal.Body>
        <Modal.Footer>
          <button type="button" className="community_modal_cancel" onClick={() => setShowDeleteModal(false)} disabled={deleting}>취소</button>
          <button type="button" className="community_modal_confirm danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? '삭제 중...' : '삭제'}
          </button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}

function CommunityEditorPage({ boardType, mode, user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = mode === 'edit';
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(EMPTY_DOCUMENT);
  const [originalPost, setOriginalPost] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canCreate = Boolean(user?.canWritePosts);

  useEffect(() => {
    if (!isEdit) return undefined;

    let active = true;
    const fetchPost = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/community/posts/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await parseApiResponse(response);
        if (!response.ok) throw new Error(payload.error || '게시글을 불러오지 못했습니다.');
        if (!payload.post?.canEdit) throw new Error('게시글 수정 권한이 없습니다.');

        if (active) {
          setOriginalPost(payload.post);
          setTitle(payload.post.title || '');
          setContent(payload.post.content || EMPTY_DOCUMENT);
        }
      } catch (fetchError) {
        console.error('Fetch community post for edit error:', fetchError);
        if (active) setError(fetchError.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchPost();
    return () => { active = false; };
  }, [id, isEdit]);

  const effectiveBoardType = normalizeBoardType(originalPost?.boardType || boardType);

  const handleSubmit = async event => {
    event.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(isEdit ? `/api/community/posts/${id}` : '/api/community/posts', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          boardType: effectiveBoardType,
          title: title.trim(),
          content,
        }),
      });
      const payload = await parseApiResponse(response);
      if (!response.ok) throw new Error(payload.error || `게시글 ${isEdit ? '수정' : '등록'}에 실패했습니다.`);

      navigate(`/community/${payload.post.id || id}?tab=${effectiveBoardType}`, { replace: true });
    } catch (saveError) {
      console.error('Save community post error:', saveError);
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(isEdit ? `/community/${id}?tab=${effectiveBoardType}` : `/community?tab=${effectiveBoardType}`);
  };

  if (!isEdit && !canCreate) {
    return (
      <section className="community_block">
        <div className="community_panel">
          <Alert variant="warning" className="community_alert">게시글 작성 권한이 없습니다.</Alert>
          <button type="button" className="community_secondary_button" onClick={handleCancel}>
            <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
            목록
          </button>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="community_block">
        <div className="community_panel community_page_state">
          <Spinner animation="border" size="sm" />
          <span>게시글을 불러오는 중입니다.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="community_block">
      <form className="community_panel community_write_panel" onSubmit={handleSubmit}>
        <header className="community_write_header">
          <div>
            <span className="community_board_badge">{BOARD_LABELS[effectiveBoardType]}</span>
            <h1>게시글 {isEdit ? '수정' : '등록'}</h1>
          </div>
        </header>

        {error && <Alert variant="danger" className="community_alert">{error}</Alert>}

        <label className="community_title_field">
          <span>제목</span>
          <input
            type="text"
            value={title}
            onChange={event => setTitle(event.target.value)}
            maxLength="200"
            placeholder="제목을 입력해주세요."
            disabled={saving}
            autoFocus
          />
          <small>{title.length}/200</small>
        </label>

        <div className="community_content_field">
          <span>내용</span>
          <RichTextEditor value={content} onChange={setContent} />
        </div>

        <footer className="community_write_actions">
          <button type="button" className="community_secondary_button" onClick={handleCancel} disabled={saving}>
            취소
          </button>
          <button type="submit" className="community_primary_button" disabled={saving}>
            <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
            <span>{saving ? '저장 중...' : isEdit ? '수정 저장' : '등록'}</span>
          </button>
        </footer>
      </form>
    </section>
  );
}

function Community({ user, mode = 'list' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const boardType = useMemo(() => normalizeBoardType(searchParams.get('tab')), [searchParams]);

  if (mode === 'detail') return <CommunityDetail boardType={boardType} />;
  if (mode === 'write' || mode === 'edit') {
    return <CommunityEditorPage boardType={boardType} mode={mode} user={user} />;
  }

  return (
    <CommunityList
      boardType={boardType}
      onBoardChange={nextBoard => navigate(`/community?tab=${nextBoard}`)}
    />
  );
}

export default Community;
