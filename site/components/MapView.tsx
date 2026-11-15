import { useEffect, useMemo, useRef, useState } from 'react';
import type * as LeafletTypes from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapPin } from '../lib/types';

interface Props {
  pins: MapPin[];
  /** 글 상세의 단일 핀 지도 */
  single?: boolean;
  height?: number;
}

type FilterKey = 'kind' | 'heritageType' | 'era' | 'region' | 'access';
type L = typeof LeafletTypes;

const ACCENT = '#9E3A2F';
const MUSEUM = '#2F5E9E';
const FAINT = '#9A938C';

/** 기본 마커 이미지는 번들러에서 깨지므로 원형 마커를 쓴다. */
function markerFor(L: L, pin: MapPin) {
  const color = pin.ended ? FAINT : pin.kind === '전시' ? MUSEUM : ACCENT;
  return L.circleMarker([pin.lat, pin.lng], {
    radius: 7,
    weight: 2,
    color: '#fff',
    fillColor: color,
    fillOpacity: 1,
  });
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function popupHtml(pin: MapPin) {
  const meta = [pin.heritageType, pin.era, pin.museum, pin.region].filter(Boolean).map(escapeHtml).join(' · ');
  const img = pin.cover
    ? `<img src="${escapeHtml(pin.cover)}" alt="" style="width:100%;height:92px;object-fit:cover;border-radius:3px;margin-bottom:6px" loading="lazy">`
    : '';
  const ended = pin.ended ? '<span style="color:#9a938c">· 종료된 전시</span>' : '';
  return `<div style="width:190px;line-height:1.5">
    ${img}
    <a href="/posts/${encodeURIComponent(pin.slug)}/" style="font-weight:700;text-decoration:none;display:block">${escapeHtml(pin.title)}</a>
    <div style="font-size:11px;opacity:.7;margin-top:3px">${meta} ${ended}</div>
  </div>`;
}

export default function MapView({ pins, single = false, height = 420 }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletTypes.Map | null>(null);
  const layer = useRef<LeafletTypes.LayerGroup | null>(null);
  const lib = useRef<L | null>(null);
  const [ready, setReady] = useState(false);

  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    kind: '',
    heritageType: '',
    era: '',
    region: '',
    access: '',
  });

  const options = useMemo(() => {
    const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter(Boolean) as string[])].sort();
    return {
      kind: uniq(pins.map((p) => p.kind)),
      heritageType: uniq(pins.map((p) => p.heritageType)),
      era: uniq(pins.map((p) => p.era)),
      region: uniq(pins.map((p) => p.region)),
    };
  }, [pins]);

  const shown = useMemo(
    () =>
      pins.filter((p) => {
        if (filters.kind && p.kind !== filters.kind) return false;
        if (filters.heritageType && p.heritageType !== filters.heritageType) return false;
        if (filters.era && p.era !== filters.era) return false;
        if (filters.region && p.region !== filters.region) return false;
        if (filters.access === 'transit' && !p.transit) return false;
        if (filters.access === 'car' && !p.parking) return false;
        return true;
      }),
    [pins, filters],
  );

  // Leaflet 은 모듈 로드 시점에 window 를 참조하므로 반드시 동적으로 불러온다.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const mod = await import('leaflet');
      const L = (mod.default ?? mod) as L;
      if (cancelled || !el.current || map.current) return;

      lib.current = L;
      const m = L.map(el.current, {
        scrollWheelZoom: false,
        zoomControl: !single,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      layer.current = L.layerGroup().addTo(m);
      map.current = m;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
      setReady(false);
    };
  }, [single]);

  // 핀 갱신
  useEffect(() => {
    const L = lib.current;
    const m = map.current;
    const lg = layer.current;
    if (!ready || !L || !m || !lg) return;

    lg.clearLayers();

    if (shown.length === 0) {
      m.setView([36.5, 127.8], 7);
      return;
    }

    for (const pin of shown) markerFor(L, pin).bindPopup(popupHtml(pin)).addTo(lg);

    if (single && shown.length === 1) {
      m.setView([shown[0]!.lat, shown[0]!.lng], 15);
    } else {
      m.fitBounds(L.latLngBounds(shown.map((p) => [p.lat, p.lng] as [number, number])), {
        padding: [40, 40],
        maxZoom: 12,
      });
    }
  }, [shown, single, ready]);

  const reset = () => setFilters({ kind: '', heritageType: '', era: '', region: '', access: '' });
  const active = Object.values(filters).some(Boolean);

  const select = (key: FilterKey, label: string, opts: string[]) =>
    opts.length > 1 ? (
      <select
        key={key}
        aria-label={`${label} 필터`}
        value={filters[key]}
        onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
        className="border border-rule rounded bg-paper-raised text-ink px-2 py-1 text-xs"
      >
        <option value="">{label} 전체</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    ) : null;

  return (
    <div className="not-prose">
      {!single && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {select('kind', '종류', options.kind)}
          {select('heritageType', '종목', options.heritageType)}
          {select('era', '시대', options.era)}
          {select('region', '지역', options.region)}
          <select
            aria-label="접근 수단 필터"
            value={filters.access}
            onChange={(e) => setFilters((f) => ({ ...f, access: e.target.value }))}
            className="border border-rule rounded bg-paper-raised text-ink px-2 py-1 text-xs"
          >
            <option value="">접근 전체</option>
            <option value="transit">지하철로 갈 수 있는 곳</option>
            <option value="car">주차 가능한 곳</option>
          </select>
          {active && (
            <button type="button" onClick={reset} className="text-xs text-accent underline underline-offset-2 px-1">
              초기화
            </button>
          )}
          <span className="text-xs text-ink-faint ml-auto">
            {shown.length}곳 / 전체 {pins.length}곳
          </span>
        </div>
      )}

      <div
        ref={el}
        style={{ height }}
        className="w-full rounded border border-rule bg-paper-raised z-0"
        role="application"
        aria-label="답사한 곳 지도"
      />

      {!single && (
        <p className="mt-2 text-xs text-ink-faint">
          스크롤 확대는 페이지 스크롤과 겹쳐 꺼 두었습니다. +/− 버튼이나 두 손가락으로 확대하세요.
        </p>
      )}
    </div>
  );
}
