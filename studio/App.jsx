import { useCallback, useEffect, useState } from 'react';
import { marked } from 'marked';
import Editor from './Editor.jsx';
import Frontmatter from './Frontmatter.jsx';
import CommentQueue from './CommentQueue.jsx';

const today = () => new Date().toISOString().slice(0, 10);

/** 제목에서 파일 이름(slug)을 만든다. 서버의 safeSlug 와 같은 규칙. */
const slugify = (t) =>
  String(t ?? '')
    .trim()
    .replace(/[/\\]/g, '-')
    .replace(/\.{2,}/g, '')
    .replace(/[<>:"|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60);

const BLANK = () => ({
  kind: '유산',
  title: '',
  description: '',
  date: today(),
  category: '답사기',
  tags: [],
  draft: true,
  access: { primary: 'transit', asOf: today() },
});

/** 빈 값만 걷어낸다. 불리언은 스키마 기본값과 어긋날 수 있으니 그대로 둔다. */
function clean(v) {
  if (Array.isArray(v)) {
    const arr = v.map(clean).filter((x) => x !== undefined);
    return arr.length ? arr : undefined;
  }
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      const c = clean(val);
      if (c !== undefined) out[k] = c;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (v === '' || v === null) return undefined;
  return v;
}

/** 저장 직전 검증 — 조용히 깨지는 것보다 알려주는 게 낫다. */
function validate(fm, slug) {
  const problems = [];
  if (!slug.trim()) problems.push('파일 이름(slug)이 필요합니다.');
  if (!fm.title?.trim()) problems.push('제목이 필요합니다.');
  if (!fm.kind) problems.push('종류(유산/전시)를 골라 주세요.');
  if (!fm.category) problems.push('카테고리를 골라 주세요.');
  if (!fm.date) problems.push('작성일이 필요합니다.');

  if (fm.kind === '전시') {
    if (!fm.exhibition?.museum) problems.push('전시 글에는 박물관 이름이 필요합니다.');
    if (!fm.exhibition?.permanent && !fm.exhibition?.end)
      problems.push('특별전에는 종료일이 필요합니다. 종료일이 없으면 끝난 전시를 걸러낼 수 없습니다.');
  } else if (!fm.heritage?.some?.((h) => h?.name?.trim())) {
    problems.push('유산 글에는 유산 이름이 적어도 하나 필요합니다.');
  }

  const c = fm.location?.coords;
  if (c && (c.length !== 2 || c.some((n) => typeof n !== 'number' || Number.isNaN(n))))
    problems.push('위도·경도는 둘 다 숫자로 넣어야 합니다. (비우면 지도에 표시되지 않습니다)');

  return problems;
}

export default function App() {
  const [list, setList] = useState([]);
  const [slug, setSlug] = useState('');
  const [existing, setExisting] = useState(false);
  const [fm, setFm] = useState(BLANK());
  const [html, setHtml] = useState('<p></p>');
  const [initialHtml, setInitialHtml] = useState('<p></p>');
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState(null);
  const [key, setKey] = useState(0); // 편집기 강제 리마운트
  const [slugTouched, setSlugTouched] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const refresh = useCallback(async () => {
    const r = await fetch('/api/posts').then((x) => x.json());
    setList(r.posts ?? []);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 저장 안 한 변경이 있으면 탭을 닫을 때 경고
  useEffect(() => {
    const warn = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const newPost = () => {
    if (dirty && !confirm('저장하지 않은 변경이 있습니다. 새 글로 넘어갈까요?')) return;
    setSlug('');
    setExisting(false);
    setFm(BLANK());
    setInitialHtml('<p></p>');
    setHtml('<p></p>');
    setDirty(false);
    setStatus(null);
    setSlugTouched(false);
    setKey((k) => k + 1);
  };

  const open = async (s) => {
    if (dirty && !confirm('저장하지 않은 변경이 있습니다. 다른 글을 열까요?')) return;
    const r = await fetch(`/api/post?slug=${encodeURIComponent(s)}`).then((x) => x.json());
    if (r.error) return setStatus({ type: 'err', msg: r.error });

    const body = r.body ?? '';
    // 마크다운으로 쓰인 기존 글은 HTML 로 변환해 불러온다.
    // 한 번 저장하면 그 글은 HTML 로 보관된다.
    const asHtml = /^\s*</.test(body) ? body : marked.parse(body);

    setSlug(r.slug);
    setExisting(true);
    setFm(r.frontmatter ?? {});
    setInitialHtml(asHtml);
    setHtml(asHtml);
    setDirty(false);
    setStatus(null);
    setSlugTouched(true);
    setKey((k) => k + 1);
  };

  const save = async () => {
    const cleaned = clean(fm) ?? {};
    const problems = validate(cleaned, slug);
    if (problems.length) {
      setStatus({ type: 'err', msg: problems.join('\n') });
      return;
    }
    const r = await fetch('/api/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, frontmatter: cleaned, html }),
    }).then((x) => x.json());

    if (r.ok) {
      setStatus({ type: 'ok', msg: `저장했습니다 → ${r.path}` });
      setExisting(true);
      setDirty(false);
      refresh();
    } else {
      setStatus({ type: 'err', msg: r.error ?? '저장에 실패했습니다.' });
    }
  };

  /** 글 내리기 — 파일은 content/.trash/ 로 옮겨지고 지워지지 않는다. */
  const remove = async (s) => {
    if (!confirm(`"${s}" 글을 목록에서 내릴까요?\n\n파일은 content/.trash/ 로 옮겨집니다. 사진도 그대로 남습니다.`)) return;
    const r = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: s }),
    }).then((x) => x.json());
    if (s === slug) newPost();
    if (r.ok) setStatus({ type: 'ok', msg: `휴지통으로 옮겼습니다 → ${r.movedTo}` });
    refresh();
  };

  const changeTitle = (t) => {
    setFm((f) => ({ ...f, title: t }));
    setDirty(true);
    // 새 글이고 파일 이름을 아직 손대지 않았다면 제목을 따라간다
    if (!existing && !slugTouched) setSlug(slugify(t));
  };

  // 댓글 검토 화면 ↔ 글쓰기 화면
  const [view, setView] = useState('write');
  const [pendingCount, setPendingCount] = useState(0);

  // 편집기를 켜 둔 동안에도 새 댓글이 들어올 수 있으니 주기적으로 센다
  useEffect(() => {
    const count = () =>
      fetch('/api/comments/pending')
        .then((x) => x.json())
        .then((r) => setPendingCount((r.comments ?? []).length))
        .catch(() => {});
    count();
    const t = setInterval(count, 30_000);
    return () => clearInterval(t);
  }, []);

  // Cmd+S 로 저장
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="app">
      <aside className="sidebar">
        <header>
          <h1>걷고 보다</h1>
          <p>로컬 편집기</p>
        </header>

        <button type="button" className="primary block" onClick={() => { setView('write'); newPost(); }}>
          + 새 글
        </button>

        <button
          type="button"
          className={`block queue-link ${view === 'comments' ? 'on' : ''}`}
          onClick={() => setView(view === 'comments' ? 'write' : 'comments')}
        >
          댓글 검토
          {pendingCount > 0 && <span className="badge">{pendingCount}</span>}
        </button>

        <nav>
          {list.map((p) => (
            <div key={p.slug} className={`item ${p.slug === slug ? 'on' : ''}`}>
              <button type="button" onClick={() => { setView('write'); open(p.slug); }}>
                <strong>{p.title}</strong>
                <small>
                  {p.kind} · {p.category} · {String(p.date).slice(0, 10)}
                  {p.draft && <em> · 초고</em>}
                </small>
              </button>
            </div>
          ))}
          {list.length === 0 && <p className="empty">아직 글이 없습니다.</p>}
        </nav>

        <footer>
          <p>
            이 편집기는 <strong>로컬에서만</strong> 돌아갑니다. 공개된 사이트에는 포함되지 않습니다.
          </p>
          <p>저장하면 글이 파일로 쓰이고, git 이 이력을 관리합니다.</p>
        </footer>
      </aside>

      <main className="main">
        {view === 'comments' && <CommentQueue onCountChange={setPendingCount} />}

        {/* 글쓰기 화면은 감추기만 한다 — 떼어내면 쓰던 내용이 날아간다 */}
        <div hidden={view === 'comments'}>
        <div className="bar">
          <div className="bar-title">
            {slug ? (
              <>
                <code>content/posts/{slug}.md</code>
                {existing ? <span className="tag">기존 글</span> : <span className="tag new">새 글</span>}
                {dirty && <span className="tag dirty">저장 안 됨</span>}
              </>
            ) : (
              <span className="muted">새 글 — 아래에서 제목과 파일 이름을 정하세요</span>
            )}
          </div>
          {/* 초고 ↔ 공개. 글 정보를 펼치지 않아도 여기서 바로 바꾼다. */}
          <button
            type="button"
            className={`toggle ${fm.draft ? 'draft' : 'live'}`}
            onClick={() => {
              setFm((f) => ({ ...f, draft: !f.draft }));
              setDirty(true);
            }}
            title={fm.draft ? '누르면 공개 글이 됩니다' : '누르면 초고로 돌아갑니다'}
          >
            {fm.draft ? '초고' : '공개'}
          </button>

          {existing && (
            <button type="button" className="danger" onClick={() => remove(slug)}>
              내리기
            </button>
          )}
          <button type="button" className="primary" onClick={save}>
            저장 <small>⌘S</small>
          </button>
        </div>

        {status && <pre className={`status ${status.type}`}>{status.msg}</pre>}

        <Editor
          key={key}
          slug={slug}
          title={fm.title}
          onTitleChange={changeTitle}
          initialHtml={initialHtml}
          onChange={setHtml}
          onDirty={setDirty}
        />

        <div className="info">
          <button type="button" className="info-toggle" onClick={() => setInfoOpen((v) => !v)}>
            <span className={`chev ${infoOpen ? 'open' : ''}`}>▸</span>
            글 정보
            <small>
              분류 · 유산/전시 · 위치 · 가는 방법
              {!infoOpen && fm.kind ? ` — ${fm.kind}` : ''}
            </small>
          </button>

          {infoOpen && (
            <Frontmatter
              value={fm}
              onChange={(v) => {
                setFm(v);
                setDirty(true);
              }}
              slug={slug}
              slugLocked={existing}
              onSlugChange={(s) => {
                setSlug(s);
                setSlugTouched(true);
                setDirty(true);
              }}
            />
          )}
        </div>
        </div>
      </main>
    </div>
  );
}
