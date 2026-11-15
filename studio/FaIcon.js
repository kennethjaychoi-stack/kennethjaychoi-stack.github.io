import { Node, mergeAttributes } from '@tiptap/core';

/**
 * 본문에 Font Awesome 아이콘을 박아 넣는 노드.
 *
 * 이모지 대신 쓰는 용도입니다. 아이콘의 SVG 를 글 안에 그대로 저장하므로
 * 사이트에서는 추가 JS 나 외부 요청 없이 바로 그려집니다.
 */
export const FaIcon = Node.create({
  name: 'faIcon',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      // name 과 body 는 노드 상태로만 쓰고 DOM 속성으로는 내보내지 않는다.
      // (그대로 두면 svg 에 name="..." body="&lt;path...&gt;" 가 중복으로 찍힌다)
      name: { default: null, renderHTML: () => ({}) },
      body: { default: null, renderHTML: () => ({}) },
      viewBox: { default: '0 0 512 512', renderHTML: () => ({}) },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'svg[data-fa-icon]',
        getAttrs: (el) => ({
          name: el.getAttribute('data-fa-icon'),
          body: el.innerHTML,
          viewBox: el.getAttribute('viewBox') ?? '0 0 512 512',
        }),
      },
    ];
  },

  /**
   * ProseMirror 의 toDOM 은 실제 DOM 노드를 받아주므로,
   * innerHTML 로 SVG 본문을 넣은 엘리먼트를 직접 만들어 반환한다.
   * (DOMOutputSpec 배열로는 raw SVG 를 표현할 수 없다)
   */
  renderHTML({ node, HTMLAttributes }) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const attrs = mergeAttributes(HTMLAttributes, {
      class: 'fa-inline',
      viewBox: node.attrs.viewBox,
      'data-fa-icon': node.attrs.name,
      'aria-hidden': 'true',
      focusable: 'false',
      xmlns: 'http://www.w3.org/2000/svg',
    });
    for (const [k, v] of Object.entries(attrs)) {
      if (v != null) el.setAttribute(k, String(v));
    }
    el.innerHTML = node.attrs.body ?? '';
    return el;
  },

  addCommands() {
    return {
      insertFaIcon:
        (icon) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { name: icon.name, body: icon.body, viewBox: icon.viewBox },
          }),
    };
  },
});
