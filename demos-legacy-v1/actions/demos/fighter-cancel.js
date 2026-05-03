// [ai_s_emblem:#high#intent Fighter-Cancel-Demo]
// L1+L2+L4: 入力受け付け・RAFループ・canvas描画・サイドペイン更新。
// L3 (TRANSITIONS / resolveTransition / routesTo) は fighter-cancel.logic.js を参照する。
(function () {
  const FPS = 60;
  const FRAME_MS = 1000 / FPS;
  const L = window.FighterCancelLogic;
  const { MOVES, TRANSITIONS, resolveTransition, routesTo } = L;

  ActionLab.register('fighter-cancel', {
    title: 'Fighter Cancel Chain',
    desc: '制約畳み込みでキャンセル受付・先行入力・hit確認を宣言的に表現する。サイドペインに「現在状態に到達する全ルート」を逆引きで常時表示。',
    controls: 'A: ジャブ / B: 強 / C: 必殺 / G(押下): ガード / Space: 敵を近付ける（hit確認用）',
    mount(canvas, side) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const GROUND_Y = H - 60;

      const REAL = {
        action: 'IDLE',
        frame: 0,
        hit: false,
        playerX: 160,
        enemyX: 460,
        guardHeld: false,
        buffer: null,
        log: [],
      };
      const BUFFER_TTL = 6;

      // [ai_s_emblem:#mid#physical Input-Layer]
      const keyMap = { 'KeyA':'A', 'KeyB':'B', 'KeyC':'C', 'KeyG':'G' };
      function onKeyDown(e) {
        if (e.code === 'KeyG') { REAL.guardHeld = true; }
        if (e.code === 'Space') {
          REAL.enemyX = Math.max(220, REAL.enemyX - 60);
          e.preventDefault();
          return;
        }
        const input = keyMap[e.code];
        if (input) {
          REAL.buffer = { input, ttl: BUFFER_TTL };
          e.preventDefault();
        }
      }
      function onKeyUp(e) {
        if (e.code === 'KeyG') REAL.guardHeld = false;
      }
      canvas.addEventListener('keydown', onKeyDown);
      canvas.addEventListener('keyup', onKeyUp);
      // [/ai_s_emblem: Input-Layer]

      // [ai_s_emblem:#high#logic Tick]
      function tick() {
        REAL.frame += 1;

        const mv = MOVES[REAL.action];
        if (mv && REAL.frame >= mv.active[0] && REAL.frame <= mv.active[1]) {
          const dx = REAL.enemyX - REAL.playerX;
          if (dx > 0 && dx < mv.reach) REAL.hit = true;
        }

        const tryInputs = [];
        if (REAL.buffer) tryInputs.push(REAL.buffer.input);
        if (!REAL.guardHeld && REAL.action === 'GUARD') tryInputs.push('-');
        tryInputs.push('$');

        let fired = null;
        for (const inp of tryInputs) {
          const t = resolveTransition(REAL, inp);
          if (t) { fired = { ...t, inputUsed: inp }; break; }
        }

        if (fired) {
          pushLog(`${REAL.action}@f${REAL.frame} +${fired.inputUsed} → ${fired.next} [${fired.tag}]`);
          REAL.action = fired.next;
          REAL.frame = 0;
          REAL.hit = false;
          REAL.buffer = null;
          if (fired.tag !== 'recover' && fired.tag !== 'release') {
            REAL.enemyX = Math.min(W - 80, REAL.enemyX + 40);
          }
        }

        if (REAL.buffer) {
          REAL.buffer.ttl -= 1;
          if (REAL.buffer.ttl <= 0) REAL.buffer = null;
        }
      }
      // [/ai_s_emblem: Tick]

      function pushLog(line) {
        REAL.log.unshift(line);
        if (REAL.log.length > 8) REAL.log.length = 8;
      }

      // [ai_s_emblem:#mid#draw Render]
      function draw() {
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#30363d';
        ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); ctx.stroke();

        ctx.fillStyle = '#8b949e';
        ctx.fillRect(REAL.enemyX - 20, GROUND_Y - 60, 40, 60);

        const mv = MOVES[REAL.action];
        ctx.fillStyle = mv.color;
        ctx.fillRect(REAL.playerX - 18, GROUND_Y - 70, 36, 70);

        if (REAL.frame >= mv.active[0] && REAL.frame <= mv.active[1] && mv.reach > 0) {
          ctx.fillStyle = 'rgba(248,81,73,0.25)';
          ctx.fillRect(REAL.playerX, GROUND_Y - 50, mv.reach, 25);
        }

        ctx.fillStyle = '#e6edf3';
        ctx.font = '13px ui-monospace, monospace';
        ctx.fillText(`state: ${mv.label}  frame:${REAL.frame}${REAL.hit?' [HIT]':''}`, 12, 20);
        ctx.fillStyle = '#58a6ff';
        ctx.fillText(`buffer: ${REAL.buffer ? REAL.buffer.input + ' (ttl ' + REAL.buffer.ttl + ')' : '—'}`, 12, 40);
        ctx.fillStyle = '#8b949e';
        ctx.fillText(`enemy dist: ${REAL.enemyX - REAL.playerX}px`, 12, 60);
      }
      // [/ai_s_emblem: Render]

      // [ai_s_emblem:#mid#draw SidePanel]
      function renderSide() {
        const cur = REAL.action;
        const incoming = routesTo(cur);
        const outgoing = TRANSITIONS.filter(t => t.from === cur || t.from === 'ANY');
        const possibleNow = outgoing.filter(t => t.when(REAL));

        const fmt = (t) => `<span class="tag">${t.from}</span> +<b>${t.input}</b> → <span class="tag">${t.next}</span> <span class="dim">[${t.tag} p${t.prio}]</span>`;

        side.innerHTML = `
          <h3>▼ 逆引き: ${cur} に到達する全ルート (${incoming.length})</h3>
          ${incoming.map(t => `<div class="row">${fmt(t)}</div>`).join('')}
          <h3 style="margin-top:0.6rem">▼ いま受付中の遷移 (${possibleNow.length})</h3>
          ${possibleNow.map(t => `<div class="row ok">${fmt(t)}</div>`).join('') || '<div class="row dim">— なし —</div>'}
          <h3 style="margin-top:0.6rem">▼ ログ</h3>
          ${REAL.log.map(l => `<div class="row dim">${l}</div>`).join('') || '<div class="row dim">—</div>'}
        `;
      }
      // [/ai_s_emblem: SidePanel]

      let lastT = performance.now();
      let acc = 0;
      let raf = 0;
      function frame(t) {
        acc += t - lastT; lastT = t;
        while (acc >= FRAME_MS) { tick(); acc -= FRAME_MS; }
        draw();
        renderSide();
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      return () => {
        cancelAnimationFrame(raf);
        canvas.removeEventListener('keydown', onKeyDown);
        canvas.removeEventListener('keyup', onKeyUp);
      };
    },
  });
})();
// [/ai_s_emblem: Fighter-Cancel-Demo]
