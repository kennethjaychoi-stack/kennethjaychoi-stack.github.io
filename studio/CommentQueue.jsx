import { useCallback, useEffect, useState } from 'react';

/**
 * 댓글 검토.
 *
 * 위쪽은 아직 아무에게도 보이지 않는 댓글, 아래쪽은 이미 올라간 댓글입니다.
 * 올라간 댓글은 글 맨 위에 고정할 수 있습니다.
 */
export default function CommentQueue({ onCountChange }) {
  const [pending, setPending] = useState([]);
  const [published, setPublished] = useState([]);
  const [busy, setBusy] = useState(null);

  const refresh = useCallback(async () => {
    const [a, b] = await Promise.all([
      fetch('/api/comments/pending').then((x) => x.json()),
      fetch('/api/comments/published').then((x) => x.json()),
    ]);
    const list = a.comments ?? [];
    setPending(list);
    setPublished(b.comments ?? []);
    onCountChange?.(list.length);
  }, [onCountChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const act = async (c, action) => {
    if (action === 'delete' && !confirm('이 댓글을 지울까요?')) return;
    setBusy(c.id);
    const r = await fetch('/api/comments/moderate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: c.slug, id: c.id, action }),
    }).then((x) => x.json());
    setBusy(null);
    if (r.error) alert(r.error);
    refresh();
  };

  const meta = (c) => (
    <div className="meta">
      <strong>{c.name}</strong>
      <time>{String(c.at).slice(0, 10)}</time>
      <code>{c.slug}</code>
      {c.pinned && <span className="pin">고정됨</span>}
    </div>
  );

  return (
    <div className="queue">
      <h2>
        댓글 검토
        {pending.length > 0 && <span className="count">{pending.length}</span>}
      </h2>

      {pending.length === 0 ? (
        <p className="hint">
          검토할 댓글이 없습니다. 방문자가 댓글을 쓰면 여기에 모이고,{' '}
          <strong>올리기</strong>를 눌러야 공개 사이트에 보입니다.
        </p>
      ) : (
        <>
          <p className="hint">아직 아무에게도 보이지 않습니다.</p>
          <ul>
            {pending.map((c) => (
              <li key={c.id}>
                {meta(c)}
                <p className="body">{c.body}</p>
                <div className="actions">
                  <button type="button" className="primary" disabled={busy === c.id} onClick={() => act(c, 'approve')}>
                    올리기
                  </button>
                  <button type="button" className="danger" disabled={busy === c.id} onClick={() => act(c, 'delete')}>
                    지우기
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="second">
        올라간 댓글
        {published.length > 0 && <span className="count quiet">{published.length}</span>}
      </h2>

      {published.length === 0 ? (
        <p className="hint">아직 올린 댓글이 없습니다.</p>
      ) : (
        <>
          <p className="hint">고정한 댓글은 글 맨 위에 붙습니다.</p>
          <ul>
            {published.map((c) => (
              <li key={c.id} className={c.pinned ? 'pinned' : ''}>
                {meta(c)}
                <p className="body">{c.body}</p>
                <div className="actions">
                  <button
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => act(c, c.pinned ? 'unpin' : 'pin')}
                  >
                    {c.pinned ? '고정 풀기' : '고정하기'}
                  </button>
                  <button type="button" disabled={busy === c.id} onClick={() => act(c, 'unapprove')}>
                    내리기
                  </button>
                  <button type="button" className="danger" disabled={busy === c.id} onClick={() => act(c, 'delete')}>
                    지우기
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
