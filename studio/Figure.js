import { Node, mergeAttributes } from '@tiptap/core';

/**
 * 사진 + 설명(figcaption) 한 덩어리.
 *
 * 답사 글의 기본 단위가 '사진과 그 설명'이라서 img 를 그냥 두지 않고
 * figure 로 묶는다. width/height 를 함께 저장해 레이아웃이 밀리는 현상을 막는다.
 */
export const Figure = Node.create({
  name: 'figure',
  group: 'block',
  content: 'inline*',
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      width: { default: null },
      height: { default: null },
      /** 'bleed' 를 주면 본문 폭을 넘겨 넓게 보인다 */
      className: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure',
        contentElement: 'figcaption',
        getAttrs: (el) => {
          const img = el.querySelector('img');
          if (!img) return false;
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt') ?? '',
            width: img.getAttribute('width'),
            height: img.getAttribute('height'),
            className: img.getAttribute('class'),
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const { src, alt, width, height, className } = node.attrs;
    return [
      'figure',
      {},
      [
        'img',
        mergeAttributes(
          { src, alt, loading: 'lazy', decoding: 'async' },
          width ? { width } : {},
          height ? { height } : {},
          className ? { class: className } : {},
        ),
      ],
      ['figcaption', {}, 0],
    ];
  },

  addCommands() {
    return {
      insertFigure:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs,
              content: attrs.caption ? [{ type: 'text', text: attrs.caption }] : [],
            })
            .run(),

      toggleFigureBleed:
        () =>
        ({ state, chain }) => {
          const { $from } = state.selection;
          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            if (node.type.name === this.name) {
              return chain()
                .updateAttributes(this.name, { className: node.attrs.className === 'bleed' ? null : 'bleed' })
                .run();
            }
          }
          return false;
        },
    };
  },
});
