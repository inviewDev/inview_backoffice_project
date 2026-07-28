import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAlignCenter,
  faAlignJustify,
  faAlignLeft,
  faAlignRight,
  faBold,
  faCode,
  faImage,
  faItalic,
  faLink,
  faLinkSlash,
  faListOl,
  faListUl,
  faMinus,
  faQuoteLeft,
  faRotateLeft,
  faRotateRight,
  faStrikethrough,
  faUnderline,
} from '@fortawesome/free-solid-svg-icons';

const EMPTY_DOCUMENT = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

const IMAGE_UPLOAD_MAX_SIZE = Math.floor(4.5 * 1024 * 1024);
const IMAGE_UPLOAD_URL = 'https://inview01.cafe24.com/inview_backoffice_community/upload.php';
const IMAGE_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function uploadCommunityImage(file, accessToken, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('image', file);

    request.open('POST', IMAGE_UPLOAD_URL, true);
    request.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    request.upload.addEventListener('progress', event => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener('load', () => {
      let response = null;
      try {
        response = JSON.parse(request.responseText || '{}');
      } catch {
        response = null;
      }

      if (request.status >= 200 && request.status < 300 && response?.url) {
        resolve(response);
        return;
      }

      reject(new Error(response?.error || `이미지 업로드에 실패했습니다. (${request.status})`));
    });
    request.addEventListener('error', () => {
      reject(new Error('이미지 저장 서버에 연결하지 못했습니다.'));
    });
    request.addEventListener('timeout', () => {
      reject(new Error('이미지 업로드 시간이 초과되었습니다.'));
    });
    request.timeout = 60000;
    request.send(formData);
  });
}

function ToolbarButton({ active = false, disabled = false, icon, label, onClick }) {
  return (
    <button
      type="button"
      className={`community_editor_tool ${active ? 'active' : ''}`}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      <FontAwesomeIcon icon={icon} aria-hidden="true" />
    </button>
  );
}

function RichTextToolbar({ editor }) {
  const imageInputRef = useRef(null);
  const [imageError, setImageError] = useState('');
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);

  if (!editor) return null;

  const handleImageFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!IMAGE_UPLOAD_TYPES.has(file.type)) {
      setImageError('JPG, PNG, WEBP, GIF 이미지만 등록할 수 있습니다.');
      return;
    }
    if (file.size > IMAGE_UPLOAD_MAX_SIZE) {
      setImageError('이미지는 파일당 4.5MB 이하로 등록해주세요.');
      return;
    }

    setImageError('');
    setIsImageLoading(true);
    setImageProgress(0);

    try {
      const accessToken = localStorage.getItem('access_token');
      if (!accessToken) throw new Error('로그인이 필요합니다.');

      const uploadedImage = await uploadCommunityImage(file, accessToken, setImageProgress);

      const inserted = editor.chain().focus().setImage({ src: uploadedImage.url, alt: file.name }).run();
      if (!inserted) throw new Error('이미지를 본문에 추가하지 못했습니다.');
    } catch (error) {
      console.error('Community image upload error:', error);
      setImageError(error?.message || '이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsImageLoading(false);
      setImageProgress(0);
    }
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href || '';
    const url = window.prompt('연결할 주소를 입력해주세요.', previousUrl);
    if (url === null) return;

    const normalizedUrl = url.trim();
    if (!normalizedUrl) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: normalizedUrl }).run();
  };

  const alignmentTools = [
    ['left', faAlignLeft, '왼쪽 정렬'],
    ['center', faAlignCenter, '가운데 정렬'],
    ['right', faAlignRight, '오른쪽 정렬'],
    ['justify', faAlignJustify, '양쪽 정렬'],
  ];

  return (
    <>
      <div className="community_editor_toolbar" role="toolbar" aria-label="게시글 서식 도구">
        <select
          className="community_editor_heading"
          value={
            editor.isActive('heading', { level: 1 }) ? '1'
              : editor.isActive('heading', { level: 2 }) ? '2'
                : editor.isActive('heading', { level: 3 }) ? '3'
                  : 'paragraph'
          }
          onChange={event => {
            const level = Number(event.target.value);
            if (level) editor.chain().focus().setHeading({ level }).run();
            else editor.chain().focus().setParagraph().run();
          }}
          aria-label="문단 서식"
          title="문단 서식"
        >
          <option value="paragraph">본문</option>
          <option value="1">제목 1</option>
          <option value="2">제목 2</option>
          <option value="3">제목 3</option>
        </select>

        <span className="community_editor_divider" aria-hidden="true" />

        <ToolbarButton icon={faBold} label="굵게" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarButton icon={faItalic} label="기울임" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarButton icon={faUnderline} label="밑줄" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <ToolbarButton icon={faStrikethrough} label="취소선" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <ToolbarButton icon={faCode} label="인라인 코드" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} />

        <span className="community_editor_divider" aria-hidden="true" />

        <ToolbarButton icon={faListUl} label="글머리 기호" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarButton icon={faListOl} label="번호 목록" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolbarButton icon={faQuoteLeft} label="인용" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <ToolbarButton icon={faMinus} label="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()} />

        <span className="community_editor_divider" aria-hidden="true" />

        {alignmentTools.map(([alignment, icon, label]) => (
          <ToolbarButton
            key={alignment}
            icon={icon}
            label={label}
            active={editor.isActive({ textAlign: alignment })}
            onClick={() => editor.chain().focus().setTextAlign(alignment).run()}
          />
        ))}

        <span className="community_editor_divider" aria-hidden="true" />

        <ToolbarButton
          icon={faImage}
          label={isImageLoading ? '이미지 업로드 중' : '이미지 추가'}
          disabled={isImageLoading}
          onClick={() => imageInputRef.current?.click()}
        />
        <ToolbarButton icon={faLink} label="링크 설정" active={editor.isActive('link')} onClick={setLink} />
        <ToolbarButton icon={faLinkSlash} label="링크 해제" disabled={!editor.isActive('link')} onClick={() => editor.chain().focus().unsetLink().run()} />

        <span className="community_editor_toolbar_spacer" />

        <ToolbarButton icon={faRotateLeft} label="실행 취소" disabled={!editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()} />
        <ToolbarButton icon={faRotateRight} label="다시 실행" disabled={!editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()} />

        <input
          ref={imageInputRef}
          type="file"
          className="community_editor_image_input"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleImageFile}
          tabIndex="-1"
        />
      </div>
      {isImageLoading && (
        <div className="community_editor_message progress">이미지 업로드 중... {imageProgress}%</div>
      )}
      {imageError && <div className="community_editor_message danger">{imageError}</div>}
    </>
  );
}

function RichTextEditor({ value, onChange, readOnly = false, placeholder = '내용을 입력해주세요.' }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: readOnly,
          autolink: true,
          defaultProtocol: 'https',
          HTMLAttributes: {
            target: '_blank',
            rel: 'noopener noreferrer nofollow',
          },
        },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: { class: 'community_editor_image' },
      }),
    ],
    content: value || EMPTY_DOCUMENT,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: readOnly ? 'community_prose community_prose_readonly' : 'community_prose',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange?.(currentEditor.getJSON(), currentEditor.getText({ blockSeparator: '\n' }));
    },
  }, [readOnly]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor || !value) return;
    const incoming = JSON.stringify(value);
    const current = JSON.stringify(editor.getJSON());
    if (incoming !== current) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className={`community_editor ${readOnly ? 'readonly' : ''}`}>
      {!readOnly && <RichTextToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

export { EMPTY_DOCUMENT };
export default RichTextEditor;
