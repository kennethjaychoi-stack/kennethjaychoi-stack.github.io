/**
 * 사이트 전역 설정.
 * 도메인을 구입하면 SITE.url 만 바꾸면 사이트맵·RSS·OG 태그가 모두 따라갑니다.
 */
export const SITE = {
  title: '걷고 보다',
  tagline: '전국의 국가유산과 박물관 전시를 찾아다닌 기록',
  description:
    '전국의 국가유산 답사기와 박물관 전시 관람기. 지하철과 자동차로 가는 방법, 입장료와 관람 시간까지 정리합니다.',
  url: 'http://localhost:4321',
  locale: 'ko-KR',
  author: 'Kenneth',
} as const;

export const CATEGORIES = [
  { slug: 'dapsa', name: '답사기', icon: 'fa6-solid:landmark', description: '국가유산 답사 기록' },
  { slug: 'exhibition', name: '전시', icon: 'fa6-solid:building-columns', description: '박물관 전시와 상설관' },
  { slug: 'notes', name: '알아두기', icon: 'fa6-solid:circle-info', description: '입장료·예약·용어·준비물' },
  { slug: 'photos', name: '사진', icon: 'fa6-solid:camera', description: '답사 사진 아카이브' },
] as const;

export type CategoryName = (typeof CATEGORIES)[number]['name'];

export const categoryBySlug = (slug: string) => CATEGORIES.find((c) => c.slug === slug);
export const categoryByName = (name: string) => CATEGORIES.find((c) => c.name === name);

/** 국가유산 종목. 2024년 개편된 국가유산 체계 기준. */
export const HERITAGE_TYPES = [
  '국보',
  '보물',
  '사적',
  '명승',
  '천연기념물',
  '국가민속문화유산',
  '국가등록문화유산',
  '기타',
] as const;

export const ERAS = ['선사', '삼국', '통일신라', '발해', '고려', '조선', '대한제국', '근대', '기타'] as const;

/** 시·도. 지도와 색인 필터에 사용. */
export const REGIONS = [
  '서울',
  '경기',
  '인천',
  '강원',
  '충북',
  '충남',
  '대전',
  '세종',
  '전북',
  '전남',
  '광주',
  '경북',
  '경남',
  '대구',
  '부산',
  '울산',
  '제주',
] as const;
