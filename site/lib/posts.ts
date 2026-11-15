import { getCollection, type CollectionEntry } from 'astro:content';
import type { MapPin } from './types';

export type Post = CollectionEntry<'posts'>;
export type { MapPin };

/**
 * 전시 상태.
 * 상설전은 유산 답사와 같은 '장기 자산'으로 취급하고,
 * 특별전은 종료일이 지나면 자동으로 ended 가 된다.
 */
export type ExhibitionStatus = 'permanent' | 'ongoing' | 'upcoming' | 'ended';

/** 종료일은 그날 자정까지 유효하다고 본다. */
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function exhibitionStatus(post: Post, now: Date = new Date()): ExhibitionStatus | null {
  const ex = post.data.exhibition;
  if (!ex) return null;
  if (ex.permanent) return 'permanent';
  if (ex.end && endOfDay(ex.end) < now) return 'ended';
  if (ex.start && ex.start > now) return 'upcoming';
  return 'ongoing';
}

export function isEnded(post: Post, now: Date = new Date()) {
  return exhibitionStatus(post, now) === 'ended';
}

/** 남은 기간(일). 진행 중인 특별전에만 의미가 있다. */
export function daysLeft(post: Post, now: Date = new Date()): number | null {
  const ex = post.data.exhibition;
  if (!ex?.end || ex.permanent) return null;
  const diff = endOfDay(ex.end).getTime() - now.getTime();
  return diff < 0 ? null : Math.ceil(diff / 86_400_000);
}

/**
 * 목록 정렬.
 * 종료된 전시는 날짜와 무관하게 아래로 내린다 —
 * 끝난 전시를 상단에 두면 독자가 헛걸음을 하게 된다.
 */
export function sortForListing(posts: Post[], now: Date = new Date()): Post[] {
  return [...posts].sort((a, b) => {
    const ae = isEnded(a, now) ? 1 : 0;
    const be = isEnded(b, now) ? 1 : 0;
    if (ae !== be) return ae - be;
    return b.data.date.getTime() - a.data.date.getTime();
  });
}

/** 발행된 글. 초고는 개발 중에만 보인다. */
export async function getPosts(): Promise<Post[]> {
  const all = await getCollection('posts', ({ data }) => import.meta.env.DEV || !data.draft);
  return sortForListing(all);
}

export async function getPostsByCategory(category: string) {
  return (await getPosts()).filter((p) => p.data.category === category);
}

/** 지도에 찍을 수 있는 글만. */
export async function getMappablePosts() {
  return (await getPosts()).filter((p) => p.data.location?.coords);
}

export function toPin(post: Post, now: Date = new Date()): MapPin | null {
  const coords = post.data.location?.coords;
  if (!coords) return null;
  const d = post.data;
  return {
    slug: post.id,
    title: d.title,
    kind: d.kind,
    category: d.category,
    lat: coords[0],
    lng: coords[1],
    region: d.location!.region.do,
    city: d.location!.region.city,
    heritageType: d.heritage?.[0]?.type,
    era: d.heritage?.[0]?.era,
    museum: d.exhibition?.museum,
    transit: d.access?.transit?.available ?? false,
    parking: d.access?.car?.parking ?? false,
    primary: d.access?.primary ?? 'transit',
    fee: d.access?.fee,
    cover: d.cover,
    ended: isEnded(post, now),
  };
}

export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(d);

export const formatShort = (d: Date) =>
  new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
