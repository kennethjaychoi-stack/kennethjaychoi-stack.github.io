import { useEffect, useState } from 'react';

/**
 * 좋아요.
 *
 * 로그인이 없으므로 "이미 눌렀는지"는 이 브라우저에만 기억해 둡니다.
 * 기기를 바꾸면 다시 누를 수 있습니다 — 정확한 집계보다 가벼움을 택했습니다.
 */

const API =
  (import.meta.env.DEV ? 'http://127.0.0.1:4323' : (import.meta.env.PUBLIC_COMMENTS_API ?? '')) +
  '/api/likes';
const KEY = (slug: string) => `liked:${slug}`;

/** 사생활 보호 모드 등에서 저장소 접근이 막힐 수 있어 전부 감싼다. */
function readLiked(slug: string) {
  try {
    return localStorage.getItem(KEY(slug)) === '1';
  } catch {
    return false;
  }
}

function writeLiked(slug: string, liked: boolean) {
  try {
    if (liked) localStorage.setItem(KEY(slug), '1');
    else localStorage.removeItem(KEY(slug));
  } catch {
    /* 기억하지 못해도 동작에는 지장이 없다 */
  }
}

export default function Likes({ slug }: { slug: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLiked(readLiked(slug));
    fetch(`${API}?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : { likes: 0 }))
      .then((d) => alive && setCount(Number(d.likes ?? 0)))
      .catch(() => alive && setCount(0));
    return () => {
      alive = false;
    };
  }, [slug]);

  async function toggle() {
    if (busy || count === null) return;
    const next = !liked;

    // 먼저 화면을 바꾸고, 실패하면 되돌린다
    setBusy(true);
    setLiked(next);
    setCount((c) => Math.max(0, (c ?? 0) + (next ? 1 : -1)));
    writeLiked(slug, next);

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, liked: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'failed');
      if (typeof data.likes === 'number') setCount(data.likes);
    } catch {
      setLiked(!next);
      setCount((c) => Math.max(0, (c ?? 0) + (next ? -1 : 1)));
      writeLiked(slug, !next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-12 flex justify-center">
      <button
        type="button"
        onClick={toggle}
        disabled={busy || count === null}
        aria-pressed={liked}
        aria-label={liked ? '좋아요 취소' : '좋아요'}
        className={`group flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm
                    transition-colors disabled:opacity-50
                    ${
                      liked
                        ? 'border-accent bg-accent-soft text-accent font-bold'
                        : 'border-rule text-ink-soft hover:border-accent hover:text-accent'
                    }`}
      >
        <svg
          viewBox="0 0 512 512"
          aria-hidden="true"
          className="w-4 h-4"
          fill={liked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={liked ? 0 : 36}
        >
          <path d="M47.6 300.4L228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z" />
        </svg>
        <span>좋아요</span>
        {count !== null && count > 0 && <span className="tabular-nums">{count}</span>}
      </button>
    </div>
  );
}
