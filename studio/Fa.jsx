import { FA } from './fa-icons.js';

/**
 * 편집기 단추에 들어가는 아이콘.
 *
 *   <Fa name="link" /> 링크
 *
 * 아이콘은 뜻을 거드는 그림일 뿐이므로 화면 읽기 프로그램에게는 감춥니다.
 * 글자 없이 아이콘만 있는 단추에는 반드시 title 이나 aria-label 을 붙이세요.
 *
 * 쓸 수 있는 이름은 studio/fa-icons.js 에 있습니다.
 * 더 필요하면 scripts/fa-icons.mjs 에 이름을 적고 다시 돌리세요.
 */
export default function Fa({ name, className = '' }) {
  const icon = FA[name];

  // 이름을 잘못 적었을 때 화면이 깨지는 대신 조용히 빈 자리를 둔다.
  if (!icon) {
    if (import.meta.env.DEV) console.warn(`[Fa] 없는 아이콘: ${name}`);
    return null;
  }

  return (
    <svg
      className={`fa ${className}`.trim()}
      viewBox={icon.v}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: icon.d }}
    />
  );
}
