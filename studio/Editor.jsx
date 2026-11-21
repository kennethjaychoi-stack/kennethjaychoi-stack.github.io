import { useCallback, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { Figure } from './Figure.js';
import { FaIcon } from './FaIcon.js';
import IconPicker from './IconPicker.jsx';
import Fa from './Fa.jsx';

const FONT_SIZES = ['15px', '16px', '17px', '18px', '20px', '24px'];

const FONTS = [
  { label: '본문 (Pretendard)', value: '' },
  { label: '명조', value: "'Nanum Myeongjo', serif" },
  { label: '푸어스토리 (손글씨)', value: "'Poor Story', 'Nanum Myeongjo', cursive" },
  { label: '오르빗', value: "'Orbit', 'Pretendard Variable', sans-serif" },
  { label: 'Schoolbell (영문)', value: "'Schoolbell', cursive" },
  { label: '고정폭', value: 'ui-monospace, monospace' },
];

/** 디자인 톤에 맞춘 팔레트. 자유 선택도 함께 둔다. */
const COLORS = [
  { label: '먹색', value: '#1A1A1A' },
  { label: '보조', value: '#6B6560' },
  { label: '단청 적색', value: '#9E3A2F' },
  { label: '청색', value: '#2F5E9E' },
  { label: '녹색', value: '#3F6B4A' },
  { label: '갈색', value: '#7A5C3E' },
  { label: '자색', value: '#6B3F6B' },
  { label: '회색', value: '#9A938C' },
];

const HIGHLIGHTS = ['#FFF1A8', '#D9F0D3', '#FBD9D3', '#D6E4F7'];

export default function Editor({ slug, title, onTitleChange, initialHtml, onChange, onDirty }) {
  const [iconOpen, setIconOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } },
      }),
      // 크기 · 글꼴 · 글자색 · 배경색 · 행간을 한 번에
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TableKit.configure({ table: { resizable: true } }),
      Figure,
      FaIcon,
      Placeholder.configure({ placeholder: '답사한 곳을 기록해보세요.' }),
      CharacterCount,
    ],
    content: initialHtml || '<p></p>',
    editorProps: {
      attributes: { class: 'tiptap prose-dapsa', spellcheck: 'false' },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((f) => upload(f));
        return true;
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((f) => upload(f));
        return true;
      },
    },
    /**
     * 글을 연 직후에도 '에디터가 직렬화한 HTML' 을 올려보낸다.
     * 이걸 빼면 수정 없이 저장할 때 원본 문자열이 그대로 쓰여서
     * 마크다운→HTML 변환이나 속성 정리가 반영되지 않는다.
     */
    onCreate: ({ editor }) => onChange?.(editor.getHTML()),
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
      onDirty?.(true);
    },
  });

  /** 업로드 → 리사이즈·webp 변환·EXIF(GPS) 제거는 서버가 처리한다. */
  const upload = useCallback(
    async (file) => {
      if (!slug) {
        alert('먼저 아래 기본 정보에서 "파일 이름(slug)"을 정해 주세요. 사진이 저장될 폴더 이름이 됩니다.');
        return;
      }
      setUploading(true);
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'content-type': 'application/octet-stream',
            // 헤더는 latin-1 만 담을 수 있어 한글 slug·파일명은 인코딩해서 보낸다
            'x-slug': encodeURIComponent(slug),
            'x-filename': encodeURIComponent(file.name),
          },
          body: file,
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error ?? '업로드 실패');
        editor
          ?.chain()
          .focus()
          .insertFigure({ src: data.src, alt: '', width: data.width, height: data.height, caption: '사진 설명' })
          .run();
      } catch (e) {
        alert(`사진을 올리지 못했습니다: ${e.message}`);
      } finally {
        setUploading(false);
      }
    },
    [editor, slug],
  );

  if (!editor) return <div className="editor-loading">편집기를 불러오는 중…</div>;

  const can = (fn) => () => fn(editor.chain().focus()).run();
  const act = (name, attrs) => (editor.isActive(name, attrs) ? 'on' : '');

  const setLink = () => {
    const prev = editor.getAttributes('link').href ?? '';
    const url = window.prompt('링크 주소 (비우면 해제)', prev);
    if (url === null) return;
    if (url === '') return editor.chain().focus().unsetLink().run();
    editor.chain().focus().setLink({ href: url }).run();
  };

  const askFontSize = () => {
    const v = window.prompt('글자 크기 (예: 19px)', '19px');
    if (v) editor.chain().focus().setFontSize(v).run();
  };

  return (
    <div className="editor">
      <div className="toolbar">
        {/* 글꼴 */}
        <select
          aria-label="글꼴"
          value={editor.getAttributes('textStyle').fontFamily ?? ''}
          onChange={(e) =>
            e.target.value
              ? editor.chain().focus().setFontFamily(e.target.value).run()
              : editor.chain().focus().unsetFontFamily().run()
          }
        >
          {FONTS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        {/* 글자 크기 */}
        <select
          aria-label="글자 크기"
          value={editor.getAttributes('textStyle').fontSize ?? ''}
          onChange={(e) => {
            if (e.target.value === 'custom') return askFontSize();
            e.target.value
              ? editor.chain().focus().setFontSize(e.target.value).run()
              : editor.chain().focus().unsetFontSize().run();
          }}
        >
          <option value="">크기 기본</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s.replace('px', '')}
            </option>
          ))}
          <option value="custom">직접 입력…</option>
        </select>

        <span className="sep" />

        <button type="button" className={act('bold')} onClick={can((c) => c.toggleBold())} title="굵게 (Cmd+B)">
          <b>B</b>
        </button>
        <button type="button" className={act('italic')} onClick={can((c) => c.toggleItalic())} title="기울임 (Cmd+I)">
          <i>I</i>
        </button>
        <button
          type="button"
          className={act('underline')}
          onClick={can((c) => c.toggleUnderline())}
          title="밑줄 (Cmd+U)"
        >
          <u>U</u>
        </button>
        <button type="button" className={act('strike')} onClick={can((c) => c.toggleStrike())} title="취소선">
          <s>S</s>
        </button>

        <span className="sep" />

        {/* 글자색 */}
        <div className="swatches" role="group" aria-label="글자색">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              className="swatch"
              style={{ background: c.value }}
              title={c.label}
              onClick={() => editor.chain().focus().setColor(c.value).run()}
            />
          ))}
          <input
            type="color"
            aria-label="색 직접 선택"
            title="색 직접 선택"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
          <button type="button" title="글자색 해제" onClick={can((c) => c.unsetColor())}>
            <Fa name="eraser" />
          </button>
        </div>

        <span className="sep" />

        {/* 형광펜 */}
        <div className="swatches" role="group" aria-label="형광펜">
          {HIGHLIGHTS.map((h) => (
            <button
              key={h}
              type="button"
              className="swatch"
              style={{ background: h }}
              title="형광펜"
              onClick={() => editor.chain().focus().toggleHighlight({ color: h }).run()}
            />
          ))}
          <button type="button" title="형광펜 해제" onClick={can((c) => c.unsetHighlight())}>
            <Fa name="eraser" />
          </button>
        </div>

        <span className="sep" />

        <button type="button" className={act('heading', { level: 2 })} onClick={can((c) => c.toggleHeading({ level: 2 }))}>
          H2
        </button>
        <button type="button" className={act('heading', { level: 3 })} onClick={can((c) => c.toggleHeading({ level: 3 }))}>
          H3
        </button>

        <span className="sep" />

        <button type="button" className={act('bulletList')} onClick={can((c) => c.toggleBulletList())} title="목록">
          <Fa name="list-ul" /> 목록
        </button>
        <button type="button" className={act('orderedList')} onClick={can((c) => c.toggleOrderedList())} title="번호 목록">
          <Fa name="list-ol" /> 목록
        </button>
        <button type="button" className={act('blockquote')} onClick={can((c) => c.toggleBlockquote())} title="인용">
          <Fa name="quote-left" />
        </button>
        <button type="button" onClick={can((c) => c.setHorizontalRule())} title="구분선">
          <Fa name="minus" />
        </button>

        <span className="sep" />

        <button type="button" className={act('left')} onClick={can((c) => c.setTextAlign('left'))} title="왼쪽">
          <Fa name="align-left" />
        </button>
        <button type="button" onClick={can((c) => c.setTextAlign('center'))} title="가운데">
          <Fa name="align-center" />
        </button>
        <button type="button" onClick={can((c) => c.setTextAlign('right'))} title="오른쪽">
          <Fa name="align-right" />
        </button>

        <span className="sep" />

        <button type="button" className={act('link')} onClick={setLink} title="링크">
          <Fa name="link" /> 링크
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} title="사진 올리기">
          {uploading ? '올리는 중…' : <><Fa name="image" /> 사진</>}
        </button>
        <button type="button" onClick={can((c) => c.toggleFigureBleed())} title="사진을 본문 폭보다 넓게">
          <Fa name="up-right-and-down-left-from-center" /> 넓게
        </button>
        <button
          type="button"
          onClick={can((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}
          title="표 넣기"
        >
          <Fa name="table-cells" /> 표
        </button>
        <button type="button" className={act('codeBlock')} onClick={can((c) => c.toggleCodeBlock())} title="코드블록">
          <Fa name="code" />
        </button>
        <button type="button" onClick={() => setIconOpen(true)} title="아이콘 넣기 (이모지 대신)">
          <Fa name="icons" /> 아이콘
        </button>

        <span className="sep" />

        <button type="button" onClick={can((c) => c.undo())} title="되돌리기">
          <Fa name="rotate-left" />
        </button>
        <button type="button" onClick={can((c) => c.redo())} title="다시 실행">
          <Fa name="rotate-right" />
        </button>
      </div>

      {editor.isActive('table') && (
        <div className="toolbar toolbar-sub">
          <span className="sub-label">표</span>
          <button type="button" onClick={can((c) => c.addRowAfter())}>
            행 추가
          </button>
          <button type="button" onClick={can((c) => c.deleteRow())}>
            행 삭제
          </button>
          <button type="button" onClick={can((c) => c.addColumnAfter())}>
            열 추가
          </button>
          <button type="button" onClick={can((c) => c.deleteColumn())}>
            열 삭제
          </button>
          <button type="button" onClick={can((c) => c.deleteTable())}>
            표 삭제
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          Array.from(e.target.files ?? []).forEach((f) => upload(f));
          e.target.value = '';
        }}
      />

      <div className="writing">
        <input
          className="title-input"
          value={title ?? ''}
          onChange={(e) => onTitleChange?.(e.target.value)}
          placeholder="제목"
          aria-label="제목"
        />
        <EditorContent editor={editor} />
      </div>

      <p className="editor-hint">
        <span className="count">{editor.storage.characterCount?.words?.() ?? 0}단어 · {editor.storage.characterCount?.characters?.() ?? 0}자</span>
        {' '}
        사진은 끌어다 놓거나 붙여넣어도 올라갑니다. 올릴 때 가로 1600px webp 로 변환되고 <strong>촬영 위치(GPS)
        정보가 제거</strong>됩니다.
      </p>

      {iconOpen && (
        <IconPicker
          onClose={() => setIconOpen(false)}
          onPick={(icon) => editor.chain().focus().insertFaIcon(icon).run()}
        />
      )}
    </div>
  );
}
