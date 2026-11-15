# 🔒 studio/ — 편집 영역 (나만 씀)

**글을 쓰고 고치는 편집기입니다. 인터넷에 올라가지 않습니다.**

```bash
npm run studio   # http://127.0.0.1:4322
```

```
studio/
├── App.jsx           글 목록 + 저장·삭제 흐름
├── Editor.jsx        Tiptap 편집기와 툴바 (글꼴·크기·색상·표·사진·아이콘)
├── Frontmatter.jsx   종류·유산·전시·위치·교통 입력 폼
├── IconPicker.jsx    Font Awesome 아이콘 고르기 (이모지 대체)
├── MapPicker.jsx     지도에서 위치 찍기 (이름 검색 + 클릭)
├── FaIcon.js         본문에 아이콘을 SVG 로 박는 Tiptap 노드
├── Figure.js         사진 + 설명을 한 덩어리로 다루는 노드
├── server.mjs        파일 읽기·쓰기, 사진 변환, 아이콘 목록 API
└── vite.config.mjs   127.0.0.1 에만 열리는 로컬 서버
```

## 왜 로그인이 없나

이 편집기는 Astro 와 **완전히 다른 앱**입니다.
`npm run build` 는 `astro.config.ts` 만 보고, 그 설정은 `site/` 만 읽습니다.
그래서 이 폴더의 코드는 빌드 결과물에 들어갈 방법이 없고,
공개된 사이트에는 편집 기능이 **존재하지 않습니다**. 지킬 문이 없으니 자물쇠도 필요 없습니다.

서버도 `127.0.0.1` 에만 묶여 있어 같은 와이파이의 다른 기기에서도 열리지 않습니다.

확인하려면: `npm run verify`

## 하는 일

- `content/posts/<slug>.md` 를 읽고 씁니다 (프론트매터 + 본문 HTML)
- 사진을 `public/images/posts/<slug>/` 에 **가로 1600px WebP** 로 저장하고
  **EXIF(촬영 위치 GPS 포함)를 제거**합니다
- 글을 지우면 `content/.trash/` 로 옮깁니다 — 영구 삭제하지 않습니다
- 위치는 지도에서 찍습니다. 이름 검색은 OpenStreetMap Nominatim 을 쓰며,
  개인용 저빈도 사용 범위입니다. 검색이 안 되면 지도를 직접 눌러 지정하면 됩니다.
