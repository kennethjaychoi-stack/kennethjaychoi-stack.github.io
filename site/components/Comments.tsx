import { useEffect, useRef, useState } from 'react';

/**
 * 글 아래 댓글.
 *
 * 로그인이 없습니다 — 이름과 내용만 받습니다.
 * 쓴 댓글은 바로 보이지 않고, 제가 승인한 뒤에 올라갑니다.
 * 그래서 이 블로그에 글을 쓸 수 있는 사람은 여전히 저 하나입니다.
 */

const LIMITS = { name: 20, body: 1000 };

/**
 * 개발 중에는 댓글 API 가 옆 포트에서 따로 돕니다 (Astro 개발 서버가 새 경로를 안 받아서).
 * 배포하면 사이트와 같은 주소의 /api/comments 를 씁니다.
 */
const API =
  (import.meta.env.DEV ? 'http://127.0.0.1:4323' : (import.meta.env.PUBLIC_COMMENTS_API ?? '')) +
  '/api/comments';

type Comment = { id: string; name: string; body: string; at: string; pinned?: boolean };

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

export default function Comments({ slug }: { slug: string }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API}?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((d) => alive && setComments(d.comments ?? []))
      .catch(() => alive && setComments([]));
    return () => {
      alive = false;
    };
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending || body.trim().length < 2) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug,
          name,
          body,
          honeypot: honeypot.current?.value ?? '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ kind: 'error', text: data.error ?? '보내지 못했습니다. 잠시 후 다시 시도해주세요.' });
      } else {
        setBody('');
        setNotice({ kind: 'ok', text: '고맙습니다. 확인한 뒤에 올라갑니다.' });
      }
    } catch {
      setNotice({ kind: 'error', text: '보내지 못했습니다. 연결을 확인해주세요.' });
    } finally {
      setSending(false);
    }
  }

  const over = body.length > LIMITS.body;

  return (
    <section className="mt-14 pt-8 border-t border-rule" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="font-serif text-lg font-bold mb-5">
        댓글
        {comments && comments.length > 0 && (
          <span className="ml-1.5 text-sm font-normal text-ink-soft">{comments.length}</span>
        )}
      </h2>

      {comments === null ? (
        <p className="text-sm text-ink-faint">불러오는 중…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-ink-faint">아직 댓글이 없습니다. 첫 댓글을 남겨보세요.</p>
      ) : (
        <ul className="space-y-5">
          {comments.map((c) => (
            <li
              key={c.id}
              className={
                c.pinned
                  ? 'text-[0.95rem] border-l-2 border-accent pl-3 -ml-px'
                  : 'text-[0.95rem]'
              }
            >
              <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                <span className="font-bold">{c.name}</span>
                {c.pinned && (
                  <span className="text-[0.65rem] font-bold text-accent border border-accent rounded-full px-1.5 py-px">
                    고정
                  </span>
                )}
                <time className="text-xs text-ink-faint" dateTime={c.at}>
                  {formatWhen(c.at)}
                </time>
              </div>
              <p className="text-ink-soft leading-relaxed whitespace-pre-wrap break-words">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LIMITS.name}
          placeholder="이름 (비워두면 익명)"
          aria-label="이름"
          className="w-full sm:w-56 border border-rule rounded bg-paper-raised px-3 py-2 text-sm
                     focus:outline-none focus:border-accent"
        />

        {/* 봇이 채우는 칸. 사람 눈에는 보이지 않습니다. */}
        <input
          ref={honeypot}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] w-px h-px opacity-0"
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="남기고 싶은 말을 적어주세요."
          aria-label="댓글 내용"
          className="w-full border border-rule rounded bg-paper-raised px-3 py-2 text-sm leading-relaxed
                     resize-y focus:outline-none focus:border-accent"
        />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-ink-faint">
            로그인 없이 쓸 수 있습니다. 확인한 뒤에 올라갑니다.
          </p>
          <div className="flex items-center gap-3">
            <span className={`text-xs tabular-nums ${over ? 'text-accent font-bold' : 'text-ink-faint'}`}>
              {body.length} / {LIMITS.body}
            </span>
            <button
              type="submit"
              disabled={sending || over || body.trim().length < 2}
              className="rounded bg-accent px-4 py-2 text-sm font-bold text-paper
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? '보내는 중…' : '댓글 쓰기'}
            </button>
          </div>
        </div>

        {notice && (
          <p
            role="status"
            className={`text-sm ${notice.kind === 'ok' ? 'text-ink-soft' : 'text-accent font-bold'}`}
          >
            {notice.text}
          </p>
        )}
      </form>
    </section>
  );
}
