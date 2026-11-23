import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, afterRenderEffect, inject, input } from '@angular/core';
import { ICONS, type IconName } from './icons';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Ícono SVG decorativo (aria-hidden). Si el ícono es el único contenido de un botón,
 * pon `aria-label` en el botón, no aquí.
 */
@Component({
  selector: 'pos-icon',
  template: '',
  host: {
    'aria-hidden': 'true',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
  },
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      color: inherit;
    }
  `,
})
export class PosIcon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly strokeWidth = input(1.75);

  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);

  constructor() {
    afterRenderEffect({
      write: () => {
        const svg = this.document.createElementNS(SVG_NS, 'svg');
        const attrs: Record<string, string> = {
          viewBox: '0 0 24 24',
          width: '100%',
          height: '100%',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': String(this.strokeWidth()),
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          focusable: 'false',
        };
        for (const [key, value] of Object.entries(attrs)) svg.setAttribute(key, value);

        for (const [tag, nodeAttrs] of ICONS[this.name()]) {
          const child = this.document.createElementNS(SVG_NS, tag);
          for (const [key, value] of Object.entries(nodeAttrs)) {
            if (value !== undefined && key !== 'key') child.setAttribute(key, String(value));
          }
          svg.appendChild(child);
        }
        this.host.replaceChildren(svg);
      },
    });
  }
}
