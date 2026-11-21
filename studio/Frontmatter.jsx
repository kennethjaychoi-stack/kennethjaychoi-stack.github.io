import { createContext, useContext, useMemo } from 'react';
import MapPicker from './MapPicker.jsx';

const CATEGORIES = ['답사기', '전시', '알아두기', '사진'];
const KINDS = ['유산', '전시'];
const HERITAGE_TYPES = [
  '국보',
  '보물',
  '사적',
  '명승',
  '천연기념물',
  '국가민속문화유산',
  '국가등록문화유산',
  '기타',
];
const ERAS = ['선사', '삼국', '통일신라', '발해', '고려', '조선', '대한제국', '근대', '기타'];
const REGIONS = [
  '서울', '경기', '인천', '강원', '충북', '충남', '대전', '세종',
  '전북', '전남', '광주', '경북', '경남', '대구', '부산', '울산', '제주',
];

/** 중첩 경로에 값을 넣은 새 객체를 돌려준다. */
export function setPath(obj, path, value) {
  const keys = path.split('.');
  const next = structuredClone(obj ?? {});
  let cur = next;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (typeof cur[k] !== 'object' || cur[k] === null) {
      // 다음 키가 숫자면 배열을 만든다 (coords.0 / coords.1)
      cur[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    }
    cur = cur[k];
  }
  cur[keys.at(-1)] = value;
  return next;
}

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/**
 * 입력 칸들이 쓰는 공용 값.
 *
 * 이 컴포넌트들은 반드시 모듈 바깥에 있어야 합니다.
 * Frontmatter 안에 두면 글자를 한 자 칠 때마다 새 컴포넌트로 취급되어
 * React 가 input 을 통째로 다시 만들고, 그래서 포커스가 풀립니다.
 */
const FieldCtx = createContext({ fm: {}, g: () => '', set: () => () => {} });
const useField = () => useContext(FieldCtx);

function Text({ path, label, placeholder, wide }) {
  const { g, set } = useField();
  return (
    <label className={wide ? 'field wide' : 'field'}>
      <span>{label}</span>
      <input value={g(path)} placeholder={placeholder} onChange={(e) => set(path)(e.target.value)} />
    </label>
  );
}

function Num({ path, label, placeholder }) {
  const { g, set } = useField();
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={g(path)}
        placeholder={placeholder}
        onChange={(e) => set(path)(e.target.value === '' ? '' : Number(e.target.value))}
      />
    </label>
  );
}

function Select({ path, label, options, empty = '선택' }) {
  const { g, set } = useField();
  return (
    <label className="field">
      <span>{label}</span>
      <select value={g(path)} onChange={(e) => set(path)(e.target.value)}>
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({ path, label }) {
  const { fm, set } = useField();
  return (
    <label className="field check">
      <input type="checkbox" checked={Boolean(getPath(fm, path))} onChange={(e) => set(path)(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Date_({ path, label }) {
  const { g, set } = useField();
  return (
    <label className="field">
      <span>{label}</span>
      <input type="date" value={String(g(path)).slice(0, 10)} onChange={(e) => set(path)(e.target.value)} />
    </label>
  );
}

export default function Frontmatter({ value, onChange, slug, onSlugChange, slugLocked }) {
  const fm = value ?? {};
  const set = (path) => (v) => onChange(setPath(fm, path, v));
  const g = (path) => getPath(fm, path) ?? '';

  // 유산 목록. 비어 있으면 한 칸은 보여준다.
  const heritage = Array.isArray(fm.heritage) && fm.heritage.length ? fm.heritage : [{}];
  const addHeritage = () => onChange({ ...fm, heritage: [...heritage, {}] });
  const removeHeritage = (i) => {
    const next = heritage.filter((_, n) => n !== i);
    onChange({ ...fm, heritage: next.length ? next : [{}] });
  };

  // 전시 목록. 상설전과 특별전을 같이 보는 일이 많아 유산과 같은 꼴로 둔다.
  const shows = Array.isArray(fm.exhibition) && fm.exhibition.length ? fm.exhibition : [{}];
  const addShow = () => onChange({ ...fm, exhibition: [...shows, {}] });
  const removeShow = (i) => {
    const next = shows.filter((_, n) => n !== i);
    onChange({ ...fm, exhibition: next.length ? next : [{}] });
  };

  const ctx = useMemo(() => ({ fm, g, set }), [fm]);

  const isExhibition = fm.kind === '전시';

  return (
    <FieldCtx.Provider value={ctx}>
    <div className="fm">
      <section>
        <h3>기본</h3>
        <div className="grid">
          <label className="field">
            <span>
              파일 이름 (slug) <em>· 주소가 됩니다</em>
            </span>
            <input
              value={slug}
              disabled={slugLocked}
              placeholder="수원화성-답사"
              onChange={(e) => onSlugChange(e.target.value)}
            />
          </label>
          <Select path="kind" label="종류" options={KINDS} />
          <Select path="category" label="카테고리" options={CATEGORIES} />
          <Date_ path="date" label="작성일" />
          <Date_ path="updated" label="수정일 (선택)" />
          <Check path="draft" label="초고 (사이트에 공개 안 함)" />
        </div>
        <div className="grid">
          <Text path="description" label="요약 (검색 결과에 보입니다)" wide />
          <label className="field wide">
            <span>태그 · 쉼표로 구분</span>
            <input
              value={Array.isArray(fm.tags) ? fm.tags.join(', ') : ''}
              placeholder="조선, 성곽, 경기"
              onChange={(e) =>
                onChange(
                  setPath(
                    fm,
                    'tags',
                    e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  ),
                )
              }
            />
          </label>
          <Text path="cover" label="대표 사진 경로" wide placeholder="/images/posts/수원화성-답사/01-화서문.webp" />
          <Text path="coverAlt" label="대표 사진 설명 (대체 텍스트)" wide />
        </div>
      </section>

      {/*
        * 전시 글에도 같은 칸을 쓴다 — 전시에 나온 국보·보물이 곧 유산이다.
        * 부르는 이름만 '전시 유물'로 바꾼다.
        */}
      <section>
        <h3>
          {isExhibition ? '전시 유물' : '국가유산'}
          <small>
            {isExhibition
              ? '· 전시에서 본 국보·보물을 더하세요'
              : '· 한 답사에서 여러 곳을 봤다면 모두 더하세요'}
          </small>
        </h3>

        {heritage.map((h, i) => (
          <div className="repeat" key={i}>
            <div className="repeat-head">
              <span>
                {i === 0 ? (isExhibition ? '대표 유물' : '대표 유산') : `${i + 1}번째`}
              </span>
              <button type="button" className="link" onClick={() => removeHeritage(i)}>
                빼기
              </button>
            </div>
            <div className="grid">
              <Text
                path={`heritage.${i}.name`}
                label={isExhibition ? '유물 이름' : '유산 이름'}
                placeholder={isExhibition ? '금동미륵보살반가사유상' : '수원 화성'}
              />
              <Select path={`heritage.${i}.type`} label="종목" options={HERITAGE_TYPES} />
              <Select path={`heritage.${i}.era`} label="시대" options={ERAS} />
              <Check path={`heritage.${i}.unesco`} label="유네스코 세계유산" />
            </div>
          </div>
        ))}

        <button type="button" className="add" onClick={addHeritage}>
          {isExhibition ? '+ 유물 더하기' : '+ 유산 더하기'}
        </button>

        <p className="note">
          종목·명칭은 국가유산청 <strong>국가유산포털</strong>의 공식 표기를 확인해 넣으세요.
          {isExhibition
            ? ' 여기 적은 유물은 종목·시대 색인에 함께 잡힙니다. 전시에 유물이 없으면 비워 두세요.'
            : ' 첫 번째 유산이 대표가 되어 지도와 색인의 기준이 됩니다.'}
        </p>
        <p className="note">
          <strong>지정번호(국보 제○호)는 적지 않습니다.</strong> 2021년에 폐지된 표기입니다.
        </p>
      </section>

      {isExhibition && (
        <section>
          <h3>
            전시
            <small>· 한 번에 상설전과 특별전을 같이 봤다면 모두 더하세요</small>
          </h3>

          {shows.map((e, i) => (
            <div className="repeat" key={i}>
              <div className="repeat-head">
                <span>{i === 0 ? '대표 전시' : `${i + 1}번째`}</span>
                <button type="button" className="link" onClick={() => removeShow(i)}>
                  빼기
                </button>
              </div>
              <div className="grid">
                <Text path={`exhibition.${i}.museum`} label="박물관" placeholder="국립중앙박물관" />
                <Text
                  path={`exhibition.${i}.name`}
                  label="전시 이름"
                  placeholder="신라의 금속 — 빛나는 기술"
                />
                <Check path={`exhibition.${i}.permanent`} label="상설전 (기간 없음)" />
                <Date_ path={`exhibition.${i}.start`} label="시작일" />
                <Date_ path={`exhibition.${i}.end`} label="종료일" />
                <Text
                  path={`exhibition.${i}.photo`}
                  label="촬영 규정"
                  wide
                  placeholder="플래시·삼각대 금지"
                />
              </div>
            </div>
          ))}

          <button type="button" className="add" onClick={addShow}>
            + 전시 더하기
          </button>

          <p className="note">
            <strong>전시 이름</strong>은 특별전에만 적으면 됩니다 — 상설전은 대개 이름이 따로 없습니다.
            특별전은 <strong>종료일을 꼭 넣으세요.</strong> 기간이 지나면 글 맨 위에 종료 안내가 자동으로
            붙고 목록에서 아래로 내려갑니다. 상설전과 같이 적었다면 특별전이 끝나도 글은 살아 있습니다 —
            <strong>모두 끝났을 때만</strong> 종료로 봅니다.
          </p>
        </section>
      )}

      <section>
        <h3>위치</h3>
        <div className="grid">
          <Select path="location.region.do" label="시·도" options={REGIONS} />
          <Text path="location.region.city" label="시·군·구" placeholder="수원" />
          <Text path="location.address" label="주소" wide placeholder="경기 수원시 팔달구 정조로 825" />
        </div>

        <MapPicker
          coords={getPath(fm, 'location.coords')}
          onChange={(c) => onChange(setPath(fm, 'location.coords', c))}
          onPick={({ coords, address }) => {
            let next = setPath(fm, 'location.coords', coords);
            // 주소가 비어 있을 때만 채운다 — 직접 적어둔 주소를 덮지 않는다
            if (address && !getPath(fm, 'location.address')) {
              next = setPath(next, 'location.address', address);
            }
            onChange(next);
          }}
        />
      </section>

      <section>
        <h3>가는 방법 · 관람 정보</h3>
        <div className="grid">
          <Select path="access.primary" label="권장 수단" options={['transit', 'car']} empty="transit (지하철)" />
          <Text path="access.fee" label="입장료" placeholder="무료" />
          <Text path="access.hours" label="운영시간" placeholder="09:00–18:00" />
          <Text path="access.closed" label="휴관" placeholder="연중무휴" />
          <Check path="access.reservation" label="예약 필요" />
          <Date_ path="access.asOf" label="정보 기준일" />
        </div>

        <h4>지하철</h4>
        <div className="grid">
          <Check path="access.transit.available" label="지하철로 갈 수 있음" />
          <Text path="access.transit.nearest" label="가까운 역" placeholder="수원역 (1호선·수인분당선)" />
          <Num path="access.transit.walk" label="도보 (분)" placeholder="15" />
          <Text path="access.transit.note" label="메모" wide />
        </div>

        <h4>자동차</h4>
        <div className="grid">
          <Check path="access.car.parking" label="주차 가능" />
          <label className="field wide">
            <span>주차장 · 쉼표로 구분</span>
            <input
              value={Array.isArray(getPath(fm, 'access.car.lots')) ? getPath(fm, 'access.car.lots').join(', ') : ''}
              placeholder="화성행궁 주차장, 연무대 주차장"
              onChange={(e) =>
                onChange(
                  setPath(
                    fm,
                    'access.car.lots',
                    e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  ),
                )
              }
            />
          </label>
          <Text path="access.car.fee" label="주차 요금" placeholder="10분 300원" />
          <Text path="access.car.note" label="메모" wide />
        </div>

        <p className="note">
          <strong>기준일</strong>을 넣어두면 글 아래에 “○○ 기준입니다”가 자동으로 붙습니다. 요금이나 시간만
          바뀔 때는 이 날짜만 갱신하면 됩니다.
        </p>
      </section>
    </div>
    </FieldCtx.Provider>
  );
}
