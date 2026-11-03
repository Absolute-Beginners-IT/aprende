// jsdom lacks the browser APIs React Flow measures nodes with; these are the mocks its testing guide documents.
class ResizeObserverMock {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) { this.callback = callback; }
  // React Flow 12.12 also reads the content box of the pane, so the entry carries one.
  observe(target: Element) {
    const { offsetWidth: width, offsetHeight: height } = target as HTMLElement;
    this.callback([{ target, contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

class DOMMatrixReadOnlyMock {
  m22: number;
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([1-9.])\)/)?.[1];
    this.m22 = scale !== undefined ? +scale : 1;
  }
}

let mocked = false;

export function mockReactFlow() {
  if (mocked) return;
  mocked = true;
  Object.assign(globalThis, { ResizeObserver: ResizeObserverMock, DOMMatrixReadOnly: DOMMatrixReadOnlyMock });
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: { get() { return parseFloat((this as HTMLElement).style.height) || 1; } },
    offsetWidth: { get() { return parseFloat((this as HTMLElement).style.width) || 1; } },
  });
  (SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
}
