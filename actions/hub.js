// [ai_s_emblem:#high#logic ActionLab-Registry]
// Hub: 各デモJSは ActionLab.register(id, descriptor) で自己登録する。
// descriptor は { title, desc, controls, mount(canvas, side) -> cleanupFn } を持つ。
// canvas / side DOM はハブが用意し、mount に渡す。cleanupFn は切替時に必ず呼ぶ。
window.ActionLab = (function () {
  const demos = [];   // [{id, title, desc, controls, mount}]
  let current = null; // {id, cleanup}

  function register(id, descriptor) {
    if (demos.some(d => d.id === id)) {
      console.warn('[ActionLab] duplicate id ignored:', id);
      return;
    }
    demos.push({ id, ...descriptor });
  }

  function mountById(id) {
    const target = demos.find(d => d.id === id);
    if (!target) return;
    if (current && current.cleanup) {
      try { current.cleanup(); } catch (e) { console.error(e); }
    }
    const canvas = document.getElementById('stage-canvas');
    const side = document.getElementById('stage-side');
    side.innerHTML = '';
    document.getElementById('stage-title').textContent = target.title;
    document.getElementById('stage-desc').textContent = target.desc || '';
    document.getElementById('stage-controls').textContent = target.controls || '';
    document.getElementById('stage-status').textContent = '';
    document.querySelectorAll('#demo-nav button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.id === id);
    });
    canvas.focus();
    const cleanup = target.mount(canvas, side);
    current = { id, cleanup };
  }

  function boot() {
    const nav = document.getElementById('demo-nav');
    demos.forEach(d => {
      const btn = document.createElement('button');
      btn.textContent = d.title;
      btn.dataset.id = d.id;
      btn.addEventListener('click', () => mountById(d.id));
      nav.appendChild(btn);
    });
    document.getElementById('reset-btn').addEventListener('click', () => {
      if (current) mountById(current.id);
    });
    if (demos.length > 0) mountById(demos[0].id);
  }

  return { register, boot };
})();
// [/ai_s_emblem: ActionLab-Registry]
