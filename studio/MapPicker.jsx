import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

/**
 * 지도에서 위치를 찍어 위도·경도를 넣는다.
 *
 * 숫자를 직접 타이핑하는 대신 지도를 눌러 정하고, 이름으로 찾을 수도 있다.
 * 여기서 정한 좌표가 공개 사이트의 /map/ 에 핀으로 올라간다.
 */
export default function MapPicker({ coords, onChange, onPick }) {
  const el = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const lib = useRef(null);
  const [ready, setReady] = useState(false);

  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const lat = Array.isArray(coords) ? coords[0] : undefined;
  const lng = Array.isArray(coords) ? coords[1] : undefined;
  const hasPin = typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng);

  // Leaflet 은 모듈을 읽는 순간 window 를 건드리므로 동적으로 불러온다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import('leaflet');
      const L = mod.default ?? mod;
      if (cancelled || !el.current || map.current) return;
      lib.current = L;

      const m = L.map(el.current, { scrollWheelZoom: true, zoomControl: true }).setView([36.5, 127.8], 7);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(m);

      m.on('click', (e) => onChange([round(e.latlng.lat), round(e.latlng.lng)]));

      map.current = m;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
      setReady(false);
    };
  }, []);

  // 좌표가 바뀌면 핀을 옮긴다
  useEffect(() => {
    const L = lib.current;
    const m = map.current;
    if (!ready || !L || !m) return;

    if (!hasPin) {
      if (marker.current) {
        m.removeLayer(marker.current);
        marker.current = null;
      }
      return;
    }

    if (!marker.current) {
      marker.current = L.circleMarker([lat, lng], {
        radius: 9,
        weight: 3,
        color: '#fff',
        fillColor: '#9E3A2F',
        fillOpacity: 1,
      }).addTo(m);
    } else {
      marker.current.setLatLng([lat, lng]);
    }
    if (m.getZoom() < 12) m.setView([lat, lng], 15);
    else m.panTo([lat, lng]);
  }, [ready, hasPin, lat, lng]);

  const round = (n) => Math.round(n * 10000) / 10000;

  /** OpenStreetMap 이름 검색 (Nominatim). 개인용 저빈도 사용. */
  const search = async (e) => {
    e?.preventDefault();
    const term = q.trim();
    if (!term) return;
    setSearching(true);
    setError(null);
    setResults(null);
    try {
      const url =
        'https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=ko&countrycodes=kr&q=' +
        encodeURIComponent(term);
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`검색 서버 응답 ${r.status}`);
      const data = await r.json();
      setResults(data);
      if (data.length === 0) setError('결과가 없습니다. 지도를 직접 눌러 지정하셔도 됩니다.');
    } catch (err) {
      setError(`검색에 실패했습니다: ${err.message}. 지도를 직접 눌러 지정하세요.`);
    } finally {
      setSearching(false);
    }
  };

  // 좌표와 주소를 한 번에 넘긴다.
  // 따로 호출하면 같은 상태 스냅샷을 두 번 고쳐 뒤 호출이 앞을 덮어쓴다.
  const pick = (r) => {
    onPick({
      coords: [round(Number(r.lat)), round(Number(r.lon))],
      address: r.display_name ?? '',
    });
    setResults(null);
    setQ('');
  };

  return (
    <div className="mappick">
      <form className="mappick-search" onSubmit={search}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름으로 찾기 — 예: 수원화성, 국립중앙박물관"
        />
        <button type="submit" disabled={searching}>
          {searching ? '찾는 중…' : '찾기'}
        </button>
        {hasPin && (
          <button type="button" className="ghost" onClick={() => onChange(undefined)}>
            위치 지우기
          </button>
        )}
      </form>

      {results?.length > 0 && (
        <ul className="mappick-results">
          {results.map((r) => (
            <li key={r.place_id}>
              <button type="button" onClick={() => pick(r)}>
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mappick-msg">{error}</p>}

      <div ref={el} className="mappick-map" />

      <div className="mappick-foot">
        {hasPin ? (
          <span>
            <b>위도</b> {lat} &nbsp; <b>경도</b> {lng} — 공개 사이트 지도에 핀이 올라갑니다.
          </span>
        ) : (
          <span>지도를 눌러 위치를 지정하세요. 비워두면 지도에 표시되지 않습니다.</span>
        )}
      </div>
    </div>
  );
}
