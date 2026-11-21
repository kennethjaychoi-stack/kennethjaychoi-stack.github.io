import { useEffect, useMemo, useRef, useState } from 'react';
import Fa from './Fa.jsx';

/** 답사·전시 글에서 자주 쓸 아이콘을 앞에 띄워둔다. */
const SUGGESTED = [
  'camera',
  'lightbulb',
  'triangle-exclamation',
  'circle-info',
  'circle-check',
  'circle-xmark',
  'location-dot',
  'train-subway',
  'car',
  'person-walking',
  'won-sign',
  'clock',
  'ticket',
  'landmark',
  'building-columns',
  'torii-gate',
  'mountain-sun',
  'tree',
  'book',
  'pen',
  'star',
  'heart',
  'quote-left',
  'arrow-right',
  'utensils',
  'mug-hot',
  'umbrella',
  'sun',
  'snowflake',
  'temperature-half',
];

export default function IconPicker({ onPick, onClose }) {
  const [icons, setIcons] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetch('/api/icons')
      .then((r) => r.json())
      .then((d) => (d.icons ? setIcons(d.icons) : setError(d.error ?? '아이콘을 불러오지 못했습니다.')))
      .catch((e) => setError(String(e)));
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const shown = useMemo(() => {
    if (!icons) return [];
    const term = q.trim().toLowerCase();
    if (!term) {
      const bySuggested = new Map(icons.map((i) => [i.name, i]));
      return SUGGESTED.map((n) => bySuggested.get(n)).filter(Boolean);
    }
    return icons.filter((i) => i.name.includes(term)).slice(0, 120);
  }, [icons, q]);

  return (
    <div className="picker-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="picker" role="dialog" aria-label="아이콘 선택">
        <div className="picker-head">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="아이콘 검색 (영문) — 예: camera, train, won"
          />
          <button type="button" onClick={onClose} aria-label="닫기">
            <Fa name="xmark" />
          </button>
        </div>

        {error && <p className="picker-msg err">{error}</p>}
        {!icons && !error && <p className="picker-msg">아이콘을 불러오는 중…</p>}

        {icons && (
          <>
            {!q.trim() && <p className="picker-hint">자주 쓰는 아이콘입니다. 검색하면 전체에서 찾습니다.</p>}
            <div className="picker-grid">
              {shown.map((icon) => (
                <button
                  key={icon.name}
                  type="button"
                  title={icon.name}
                  onClick={() => {
                    onPick(icon);
                    onClose();
                  }}
                >
                  <svg viewBox={icon.viewBox} dangerouslySetInnerHTML={{ __html: icon.body }} aria-hidden="true" />
                  <span>{icon.name}</span>
                </button>
              ))}
            </div>
            {shown.length === 0 && <p className="picker-msg">검색 결과가 없습니다.</p>}
          </>
        )}

        <p className="picker-foot">
          Font Awesome Free · 아이콘은 글 안에 SVG 로 저장되어 사이트에서 추가 요청 없이 그려집니다.
        </p>
      </div>
    </div>
  );
}
