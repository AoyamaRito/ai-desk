// ============================================================
// Virtual Canvas — in-memory Canvas2D mock that records draw ops
// ============================================================
//
// 目的: ブラウザを起動せず Node 上で demo の render() を走らせ、
// 全描画コール(method 名 + 引数)を ops 配列として捕える。
//
// 出力は **opaque な PNG ピクセルでなく、構造化された draw operation log**。
// 公理 A0(展開された複雑性) と整合 — LLM は算術を直接読める。
//
// ai-desk v2 / Zero-Dep / ESM。
// ============================================================

// HTMLCanvasElement のインスタンスプロパティに相当
const STATE_PROPS = [
  'fillStyle', 'strokeStyle', 'lineWidth', 'font',
  'textAlign', 'textBaseline', 'globalAlpha',
  'lineCap', 'lineJoin', 'miterLimit', 'lineDashOffset',
  'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY',
  'globalCompositeOperation', 'imageSmoothingEnabled', 'direction',
  'filter',
];

const STATE_DEFAULTS = {
  fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1,
  font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
  globalAlpha: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10,
  lineDashOffset: 0, shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)',
  shadowOffsetX: 0, shadowOffsetY: 0,
  globalCompositeOperation: 'source-over', imageSmoothingEnabled: true,
  direction: 'inherit', filter: 'none',
};

// 描画/状態系メソッド(返り値なし、引数だけ記録)
const VOID_METHODS = [
  // path
  'beginPath', 'closePath', 'moveTo', 'lineTo',
  'bezierCurveTo', 'quadraticCurveTo',
  'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
  // draw
  'fill', 'stroke', 'clip',
  'fillRect', 'strokeRect', 'clearRect',
  'fillText', 'strokeText',
  'drawImage',
  // transform
  'save', 'restore',
  'setTransform', 'transform', 'translate', 'rotate', 'scale', 'resetTransform',
  // dash
  'setLineDash',
];

export class VirtualCanvasContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.ops = [];
    // state バッキング
    this._state = { ...STATE_DEFAULTS };
    this._stateStack = [];

    // STATE_PROPS を getter/setter で記録
    for (const prop of STATE_PROPS) {
      Object.defineProperty(this, prop, {
        configurable: true, enumerable: true,
        get: () => this._state[prop],
        set: (v) => {
          this._state[prop] = v;
          this.ops.push({ op: 'set', prop, value: serializeValue(v) });
        },
      });
    }
  }
  // 戻り値が必要なメソッドは個別実装(measureText 等)
  measureText(text) {
    this.ops.push({ op: 'measureText', args: [text] });
    // 簡易見積: フォントサイズ × 文字数 × 0.55(ASCII想定)
    const sizeMatch = /(\d+(?:\.\d+)?)px/.exec(this._state.font || '');
    const size = sizeMatch ? Number(sizeMatch[1]) : 10;
    return {
      width: text.length * size * 0.55,
      actualBoundingBoxAscent: size * 0.8,
      actualBoundingBoxDescent: size * 0.2,
    };
  }
  getLineDash() { return []; }
  isPointInPath() { return false; }
  isPointInStroke() { return false; }
  // gradient/pattern: 簡易 stub(record + token を返す)
  createLinearGradient(x0, y0, x1, y1) {
    const id = 'lg_' + this.ops.length;
    this.ops.push({ op: 'createLinearGradient', args: [x0, y0, x1, y1], id });
    return makeGradientStub(id, this.ops);
  }
  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    const id = 'rg_' + this.ops.length;
    this.ops.push({ op: 'createRadialGradient', args: [x0, y0, r0, x1, y1, r1], id });
    return makeGradientStub(id, this.ops);
  }
  createPattern() {
    const id = 'pat_' + this.ops.length;
    this.ops.push({ op: 'createPattern', id });
    return id;
  }
  // 互換のため getImageData/putImageData は no-op + record
  getImageData(x, y, w, h) {
    this.ops.push({ op: 'getImageData', args: [x, y, w, h] });
    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  }
  putImageData() { this.ops.push({ op: 'putImageData' }); }
  createImageData(w, h) {
    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  }
}

function makeGradientStub(id, ops) {
  return {
    addColorStop(offset, color) {
      ops.push({ op: 'gradient.addColorStop', gradientId: id, args: [offset, color] });
    },
    __aiEyesGradientId: id,
  };
}

function serializeValue(v) {
  if (v == null) return v;
  if (typeof v === 'object' && v.__aiEyesGradientId) return { gradient: v.__aiEyesGradientId };
  return v;
}

// VOID_METHODS をプロトタイプに自動定義
for (const m of VOID_METHODS) {
  VirtualCanvasContext.prototype[m] = function (...args) {
    this.ops.push({ op: m, args });
  };
}

// save/restore は state stack も操作
const _save = VirtualCanvasContext.prototype.save;
VirtualCanvasContext.prototype.save = function () {
  this._stateStack.push({ ...this._state });
  _save.call(this);
};
const _restore = VirtualCanvasContext.prototype.restore;
VirtualCanvasContext.prototype.restore = function () {
  if (this._stateStack.length > 0) this._state = this._stateStack.pop();
  _restore.call(this);
};

// ============================================================
// VirtualCanvas — HTMLCanvasElement 互換 wrapper
// ============================================================
export class VirtualCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this._ctx = new VirtualCanvasContext(this);
  }
  getContext(type) {
    if (type !== '2d') return null;
    return this._ctx;
  }
  toDataURL() {
    // ピクセルを持たないので識別子だけ返す。
    // (PNG が本当に必要な時は ops を別 renderer に流す)
    return 'data:application/x-ai-eyes-virtual,no-rasterization';
  }
  // ブラウザで使われがちなプロパティの最小互換
  getBoundingClientRect() {
    return { x: 0, y: 0, left: 0, top: 0, right: this.width, bottom: this.height,
             width: this.width, height: this.height };
  }
}

export function createVirtualCanvas(width = 800, height = 600) {
  return new VirtualCanvas(width, height);
}

// ============================================================
// 補助: ops 配列を要約(diff / debug 用)
// ============================================================
export function summarizeOps(ops) {
  const counts = {};
  for (const o of ops) counts[o.op] = (counts[o.op] || 0) + 1;
  return { total: ops.length, byOp: counts };
}
