const VER = "na-9"; // поменяй строку если GitHub Pages кэшит

// ====== SPRITES (без атласа) ======
const SPRITES = {
  down:      { url: `assets/sprite_down.png?v=${VER}`,       frameW: 688, frameH: 464, frames: 10, fps: 12 },
  right:     { url: `assets/sprite_righ.png?v=${VER}`,       frameW: 292, frameH: 293, frames: 30, fps: 12 },
  downRight: { url: `assets/sprite_down_right.png?v=${VER}`, frameW: 688, frameH: 464, frames: 6,  fps: 12 },
  upRight:   { url: `assets/sprite_up_right.png?v=${VER}`,   frameW: 688, frameH: 464, frames: 24, fps: 14 },
  up:        { url: `assets/sprite_up.png?v=${VER}`,         frameW: 332, frameH: 302, frames: 12, fps: 12 },

  // новый front idle
  idleFront: { url: `assets/sprite_idle_front.png?v=${VER}`, frameW: 688, frameH: 464, frames: 7, fps: 6 },

  idleBack:  { url: `assets/sprite_idle_back.png?v=${VER}`,  frameW: 353, frameH: 342, frames: 12, fps: 6 },
  attack:    { url: `assets/sprite_attack.png?v=${VER}`,     frameW: 459, frameH: 392, frames: 24, fps: 16 },
  death:     { url: `assets/sprite_death.png?v=${VER}`,      frameW: 688, frameH: 464, frames: 23, fps: 12 },
};

// ====== DRAGON SPRITE ======
const DRAGON_SPRITE = {
  url: `assets/sprite_dragon.png?v=${VER}`,
  frameW: 256, frameH: 256, frames: 24, fps: 12,
  drawW: 320, drawH: 320
};

// ====== DIR 8 ======
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
const stageFrame = document.getElementById("stageFrame");
const stage = document.getElementById("stage");
const playerEl = document.getElementById("player");
const playerSpriteEl = document.getElementById("playerSprite");
const playerHPFill = document.getElementById("playerHP");
const playerLabel = document.getElementById("playerLabel");

const dragonEl = document.getElementById("dragon");
const dragonSpriteEl = document.getElementById("dragonSprite");
const dragonHPFill = document.getElementById("dragonHP");
const dragonLabel = document.getElementById("dragonLabel");


function syncViewportVars(){
  const vv = window.visualViewport;
  const h = Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 0);
  if (h > 0){
    document.documentElement.style.setProperty("--app-height", `${h}px`);
  }
}
syncViewportVars();
window.addEventListener("resize", syncViewportVars, { passive:true });
window.addEventListener("orientationchange", syncViewportVars, { passive:true });
window.visualViewport?.addEventListener("resize", syncViewportVars, { passive:true });
window.visualViewport?.addEventListener("scroll", syncViewportVars, { passive:true });

// ====== SFX (mp3) ======
const hitSfx = new Audio(`assets/hit.mp3?v=${VER}`);
hitSfx.preload = "auto";
hitSfx.volume = 0.65;
hitSfx.load();

const dragonHitSfx = new Audio(`assets/dragon_hit.mp3?v=${VER}`);
dragonHitSfx.preload = "auto";
dragonHitSfx.volume = 0.75;
dragonHitSfx.load();

const dragonRoarSfx = new Audio(`assets/dragon_roar.mp3?v=${VER}`);
dragonRoarSfx.preload = "auto";
dragonRoarSfx.volume = 0.85;
dragonRoarSfx.load();

// unlock audio on first user gesture
let audioUnlocked = false;
function unlockAudio(){
  if (audioUnlocked) return;
  audioUnlocked = true;
  try{
    hitSfx.play().then(()=>{ hitSfx.pause(); hitSfx.currentTime = 0; }).catch(()=>{});
    dragonHitSfx.play().then(()=>{ dragonHitSfx.pause(); dragonHitSfx.currentTime = 0; }).catch(()=>{});
    dragonRoarSfx.play().then(()=>{ dragonRoarSfx.pause(); dragonRoarSfx.currentTime = 0; }).catch(()=>{});
  }catch{}
}
document.addEventListener("pointerdown", unlockAudio, { once:true });
document.addEventListener("touchstart", unlockAudio, { once:true, passive:true });

function playQuick(audio){
  try{
    audio.currentTime = 0;
    audio.play().catch(()=>{});
  }catch{}
}

// ====== FX ======
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

function flashPlayerHurt(){
  playerEl.classList.remove("hurt");
  void playerEl.offsetWidth;
  playerEl.classList.add("hurt");
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
    pendingAttackHits: 0,
    lastFacing: "front",

    spawnX: 90,
    spawnY: 0,
    respawnInvuln: 0,

    kbVX: 0,
    kbVY: 0,
    kbT: 0,
  },

  dragon: {
    x: 0,
    y: 0,

    baseX: 0,
    baseY: 0,

    hp: 100,
    maxHp: 100,
    alive: true,

    recoilVX: 0,
    recoilVY: 0,
    recoilT: 0,
  },

  shake: {
    t: 0,
    power: 0,
    x: 0,
    y: 0,
  }
};

// ====== ANIM ======
const anim = {
  key: "down",
  flipX: false,
  frame: 0,
  acc: 0,
};

const PLAYER_ATTACK_HIT_FRAMES = [6, 10, 19];
let playerAttackCycle = 0;
let playerAttackHitMask = 0;

const FRAME_X_OFFSETS = {};

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

  const prevKey = anim.key;

  anim.key = key;
  anim.flipX = flipX;
  anim.frame = 0;
  anim.acc = 0;

  if (key === "attack"){
    if (prevKey !== "attack"){
      playerAttackCycle = 0;
      playerAttackHitMask = 0;
    }
  } else {
    playerAttackCycle = 0;
    playerAttackHitMask = 0;
  }

  const s = SPRITES[key];

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
    const prevFrame = anim.frame;
    anim.frame = (anim.frame + 1) % s.frames;

    if (anim.key === "attack"){
      const hits = consumePlayerAttackHits(prevFrame, anim.frame, s.frames);
      if (hits.length){
        state.player.pendingAttackHits += hits.length;
      }
    }
  }

  const x = -anim.frame * s.frameW;
  playerSpriteEl.style.backgroundPosition = `${x}px 0px`;

  let offs = 0;
  const arr = FRAME_X_OFFSETS[anim.key];
  if (arr && arr.length) offs = arr[anim.frame] || 0;

  const sign = anim.flipX ? -1 : 1;
  playerSpriteEl.style.transform =
    `translateX(calc(-50% + ${offs * sign}px)) scaleX(${anim.flipX ? -1 : 1})`;
}

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


function clearPlayerAttackCycle(){
  playerAttackCycle = 0;
  playerAttackHitMask = 0;
}

function consumePlayerAttackHits(prevFrame, currentFrame, totalFrames){
  if (anim.key !== "attack") return [];

  let cycle = playerAttackCycle;
  const prevAbs = cycle * totalFrames + prevFrame;
  let currentAbs = cycle * totalFrames + currentFrame;
  if (currentFrame < prevFrame) {
    cycle += 1;
    currentAbs = cycle * totalFrames + currentFrame;
  }

  const hits = [];
  for (let i = 0; i < PLAYER_ATTACK_HIT_FRAMES.length; i++){
    const threshold = cycle * totalFrames + PLAYER_ATTACK_HIT_FRAMES[i];
    if (prevAbs < threshold && currentAbs >= threshold){
      const bit = 1 << i;
      if ((playerAttackHitMask & bit) === 0){
        playerAttackHitMask |= bit;
        hits.push(i);
      }
    }
  }

  if (currentFrame < prevFrame){
    playerAttackCycle = cycle;
    playerAttackHitMask = 0;
  }

  return hits;
}

function setHP(fillEl, labelEl, hp, maxHp, prefix){
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  fillEl.style.width = (pct * 100).toFixed(1) + "%";
  labelEl.textContent = `${prefix} ${Math.max(0, Math.floor(hp))}/${maxHp}`;
}

// ====== DEPTH + HITBOX ======
const DEPTH = { topScale: 1/3, midScale: 0.5, bottomScale: 1.0 };

const HITBOX = {
  player: { w: 70, h: 28 },
  dragon: { wMul: 0.60, hMul: 0.35 },
};

function smoothstep(t){ return t * t * (3 - 2 * t); }
function lerp(a,b,t){ return a + (b - a) * t; }

function scaleForY(y){
  const rect = stage.getBoundingClientRect();
  const h = Math.max(1, rect.height);
  const t = Math.max(0, Math.min(1, y / h));

  if (t <= 0.5){
    const k = smoothstep(t / 0.5);
    return lerp(DEPTH.topScale, DEPTH.midScale, k);
  } else {
    const k = smoothstep((t - 0.5) / 0.5);
    return lerp(DEPTH.midScale, DEPTH.bottomScale, k);
  }
}

function hitCenter(entityX, entityY, w, h){
  return { cx: entityX, cy: entityY - h * 0.5 };
}

function clampToStage(){
  const rect = stage.getBoundingClientRect();
  state.player.x = Math.max(0, Math.min(rect.width, state.player.x));
  state.player.y = Math.max(0, Math.min(rect.height, state.player.y));
}

// ====== SHAKE ======
function addShake(power, duration = 0.16){
  state.shake.power = Math.max(state.shake.power, power);
  state.shake.t = Math.max(state.shake.t, duration);
}

function updateShake(dt){
  if (state.shake.t > 0){
    state.shake.t = Math.max(0, state.shake.t - dt);
    const k = state.shake.t / 0.16;
    const p = state.shake.power * k;
    state.shake.x = (Math.random() * 2 - 1) * p;
    state.shake.y = (Math.random() * 2 - 1) * p;
  } else {
    state.shake.x = 0;
    state.shake.y = 0;
    state.shake.power = 0;
  }
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
let hasLayoutInit = false;
let lastStageW = 0;
let lastStageH = 0;

function resize(){
  syncViewportVars();
  const rect = stage.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);

  const prevW = Math.max(1, lastStageW || w);
  const prevH = Math.max(1, lastStageH || h);
  const ratioPlayerX = state.player.x / prevW;
  const ratioPlayerY = state.player.y / prevH;
  const ratioDragonX = state.dragon.x / prevW;
  const ratioDragonY = state.dragon.y / prevH;

  state.player.spawnX = Math.round(w * 0.18);
  state.player.spawnY = Math.round(h * 0.90);

  state.dragon.baseX = Math.round(w * 0.66);
  state.dragon.baseY = Math.round(h * 0.30);

  if (!hasLayoutInit){
    state.player.x = state.player.spawnX;
    state.player.y = state.player.spawnY;
    state.dragon.x = state.dragon.baseX;
    state.dragon.y = state.dragon.baseY;
    hasLayoutInit = true;
  } else {
    state.player.x = Math.max(0, Math.min(w, Math.round(ratioPlayerX * w)));
    state.player.y = Math.max(0, Math.min(h, Math.round(ratioPlayerY * h)));
    state.dragon.x = Math.max(0, Math.min(w, Math.round(ratioDragonX * w)));
    state.dragon.y = Math.max(0, Math.min(h, Math.round(ratioDragonY * h)));
  }

  if (state.player.targetX != null) state.player.targetX = Math.max(0, Math.min(w, state.player.targetX * (w / prevW)));
  if (state.player.targetY != null) state.player.targetY = Math.max(0, Math.min(h, state.player.targetY * (h / prevH)));

  lastStageW = w;
  lastStageH = h;
  clampToStage();
  placeEntities();
}
window.addEventListener("resize", resize, { passive:true });

// ====== RECOIL ======
const DRAGON_RECOIL_PX = 12;
const DRAGON_RECOIL_TIME = 0.08;

function startDragonRecoil(fromX, fromY, toX, toY){
  const dx = toX - fromX;
  const dy = toY - fromY;
  const d = Math.hypot(dx, dy) || 1;

  const nx = dx / d;
  const ny = dy / d;
  const spd = DRAGON_RECOIL_PX / DRAGON_RECOIL_TIME;

  state.dragon.recoilVX = nx * spd;
  state.dragon.recoilVY = ny * spd;
  state.dragon.recoilT = DRAGON_RECOIL_TIME;
}

function applyDragonRecoil(dt){
  if (state.dragon.recoilT <= 0){
    // мягко возвращаемся к базе
    state.dragon.x += (state.dragon.baseX - state.dragon.x) * Math.min(1, dt * 18);
    state.dragon.y += (state.dragon.baseY - state.dragon.y) * Math.min(1, dt * 18);
    return;
  }

  const t = Math.min(dt, state.dragon.recoilT);
  state.dragon.recoilT -= t;

  state.dragon.x += state.dragon.recoilVX * t;
  state.dragon.y += state.dragon.recoilVY * t;
}

function placeEntities(){
  const shakeX = state.shake.x;
  const shakeY = state.shake.y;

  playerEl.style.left = (state.player.x + shakeX) + "px";
  playerEl.style.top  = (state.player.y + shakeY) + "px";

  dragonEl.style.left = (state.dragon.x + shakeX) + "px";
  dragonEl.style.top  = (state.dragon.y + shakeY) + "px";

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
    hbPlayer.style.left = (pc.cx + shakeX) + "px";
    hbPlayer.style.top  = (pc.cy + shakeY) + "px";
    hbPlayer.style.width = pW + "px";
    hbPlayer.style.height = pH + "px";

    const dW = (DRAGON_SPRITE.drawW * HITBOX.dragon.wMul) * ds;
    const dH = (DRAGON_SPRITE.drawH * HITBOX.dragon.hMul) * ds;
    const dc = hitCenter(state.dragon.x, state.dragon.y, dW, dH);
    hbDragon.style.left = (dc.cx + shakeX) + "px";
    hbDragon.style.top  = (dc.cy + shakeY) + "px";
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
  state.player.attackAcc = 0;
  state.player.pendingAttackHits = 0;
  dragonAttackAcc = 0;
  clearPlayerAttackCycle();
  state.player.mode = "walk";
}
stage.addEventListener("pointerdown", (e) => setTargetFromEvent(e));
stage.addEventListener("touchstart", (e) => setTargetFromEvent(e), { passive: true });

// ====== COMBAT ======
const ATTACK_RANGE = 110;
const DRAGON_ATTACK_RANGE = 128;
const PLAYER_ATTACK_DAMAGE = 18;

// dragon attack
const DRAGON_HIT_INTERVAL = 1.0;
const DRAGON_DMG_MIN = 100;
const DRAGON_DMG_MAX = 300;
let dragonAttackAcc = 0;

// knockback
const KNOCKBACK_PX = 38;
const KNOCKBACK_TIME = 0.10;

// roar
let roarCd = 0;
let inThreatZone = false;
const THREAT_RANGE = 220;

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
  state.player.pendingAttackHits = 0;
  clearPlayerAttackCycle();
  dragonAttackAcc = 0;
  state.player.respawnInvuln = 0.9;

  state.player.kbT = 0;
  state.player.kbVX = 0;
  state.player.kbVY = 0;
}

function applyKnockback(dt){
  if (state.player.kbT <= 0) return;

  const t = Math.min(dt, state.player.kbT);
  state.player.kbT -= t;

  state.player.x += state.player.kbVX * t;
  state.player.y += state.player.kbVY * t;

  clampToStage();

  state.player.targetX = null;
  state.player.targetY = null;
  if (state.player.mode !== "attack") state.player.mode = "idle";
}

function startKnockback(fromX, fromY, toX, toY){
  const dx = toX - fromX;
  const dy = toY - fromY;
  const d = Math.hypot(dx, dy) || 1;

  const nx = dx / d;
  const ny = dy / d;

  const spd = KNOCKBACK_PX / KNOCKBACK_TIME;
  state.player.kbVX = nx * spd;
  state.player.kbVY = ny * spd;
  state.player.kbT = KNOCKBACK_TIME;
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

  if (dist <= THREAT_RANGE){
    if (!inThreatZone && roarCd <= 0){
      playQuick(dragonRoarSfx);
      roarCd = 2.8;
    }
    inThreatZone = true;
  } else {
    inThreatZone = false;
  }

  if (dist <= ATTACK_RANGE){
    state.player.mode = "attack";
    state.player.targetX = null;
    state.player.targetY = null;

    state.player.dir8 = dir8FromVector(dx, dy);
    const { flipX } = spriteForDir8(state.player.dir8);
    applySprite("attack", flipX);

    const dmgPerHit = PLAYER_ATTACK_DAMAGE;
    while (state.player.pendingAttackHits > 0){
      state.player.pendingAttackHits -= 1;

      state.dragon.hp -= dmgPerHit;
      playQuick(hitSfx);
      spawnDamageFx(state.dragon.x, state.dragon.y - DRAGON_SPRITE.drawH * 0.75, dmgPerHit);
      flashDragonHurt();
      startDragonRecoil(state.player.x, state.player.y, state.dragon.x, state.dragon.y);

      if (state.dragon.hp <= 0) break;
    }

    if (state.dragon.hp <= 0){
      state.dragon.hp = 0;
      state.dragon.alive = false;
      dragonEl.style.display = "none";
      state.player.attackAcc = 0;
      state.player.pendingAttackHits = 0;
      clearPlayerAttackCycle();
      state.player.mode = "idle";
      return;
    }

    if (state.player.respawnInvuln <= 0 && dist <= DRAGON_ATTACK_RANGE){
      dragonAttackAcc += dt;
      while (dragonAttackAcc >= DRAGON_HIT_INTERVAL){
        dragonAttackAcc -= DRAGON_HIT_INTERVAL;

        const dmgToPlayer = randInt(DRAGON_DMG_MIN, DRAGON_DMG_MAX);
        state.player.hp -= dmgToPlayer;

        spawnDamageFx(state.player.x, state.player.y - 120, dmgToPlayer);
        flashPlayerHurt();
        startKnockback(state.dragon.x, state.dragon.y, state.player.x, state.player.y);

        playQuick(dragonHitSfx);
        if (roarCd <= 0){
          playQuick(dragonRoarSfx);
          roarCd = 2.4;
        }

        addShake(7, 0.16);

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
      state.player.pendingAttackHits = 0;
      clearPlayerAttackCycle();
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

  const STOP_EPS = 6;

  if (dist <= STOP_EPS){
    if (Math.abs(dy) > Math.abs(dx) * 0.35){
      state.player.lastFacing = (dy < 0) ? "back" : "front";
    }
    state.player.x = state.player.targetX;
    state.player.y = state.player.targetY;
    state.player.targetX = null;
    state.player.targetY = null;
    state.player.mode = "idle";
    return;
  }

  const vx = dx / dist;
  const vy = dy / dist;

  const depthK = scaleForY(state.player.y);
  const upSlow = 0.25;
  const downFast = 0.10;
  let dirK = 1 - upSlow * Math.max(0, -vy) + downFast * Math.max(0, vy);
  dirK = Math.max(0.60, Math.min(1.20, dirK));

  let slowK = 1;
  if (dist < 48){
    slowK = Math.max(0.50, dist / 48);
  }

  const spd = state.player.speed * depthK * dirK * slowK;
  const step = spd * dt;

  if (step >= dist){
    if (Math.abs(dy) > Math.abs(dx) * 0.35){
      state.player.lastFacing = (dy < 0) ? "back" : "front";
    }
    state.player.x = state.player.targetX;
    state.player.y = state.player.targetY;
    state.player.targetX = null;
    state.player.targetY = null;
    state.player.mode = "idle";
    return;
  }

  state.player.x += vx * step;
  state.player.y += vy * step;
  clampToStage();

  if (Math.abs(vy) >= 0.25){
    state.player.lastFacing = (vy < 0) ? "back" : "front";
  }

  state.player.dir8 = dir8FromVector(vx, vy);
  const { key, flipX } = spriteForDir8(state.player.dir8);
  applySprite(key, flipX);
}

// ====== LOOP ======
let last = performance.now();
function loop(now){
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (roarCd > 0) roarCd = Math.max(0, roarCd - dt);

  if (state.player.respawnInvuln > 0){
    state.player.respawnInvuln = Math.max(0, state.player.respawnInvuln - dt);
  }

  updateShake(dt);
  applyKnockback(dt);
  applyDragonRecoil(dt);
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
