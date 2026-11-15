/**
 * 클라이언트 컴포넌트가 쓰는 타입.
 * astro:content 를 끌어오지 않도록 posts.ts 에서 분리해 둔다.
 */
export interface MapPin {
  slug: string;
  title: string;
  kind: '유산' | '전시';
  category: string;
  lat: number;
  lng: number;
  region: string;
  city?: string;
  heritageType?: string;
  era?: string;
  museum?: string;
  transit: boolean;
  parking: boolean;
  primary: 'transit' | 'car';
  fee?: string;
  cover?: string;
  ended: boolean;
}
