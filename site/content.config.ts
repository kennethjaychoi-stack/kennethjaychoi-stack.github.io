import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { ERAS, HERITAGE_TYPES } from './consts';

/**
 * 접근 정보.
 * 박물관·전시는 주로 지하철, 원거리 답사는 자동차를 쓰기 때문에
 * 양쪽을 모두 기록하고 primary 로 권장 수단을 표시한다.
 */
const accessSchema = z
  .object({
    primary: z.enum(['transit', 'car']).default('transit'),
    transit: z
      .object({
        available: z.boolean().default(true),
        nearest: z.string().optional(),
        walk: z.number().optional(),
        note: z.string().optional(),
      })
      .optional(),
    car: z
      .object({
        parking: z.boolean().default(true),
        lots: z.array(z.string()).default([]),
        fee: z.string().optional(),
        note: z.string().optional(),
      })
      .optional(),
    fee: z.string().optional(),
    hours: z.string().optional(),
    closed: z.string().optional(),
    reservation: z.boolean().default(false),
    /**
     * 변동 정보 기준일.
     * 입장료·운영시간만 바뀔 때 글 전체를 '수정됨'으로 만들지 않고
     * 이 날짜만 갱신한다.
     */
    asOf: z.coerce.date().optional(),
  })
  .optional();

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/posts' }),
  schema: z.object({
    // 최상위 구분. 유산은 장기 자산, 전시는 기간이 있는 단기 유입.
    kind: z.enum(['유산', '전시']),
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    category: z.enum(['답사기', '전시', '알아두기', '사진']),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    cover: z.string().optional(),
    coverAlt: z.string().optional(),

    /**
     * 답사에서 본 국가유산. 한 번에 여러 곳을 보는 일이 많아 목록으로 둔다.
     * 첫 번째가 대표 유산이며 제목·지도·색인의 기준이 된다.
     *
     * 전시 글도 이 칸을 쓴다 — 전시에 나온 국보·보물이 곧 유산이기 때문이다.
     * 글에서는 '전시 유물'이라 부르지만 종목·시대 색인에는 똑같이 잡힌다.
     *
     * 지정번호(국보 제○호)는 받지 않는다 — 2021년에 폐지된 표기다.
     */
    heritage: z
      .array(
        z.object({
          name: z.string(),
          type: z.enum(HERITAGE_TYPES).optional(),
          era: z.enum(ERAS).optional(),
          unesco: z.boolean().default(false),
        }),
      )
      .optional(),

    /**
     * 본 전시. 한 번 가서 상설전과 특별전을 같이 보는 일이 많아 목록으로 둔다.
     * 첫 번째가 대표 전시이며 제목·색인의 기준이 된다.
     *
     * 예전에 쓰던 '전시 하나' 꼴({ museum: ... })도 그대로 읽는다 —
     * 이미 쓴 글을 고치게 만들 이유가 없다.
     */
    exhibition: z.preprocess(
      (v) => (v == null || Array.isArray(v) ? v : [v]),
      z
        .array(
          z.object({
            museum: z.string(),
            /** 특별전 이름. 상설전은 대개 이름이 따로 없으므로 비워 둔다. */
            name: z.string().optional(),
            permanent: z.boolean().default(false),
            start: z.coerce.date().optional(),
            // 특별전은 종료일이 필수. 지나면 자동으로 '종료' 처리된다.
            end: z.coerce.date().optional(),
            photo: z.string().optional(),
          }),
        )
        .optional(),
    ),

    location: z
      .object({
        region: z.object({ do: z.string(), city: z.string().optional() }),
        // 전 글 공통. /map/ 의 원천 데이터.
        coords: z.tuple([z.number(), z.number()]).optional(),
        address: z.string().optional(),
      })
      .optional(),

    access: accessSchema,
  }),
});

export const collections = { posts };
