const VER = "na-5"; // поменяй строку если GitHub Pages кэшит

// ====== SPRITES (без атласа) ======
const SPRITES = {
  down:      { url: `assets/sprite_down.png?v=${VER}`,       frameW: 688, frameH: 464, frames: 10, fps: 12 },
  right:     { url: `assets/sprite_righ.png?v=${VER}`,       frameW: 292, frameH: 293, frames: 30, fps: 12 },
  downRight: { url: `assets/sprite_down_right.png?v=${VER}`, frameW: 688, frameH: 464, frames: 6,  fps: 12 },
  upRight:   { url: `assets/sprite_up_right.png?v=${VER}`,   frameW: 688, frameH: 464, frames: 24, fps: 14 },
  up:        { url: `assets/sprite_up.png?v=${VER}`,         frameW: 332, frameH: 302, frames: 12, fps: 12 },

  // ✅ FRONT IDLE теперь 5 кадров (удалены 0,2,7)
  idleFront: { url: `assets/sprite_idle_front.png?v=${VER}`, frameW: 380, frameH: 420, frames: 5,  fps: 6 },

  idleBack:  { url: `assets/sprite_idle_back.png?v=${VER}`,  frameW: 353, frameH: 342, frames: 12, fps: 6 },
  attack:    { url: `assets/sprite_attack.png?v=${VER}`,     frameW: 459, frameH: 392, frames: 24, fps: 16 },
  death:     { url: `assets/sprite_death.png?v=${VER}`,      frameW: 688, frameH: 464, frames: 23, fps: 12 },
};

// ====== DRAGON SPRITE (loop) ======
const DRAGON_SPRITE = {
  url: `assets/sprite_dragon.png?v=${VER}`,
  frameW: 256, frameH: 256, frames: 24, fps: 12,
  drawW: 320, drawH: 320
};

// 8 направлений (y вниз):
// 0 right, 1 down-right, 2 down, 3 down-left, 4 left, 5 up-left, 6 up, 7 up-right
function dir8FromVector(dx, dy){
  const ang = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  let idx = Math.floor((ang + step/2) / step);
  idx = (idx % 8 + 8) % 8;
  return idx;
}

function spriteForDir8(dir8){
  switch(dir8){
    case 0: return { key: "right",     flipX: false };
    case 1: return { key: "downRight", flipX: false };
    case 2: return { key: "down",      flipX: false };
    case 3: return { key: "downRight", flipX: true  };
    case 4: return { key: "right",     flipX: true  };
    case 5: return { key: "upRight",   flipX: true  };
    case 6: return { key: "up",        flipX: false };
    case 7: return { key: "upRight",   flipX: false };
    default:return { key: "down",      flipX: false };
  }
}

// ====== DOM ======
const stage = document.getElementById("stage");
const playerEl = document.getElementById("player");
const playerSpriteEl = document.getElementById("playerSprite");
const playerHPFill = document.getElementById("playerHP");
const playerLabel = document.getElementById("playerLabel");

const dragonEl = document.getElementById("dragon");
const dragonSpriteEl = document.getElementById("dragonSprite");
const dragonHPFill = document.getElementById("dragonHP");
const dragonLabel = document.getElementById("dragonLabel");

// ====== SFX ======
const hitSfx = new Audio(`assets/hit.wav?v=${VER}`);
hitSfx.preload = "auto";
hitSfx.volume = 0.65;

// unlock audio on first user gesture (mobile/OBS browsers)
let audioUnlocked = false;
function unlockAudio(){
  if (audioUnlocked) return;
  audioUnlocked = true;
  try{
    hitSfx.play().then(()=>{ hitSfx.pause(); hitSfx.currentTime = 0; }).catch(()=>{});
  }catch{}
}
document.addEventListener("pointerdown", unlockAudio, { once:true });
document.addEventListener("touchstart", unlockAudio, { once:true, passive:true });

// ====== DAMAGE FX ======
function spawnDamageFx(x, y, amount){
  const el = document.createElement("div");
  el.className = "damage-float";
  el.textContent = `-${Math.round(amount)}`;
  el.style.left = x + "px";
  el.style.top  = y + "px";
  stage.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}
function flashDragonHurt(){
  dragonEl.classList.remove("hurt");
  void dragonEl.offsetWidth;
  dragonEl.classList.add("hurt");
}

// ====== WORLD STATE ======
const state = {
  player: {
    x: 80,
    y: 0,
    speed: 260,
    hp: 1000,
    maxHp: 1000,
    targetX: null,
    targetY: null,
    mode: "idle", // idle | walk | attack
    dir8: 2,
    attackAcc: 0,
    lastFacing: "front",

    // respawn
    spawnX: 90,
    spawnY: 0,
    respawnInvuln: 0,
  },
  dragon: {
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    alive: true,
  }
};

// ====== ANIM ======
const anim = {
  key: "down",
  flipX: false,
  frame: 0,
  acc: 0,
};

// ====== IDLE STABILIZER (manual offsets) ======
// ✅ Под новый 5-кадровый idleFront оффсеты:
const FRAME_X_OFFSETS = {
  idleFront: [0, 7, 0, 5, -6],
  idleBack:  null, // back почти идеален — не трогаем
};

// ====== DRAGON ANIM ======
const dragonAnim = { frame: 0, acc: 0 };

function applyDragonSprite(){
  dragonEl.style.width = DRAGON_SPRITE.drawW + "px";
  dragonEl.style.height = DRAGON_SPRITE.drawH + "px";
  dragonSpriteEl.style.width = DRAGON_SPRITE.drawW + "px";
  dragonSpriteEl.style.height = DRAGON_SPRITE.drawH + "px";
  dragonSpriteEl.style.backgroundImage = `url(${DRAGON_SPRITE.url})`;
  dragonSpriteEl.style.backgroundSize = `${DRAGON_SPRITE.frames * DRAGON_SPRITE.drawW}px ${DRAGON_SPRITE.drawH}px`;
  dragonSpriteEl.style.backgroundPosition = "0px 0px";
}

function applySprite(key, flipX){
  if (anim.key === key && anim.flipX === flipX) return;

  anim.key = key;
  anim.flipX = flipX;
  anim.frame = 0;
  anim.acc = 0;

  const s = SPRITES[key];

  // remember facing for idle
  if (key === "up" || key === "upRight") state.player.lastFacing = "back";
  else if (key === "down" || key === "downRight" || key === "right") state.player.lastFacing = "front";

  playerSpriteEl.style.width = s.frameW + "px";
  playerSpriteEl.style.height = s.frameH + "px";
  playerSpriteEl.style.backgroundImage = `url("${s.url}")`;

  playerSpriteEl.style.transform = `translateX(-50%) scaleX(${flipX ? -1 : 1})`;
}

function tickAnim(dt){
  const s = SPRITES[anim.key];
  anim.acc += dt;

  const spf = 1 / (s.fps || 12);
  while (anim.acc >= spf){
    anim.acc -= spf;
    anim.frame = (anim.frame + 1) % s.frames;
  }

  const x = -anim.frame * s.frameW;
  playerSpriteEl.style.backgroundPosition = `${x}px 0px`;

  // stabilize idle
  let offs = 0;
  const arr = FRAME_X_OFFSETS[anim.key];
  if (arr && arr.length) offs = arr[anim.frame] || 0;

  const sign = anim.flipX ? -1 : 1;
  playerSpriteEl.style.transform =
    `translateX(calc(-50% + ${offs * sign}px)) scaleX(${anim.flipX ? -1 : 1})`;
}

// ====== UI ======
function tickDragon(dt){
  if (!state.dragon.alive) return;
  dragonAnim.acc += dt;
  const spf = 1 / (DRAGON_SPRITE.fps || 12);
  while (dragonAnim.acc >= spf){
    dragonAnim.acc -= spf;
    dragonAnim.frame = (dragonAnim.frame + 1) % DRAGON_SPRITE.frames;
    const x = -dragonAnim.frame * DRAGON_SPRITE.drawW;
    dragonSpriteEl.style.backgroundPosition = `${x}px 0px`;
  }
}

function setHP(fillEl, labelEl, hp, maxHp, prefix){
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  fillEl.style.width = (pct * 100).toFixed(1) + "%";
  labelEl.textContent = `${prefix} ${Math.max(0, Math.floor(hp))}/${maxHp}`;
}

// ====== DEPTH + HITBOX ======
const DEPTH = {
  topScale: 1/3,
  midScale: 0.5,
  bottomScale: 1.0,
};

const HITBOX = {
  player: { w: 70, h: 28 },
  dragon: { wMul: 0.60, hMul: 0.35 },
};

function smoothstep(t){
  return t * t * (3 - 2 * t);
}
function lerp(a,b,t){
  return a + (b - a) * t;
}

// ✅ Плавная “глубина” (без резкого линейного ощущения)
function scaleForY(y){
  const rect = stage.getBoundingClientRect();
  const h = Math.max(1, rect.height);
  const t = Math.max(0, Math.min(1, y / h)); // 0=top, 1=bottom

  if (t <= 0.5){
    let k = t / 0.5;
    k = smoothstep(k);
    return lerp(DEPTH.topScale, DEPTH.midScale, k);
  } else {
    let k = (t - 0.5) / 0.5;
    k = smoothstep(k);
    return lerp(DEPTH.midScale, DEPTH.bottomScale, k);
  }
}

function hitCenter(entityX, entityY, w, h){
  return { cx: entityX, cy: entityY - h * 0.5 };
}

// ====== DEBUG HITBOX ======
let debugHitbox = false;
const hbPlayer = document.createElement("div");
const hbDragon = document.createElement("div");
for (const el of [hbPlayer, hbDragon]){
  el.style.position = "absolute";
  el.style.transform = "translate(-50%, -50%)";
  el.style.border = "2px solid rgba(0,255,180,.85)";
  el.style.borderRadius = "12px";
  el.style.pointerEvents = "none";
  el.style.zIndex = "999";
  el.style.display = "none";
  stage.appendChild(el);
}
hbDragon.style.borderColor = "rgba(255,120,80,.85)";

window.addEventListener("keydown", (e)=>{
  if (e.key.toLowerCase() === "h"){
    debugHitbox = !debugHitbox;
    hbPlayer.style.display = debugHitbox ? "block" : "none";
    hbDragon.style.display = debugHitbox ? "block" : "none";
  }
});

// ====== LAYOUT ======
function resize(){
  const rect = stage.getBoundingClientRect();

  // spawn
  state.player.spawnX = 90;
  state.player.spawnY = rect.height - 40;

  // старт: почти снизу слева
  state.player.y = state.player.spawnY;
  state.player.x = state.player.spawnX;

  // ✅ дракон: под самым верхом, 10% вправо от середины
  state.dragon.x = rect.width * 0.60;
  state.dragon.y = rect.height * 0.10;

  placeEntities();
}
window.addEventListener("resize", resize);

function placeEntities(){
  playerEl.style.left = state.player.x + "px";
  playerEl.style.top  = state.player.y + "px";

  dragonEl.style.left = state.dragon.x + "px";
  dragonEl.style.top  = state.dragon.y + "px";

  const ps = scaleForY(state.player.y);
  const ds = scaleForY(state.dragon.y);

  playerEl.style.transform = `translate(-50%, -100%) scale(${ps.toFixed(3)})`;
  dragonEl.style.transform = `translate(-50%, -100%) scale(${ds.toFixed(3)})`;

  playerEl.style.zIndex = String(Math.floor(state.player.y));
  dragonEl.style.zIndex = String(Math.floor(state.dragon.y));

  if (debugHitbox){
    const pW = HITBOX.player.w * ps;
    const pH = HITBOX.player.h * ps;
    const pc = hitCenter(state.player.x, state.player.y, pW, pH);
    hbPlayer.style.left = pc.cx + "px";
    hbPlayer.style.top  = pc.cy + "px";
    hbPlayer.style.width = pW + "px";
    hbPlayer.style.height = pH + "px";

    const dW = (DRAGON_SPRITE.drawW * HITBOX.dragon.wMul) * ds;
    const dH = (DRAGON_SPRITE.drawH * HITBOX.dragon.hMul) * ds;
    const dc = hitCenter(state.dragon.x, state.dragon.y, dW, dH);
    hbDragon.style.left = dc.cx + "px";
    hbDragon.style.top  = dc.cy + "px";
    hbDragon.style.width = dW + "px";
    hbDragon.style.height = dH + "px";
  }
}

// ====== INPUT ======
function setTargetFromEvent(e){
  const rect = stage.getBoundingClientRect();
  const x = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
  const y = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
  state.player.targetX = x;
  state.player.targetY = y;
  if (state.player.mode !== "attack") state.player.mode = "walk";
}
stage.addEventListener("pointerdown", (e) => setTargetFromEvent(e));
stage.addEventListener("touchstart", (e) => setTargetFromEvent(e), { passive: true });

// ====== COMBAT ======
const ATTACK_RANGE = 110;
const HIT_DPS = 18;

// ====== DRAGON ATTACK ======
const DRAGON_HIT_INTERVAL = 1.0; // раз в 1 сек
const DRAGON_DMG_MIN = 100;
const DRAGON_DMG_MAX = 300;
let dragonAttackAcc = 0;

function randInt(min, max){
  return Math.floor(min + Math.random() * (max - min + 1));
}

function respawnPlayer(){
  const rect = stage.getBoundingClientRect();
  state.player.hp = state.player.maxHp;
  state.player.x = state.player.spawnX;
  state.player.y = state.player.spawnY || (rect.height - 40);
  state.player.targetX = null;
  state.player.targetY = null;
  state.player.mode = "idle";
  state.player.attackAcc = 0;
  dragonAttackAcc = 0;
  state.player.respawnInvuln = 0.9; // короткая неуязвимость, чтобы не убило сразу снова
}

function updateCombat(dt){
  if (!state.dragon.alive) return;

  const ps = scaleForY(state.player.y);
  const ds = scaleForY(state.dragon.y);
  const pW = HITBOX.player.w * ps;
  const pH = HITBOX.player.h * ps;
  const dW = (DRAGON_SPRITE.drawW * HITBOX.dragon.wMul) * ds;
  const dH = (DRAGON_SPRITE.drawH * HITBOX.dragon.hMul) * ds;

  const pc = hitCenter(state.player.x, state.player.y, pW, pH);
  const dc = hitCenter(state.dragon.x, state.dragon.y, dW, dH);
  const dx = dc.cx - pc.cx;
  const dy = dc.cy - pc.cy;
  const dist = Math.hypot(dx, dy);

  if (dist <= ATTACK_RANGE){
    // игрок атакует
    state.player.mode = "attack";
    state.player.targetX = null;
    state.player.targetY = null;

    state.player.dir8 = dir8FromVector(dx, dy);
    const { flipX } = spriteForDir8(state.player.dir8);
    applySprite("attack", flipX);

    // урон игрока по дракону
    const HIT_INTERVAL = 0.18;
    state.player.attackAcc += dt;
    while (state.player.attackAcc >= HIT_INTERVAL){
      state.player.attackAcc -= HIT_INTERVAL;

      const dmg = HIT_DPS * HIT_INTERVAL;
      state.dragon.hp -= dmg;

      try{ hitSfx.currentTime = 0; hitSfx.play().catch(()=>{}); }catch{}
      spawnDamageFx(state.dragon.x, state.dragon.y - DRAGON_SPRITE.drawH*0.75, dmg);
      flashDragonHurt();

      if (state.dragon.hp <= 0) break;
    }

    if (state.dragon.hp <= 0){
      state.dragon.hp = 0;
      state.dragon.alive = false;
      dragonEl.style.display = "none";
      state.player.attackAcc = 0;
      state.player.mode = "idle";
      return;
    }

    // ✅ дракон бьёт в ответ
    if (state.player.respawnInvuln <= 0){
      dragonAttackAcc += dt;
      while (dragonAttackAcc >= DRAGON_HIT_INTERVAL){
        dragonAttackAcc -= DRAGON_HIT_INTERVAL;

        const dmgToPlayer = randInt(DRAGON_DMG_MIN, DRAGON_DMG_MAX);
        state.player.hp -= dmgToPlayer;
        spawnDamageFx(state.player.x, state.player.y - 120, dmgToPlayer);

        if (state.player.hp <= 0){
          state.player.hp = 0;
          respawnPlayer();
          break;
        }
      }
    }
  } else {
    if (state.player.mode === "attack"){
      state.player.attackAcc = 0;
      dragonAttackAcc = 0;
      state.player.mode = (state.player.targetX != null) ? "walk" : "idle";
    }
  }
}

// ====== MOVE ======
function updateMove(dt){
  if (state.player.mode !== "walk") return;
  if (state.player.targetX == null || state.player.targetY == null) return;

  const dx = state.player.targetX - state.player.x;
  const dy = state.player.targetY - state.player.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 2){
    // ✅ фикс: финальная ориентация по целевой точке
    state.player.lastFacing = (dy < 0) ? "back" : "front";

    state.player.x = state.player.targetX;
    state.player.y = state.player.targetY;
    state.player.targetX = null;
    state.player.targetY = null;
    state.player.mode = "idle";
    return;
  }

  const vx = dx / dist;
  const vy = dy / dist;

  // ✅ “глубина” + реалистичнее скорость:
  // - базово скорость пропорциональна scale
  // - при движении вверх чуть медленнее (псевдо-3D)
  const depthK = scaleForY(state.player.y);
  const upSlow = 0.25;   // 25% медленнее, если идём строго вверх
  const downFast = 0.10; // 10% быстрее, если идём строго вниз
  let dirK = 1 - upSlow * Math.max(0, -vy) + downFast * Math.max(0, vy);
  dirK = Math.max(0.60, Math.min(1.20, dirK));

  const spd = state.player.speed * depthK * dirK;

  state.player.x += vx * spd * dt;
  state.player.y += vy * spd * dt;

  state.player.dir8 = dir8FromVector(vx, vy);
  const { key, flipX } = spriteForDir8(state.player.dir8);
  applySprite(key, flipX);
}

// ====== LOOP ======
let last = performance.now();
function loop(now){
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // respawn invuln timer
  if (state.player.respawnInvuln > 0){
    state.player.respawnInvuln = Math.max(0, state.player.respawnInvuln - dt);
  }

  updateCombat(dt);

  if (state.player.mode !== "attack"){
    updateMove(dt);
    if (state.player.mode === "idle"){
      const idleKey = (state.player.lastFacing === "back") ? "idleBack" : "idleFront";
      applySprite(idleKey, false);
    }
  }

  tickAnim(dt);
  tickDragon(dt);
  placeEntities();

  setHP(playerHPFill, playerLabel, state.player.hp, state.player.maxHp, "HP");
  if (state.dragon.alive){
    setHP(dragonHPFill, dragonLabel, state.dragon.hp, state.dragon.maxHp, "Dragon");
  }

  requestAnimationFrame(loop);
}

// init
applySprite("down", false);
applyDragonSprite();
resize();
requestAnimationFrame(loop);
