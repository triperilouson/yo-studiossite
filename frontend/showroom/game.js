import { WORLD, ROOM, ATLAS, OBJECTS, PRODUCT_STATIONS, STATIC_INTERACTIONS, LIGHTS } from "./world.js";

const canvas = document.getElementById("showroom-canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const VIEW = { width: 640, height: 360 };
const SCALE = canvas.width / VIEW.width;
const keys = new Set();
const camera = { x: 0, y: 0 };
const player = { x: 620, y: 650, facing: "up", directionX: 0, directionY: -1, frame: 0, phase: 0, moving: false };
const cart = { x: 342, y: 634, attached: false, facing: "left", items: [] };
const runtimeProducts = PRODUCT_STATIONS.map((station) => ({ ...station, product: null, picked: false }));
const prompt = document.getElementById("showroom-prompt");
const cartList = document.getElementById("showroom-cart-items");
const cartCount = document.getElementById("showroom-cart-count");
const picker = document.getElementById("showroom-size-picker");
const toast = document.getElementById("showroom-toast");
const assets = {};
let target = null;
let lastFrame = performance.now();
let messageUntil = 0;
let checkoutBusy = false;

const dust = Array.from({ length: 80 }, (_, index) => ({
    x: ROOM.left + (index * 137) % (ROOM.right - ROOM.left),
    y: ROOM.top + (index * 79) % (ROOM.bottom - ROOM.top),
    speed: .012 + (index % 5) * .005,
    alpha: .045 + (index % 4) * .018,
}));

function loadImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source;
    });
}

async function loadAssets() {
    [assets.player, assets.furniture, assets.products, assets.tiles, assets.cart] = await Promise.all([
        loadImage("showroom/assets/player.png"),
        loadImage("showroom/assets/furniture.png"),
        loadImage("showroom/assets/products.png"),
        loadImage("showroom/assets/tiles.png"),
        loadImage("showroom/assets/cart-directions.png"),
    ]);
    ctx.imageSmoothingEnabled = false;
}

function atlas(frameName, x, y, scale = 1) {
    const [sx, sy, width, height] = ATLAS[frameName];
    ctx.drawImage(assets.furniture, sx, sy, width, height, Math.round(x), Math.round(y), width * scale, height * scale);
}

function drawBackdrop(time) {
    ctx.fillStyle = "#080a0a"; ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    for (let y = 26; y < ROOM.top + 52; y += 64) {
        for (let x = ROOM.left; x < ROOM.right; x += 64) ctx.drawImage(assets.tiles, 64, 0, 64, 64, x, y, 64, 64);
    }
    ctx.fillStyle = "#101211"; ctx.fillRect(ROOM.left - 14, ROOM.top - 16, ROOM.right - ROOM.left + 28, 22);
    ctx.fillStyle = "#050606"; ctx.fillRect(ROOM.left - 22, ROOM.top + 1, 22, ROOM.bottom - ROOM.top + 20); ctx.fillRect(ROOM.right, ROOM.top, 22, ROOM.bottom - ROOM.top + 20);
    for (let y = ROOM.top; y < ROOM.bottom; y += 64) {
        for (let x = ROOM.left; x < ROOM.right; x += 64) ctx.drawImage(assets.tiles, 0, 0, 64, 64, x, y, 64, 64);
    }
    // Floor joins and damp reflections.
    ctx.strokeStyle = "rgba(7,8,8,.5)"; ctx.lineWidth = 2;
    for (let x = ROOM.left; x <= ROOM.right; x += 128) { ctx.beginPath(); ctx.moveTo(x, ROOM.top); ctx.lineTo(x, ROOM.bottom); ctx.stroke(); }
    for (let y = ROOM.top; y <= ROOM.bottom; y += 96) { ctx.beginPath(); ctx.moveTo(ROOM.left, y); ctx.lineTo(ROOM.right, y); ctx.stroke(); }
    ctx.fillStyle = `rgba(213,180,118,${.025 + Math.sin(time * .0014) * .006})`;
    ctx.beginPath(); ctx.ellipse(805, 369, 160, 34, -.1, 0, Math.PI * 2); ctx.fill();
    // Pipes and wall lamps.
    ctx.strokeStyle = "#34322d"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(65, 45); ctx.lineTo(1215, 45); ctx.stroke();
    ctx.strokeStyle = "#171918"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(65, 45); ctx.lineTo(1215, 45); ctx.stroke();
    [270, 690, 1110].forEach((x, index) => {
        const flicker = .78 + Math.sin(time * (.006 + index * .0007)) * .13;
        ctx.fillStyle = `rgba(230,197,137,${flicker})`; ctx.fillRect(x, 126, 72, 4);
        ctx.fillStyle = "#27251f"; ctx.fillRect(x - 4, 121, 80, 4);
    });
    ctx.fillStyle = "rgba(192,179,145,.45)"; ctx.font = "10px monospace"; ctx.fillText("STAFF ONLY", 116, 151);
}

function drawObject(object) {
    atlas(object.frame, object.x, object.y);
}

function drawProduct(station) {
    if (station.picked) return;
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(station.x + 32, station.y + 57, 27, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(assets.products, station.sprite * 64, 0, 64, 64, station.x, station.y, 64, 64);
}

function drawPlayer(time) {
    const row = ({ down: 0, left: 1, right: 2, up: 3 })[player.facing];
    const frame = player.moving ? Math.floor(player.phase) % 4 : Math.floor(time / 620) % 2;
    ctx.drawImage(assets.player, frame * 32, row * 48, 32, 48, Math.round(player.x - 16), Math.round(player.y - 42), 32, 48);
}

function drawCart() {
    ctx.save(); ctx.translate(Math.round(cart.x), Math.round(cart.y));
    const frame = ({ down: 0, left: 1, right: 2, up: 3 })[cart.facing];
    ctx.drawImage(assets.cart, frame * 80, 0, 80, 64, -40, -44, 80, 64);
    cart.items.slice(0, 5).forEach((item, index) => {
        const station = runtimeProducts.find((candidate) => candidate.id === item.stationId);
        if (!station) return;
        const x = -17 + (index % 3) * 13; const y = -31 + Math.floor(index / 3) * 11;
        ctx.drawImage(assets.products, station.sprite * 64, 0, 64, 64, x, y, 14, 14);
    });
    ctx.restore();
}

function drawLighting(time) {
    ctx.save(); ctx.globalCompositeOperation = "screen";
    LIGHTS.forEach((light, index) => {
        const pulse = 1 + Math.sin(time * light.speed + index * 1.7) * .08 + Math.sin(time * .017 + index) * .018;
        const radius = light.radius * pulse; const [r, g, b] = light.color;
        const gradient = ctx.createRadialGradient(light.x, light.y, 2, light.x, light.y, radius);
        gradient.addColorStop(0, `rgba(${r},${g},${b},${light.strength})`);
        gradient.addColorStop(.3, `rgba(${r},${g},${b},${light.strength * .35})`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gradient; ctx.fillRect(light.x - radius, light.y - radius, radius * 2, radius * 2);
    });
    ctx.restore();
    dust.forEach((particle) => {
        particle.y -= particle.speed; if (particle.y < ROOM.top) particle.y = ROOM.bottom;
        ctx.fillStyle = `rgba(235,218,178,${particle.alpha * (.6 + Math.sin(time * .002 + particle.x) * .3)})`;
        ctx.fillRect(Math.round(particle.x), Math.round(particle.y), 1, 1);
    });
}

function draw(time) {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0); ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    ctx.save(); ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
    drawBackdrop(time);
    const renderQueue = [
        ...OBJECTS.map((object) => ({ sortY: object.sortY, draw: () => drawObject(object) })),
        ...runtimeProducts.filter((station) => !station.picked).map((station) => ({ sortY: station.sortY, draw: () => drawProduct(station) })),
        { sortY: player.y, draw: () => drawPlayer(time) },
        { sortY: cart.y, draw: drawCart },
    ].sort((a, b) => a.sortY - b.sortY);
    renderQueue.forEach((entity) => entity.draw());
    drawLighting(time);
    ctx.restore();
    const vignette = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, 100, VIEW.width / 2, VIEW.height / 2, 410);
    vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(1, "rgba(0,0,0,.54)"); ctx.fillStyle = vignette; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function collisionAt(x, y, radiusX = 10, radiusY = 7, ignoreParkedCart = false) {
    if (x - radiusX < ROOM.left || x + radiusX > ROOM.right || y - radiusY < ROOM.top + 16 || y + radiusY > ROOM.bottom) return true;
    if (!ignoreParkedCart && !cart.attached && x + radiusX > cart.x - 35 && x - radiusX < cart.x + 35 && y + radiusY > cart.y - 18 && y - radiusY < cart.y + 18) return true;
    return OBJECTS.some((object) => object.collision && x + radiusX > object.collision[0] && x - radiusX < object.collision[0] + object.collision[2] && y + radiusY > object.collision[1] && y - radiusY < object.collision[1] + object.collision[3]);
}

function desiredCartPosition(x = player.x, y = player.y) {
    const offset = {
        down: { x: 0, y: 38 }, left: { x: -45, y: 5 },
        right: { x: 45, y: 5 }, up: { x: 0, y: -31 },
    }[player.facing];
    return { x: x + offset.x, y: y + offset.y };
}

function cartCollisionAt(playerX, playerY) {
    if (!cart.attached) return false;
    const next = desiredCartPosition(playerX, playerY);
    const vertical = player.facing === "up" || player.facing === "down";
    return collisionAt(next.x, next.y, vertical ? 17 : 28, vertical ? 25 : 14, true);
}

function update(delta, time) {
    const speed = Math.min(4, delta * .18); let dx = 0; let dy = 0;
    if (keys.has("a") || keys.has("left")) dx -= speed;
    if (keys.has("d") || keys.has("right")) dx += speed;
    if (keys.has("w") || keys.has("up")) dy -= speed;
    if (keys.has("s") || keys.has("down")) dy += speed;
    if (target) {
        const distance = Math.hypot(target.x - player.x, target.y - player.y);
        if (distance < 5) target = null;
        else { dx = (target.x - player.x) / distance * speed; dy = (target.y - player.y) / distance * speed; }
    }
    player.moving = Boolean(dx || dy);
    if (player.moving) {
        const magnitude = Math.hypot(dx, dy) || 1; player.directionX = dx / magnitude; player.directionY = dy / magnitude;
        if (Math.abs(dx) > Math.abs(dy)) player.facing = dx < 0 ? "left" : "right"; else player.facing = dy < 0 ? "up" : "down";
        player.phase += Math.hypot(dx, dy) * .13;
    }
    if (!collisionAt(player.x + dx, player.y) && !cartCollisionAt(player.x + dx, player.y)) player.x += dx; else target = null;
    if (!collisionAt(player.x, player.y + dy) && !cartCollisionAt(player.x, player.y + dy)) player.y += dy; else target = null;
    if (cart.attached) {
        const desired = desiredCartPosition(); cart.x += (desired.x - cart.x) * .28; cart.y += (desired.y - cart.y) * .28;
        cart.facing = player.facing;
    }
    const desiredCameraX = Math.max(0, Math.min(WORLD.width - VIEW.width, player.x - VIEW.width * .5));
    const desiredCameraY = Math.max(0, Math.min(WORLD.height - VIEW.height, player.y - VIEW.height * .55));
    camera.x += (desiredCameraX - camera.x) * Math.min(1, delta * .005); camera.y += (desiredCameraY - camera.y) * Math.min(1, delta * .005);
    if (time > messageUntil) {
        const interaction = nearestInteraction(); prompt.textContent = interaction ? `E — ${interaction.label}` : "WASD / ARROWS TO WALK";
    }
}

function nearestInteraction() {
    const candidates = [];
    if (!cart.attached) candidates.push({ type: "cart", id: "cart", x: cart.x, y: cart.y, radius: 72, label: "TAKE CART" });
    runtimeProducts.filter((station) => !station.picked).forEach((station) => candidates.push({ type: "product", ...station, x: station.interactX, y: station.interactY, radius: 76, label: `TAKE ${station.product?.name || station.product?.title || station.fallbackName}` }));
    STATIC_INTERACTIONS.forEach((interaction) => candidates.push({ type: "static", ...interaction }));
    let nearest = null; let distance = Infinity;
    candidates.forEach((candidate) => { const current = Math.hypot(player.x - candidate.x, player.y - candidate.y); if (current < candidate.radius && current < distance) { nearest = candidate; distance = current; } });
    return nearest;
}

function flash(message, error = false) {
    prompt.textContent = message; prompt.classList.toggle("error", error); toast.textContent = message; toast.classList.toggle("error", error); toast.classList.add("visible");
    messageUntil = performance.now() + 2600; window.setTimeout(() => toast.classList.remove("visible"), 2500);
}

function interact() {
    const interaction = nearestInteraction(); if (!interaction) { flash("MOVE CLOSER", true); return; }
    if (interaction.type === "cart") { cart.attached = true; cart.facing = player.facing; flash("CART ACQUIRED"); updateCartUI(); return; }
    if (interaction.type === "product") {
        if (!cart.attached) { flash("TAKE A CART FIRST", true); return; }
        const station = runtimeProducts.find((candidate) => candidate.id === interaction.id);
        if (!station.product) { flash("PRODUCT IS NOT PUBLISHED IN BACKEND", true); return; }
        openSizePicker(station); return;
    }
    if (interaction.id === "checkout") { void transferToWebCart(); return; }
    if (interaction.id === "staff") { flash("STAFF ONLY / ACCESS DENIED", true); return; }
    if (interaction.id === "vending") { flash("COFFEE NODE / OUT OF SERVICE"); return; }
    if (interaction.id === "crt") { flash("DROP SIGNAL / ONLINE"); return; }
    if (interaction.id === "pile") { flash("ARCHIVE FABRIC / NOT FOR SALE"); }
}

function openSizePicker(station) {
    const variants = (station.product.variants || []).filter((variant) => variant.isActive !== false && (variant.available ?? variant.stock ?? 0) > 0);
    if (!variants.length) { flash("OUT OF STOCK", true); return; }
    document.getElementById("showroom-picker-title").textContent = station.product.name || station.product.title || station.fallbackName;
    const options = document.getElementById("showroom-size-options"); options.replaceChildren();
    variants.forEach((variant) => {
        const button = document.createElement("button"); button.type = "button"; button.textContent = `${variant.size} / ${variant.available ?? variant.stock} LEFT`;
        button.addEventListener("click", () => pickProduct(station, variant)); options.append(button);
    });
    picker.classList.remove("hidden");
}

function pickProduct(station, variant) {
    const product = station.product;
    cart.items.push({ stationId: station.id, productId: product.id, name: product.name || product.title, size: variant.size, priceMinor: variant.priceMinor, currency: variant.currency, image: product.images?.[0]?.url || "", transferred: false });
    station.picked = true; picker.classList.add("hidden"); persistGameCart(); updateCartUI(); flash(`${product.name || product.title} / ${variant.size} ADDED`);
}

function persistGameCart() {
    sessionStorage.setItem("yo-showroom-cart", JSON.stringify(cart.items.map(({ stationId, productId, name, size, transferred }) => ({ stationId, productId, name, size, transferred }))));
}

function restoreGameCart() {
    try {
        const stored = JSON.parse(sessionStorage.getItem("yo-showroom-cart") || "[]");
        if (!Array.isArray(stored)) return;
        stored.forEach((saved) => {
            const station = runtimeProducts.find((candidate) => candidate.id === saved.stationId); const product = station?.product;
            const variant = product?.variants?.find((candidate) => candidate.size === saved.size);
            if (!station || !product || !variant) return;
            station.picked = true; cart.items.push({ ...saved, priceMinor: variant.priceMinor, currency: variant.currency, image: product.images?.[0]?.url || "" });
        });
        if (cart.items.length) cart.attached = true;
    } catch { sessionStorage.removeItem("yo-showroom-cart"); }
}

function updateCartUI() {
    cartCount.textContent = String(cart.items.length); cartList.replaceChildren();
    if (!cart.items.length) { const empty = document.createElement("li"); empty.textContent = cart.attached ? "CART IS EMPTY" : "FIND THE CART"; cartList.append(empty); return; }
    cart.items.forEach((item) => { const row = document.createElement("li"); const name = document.createElement("span"); const size = document.createElement("small"); name.textContent = item.name; size.textContent = item.size; row.append(name, size); cartList.append(row); });
}

async function transferToWebCart() {
    if (checkoutBusy) return;
    if (!cart.attached) { flash("BRING A CART TO CHECKOUT", true); return; }
    if (!cart.items.length) { flash("CART IS EMPTY", true); return; }
    checkoutBusy = true; flash("SYNCING WITH SECURE CART");
    try {
        for (const item of cart.items) {
            if (item.transferred) continue;
            await YOApi.addCartItem({ productId: item.productId, size: item.size, quantity: 1 }); item.transferred = true; persistGameCart();
        }
        sessionStorage.removeItem("yo-showroom-cart"); window.location.href = "cart.html";
    } catch (error) {
        checkoutBusy = false;
        if (error.status === 401) { persistGameCart(); window.location.href = `auth.html?return=${encodeURIComponent("enter.html")}`; return; }
        flash(error.message.toUpperCase(), true);
    }
}

async function loadProducts() {
    try {
        const [products, links] = await Promise.all([YOApi.getProducts(), YOApi.getGameAssetProductLinks()]);
        const productById = new Map(products.map((product) => [product.id, product]));
        const productIdByAsset = new Map(links.map((link) => [link.slug, link.productId]));
        runtimeProducts.forEach((station) => {
            station.product = productById.get(productIdByAsset.get(station.assetSlug)) || null;
        });
        restoreGameCart(); updateCartUI(); document.getElementById("showroom-signal").textContent = "BACKEND ONLINE";
    } catch { updateCartUI(); document.getElementById("showroom-signal").textContent = "EXHIBITION MODE"; }
}

function canvasPoint(event) { const bounds = canvas.getBoundingClientRect(); return { x: (event.clientX - bounds.left) / bounds.width * VIEW.width + camera.x, y: (event.clientY - bounds.top) / bounds.height * VIEW.height + camera.y }; }
function keyName(key) { return ({ ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" })[key] || key.toLowerCase(); }
function frame(time) { const delta = Math.min(34, time - lastFrame); lastFrame = time; update(delta, time); draw(time); requestAnimationFrame(frame); }

window.addEventListener("keydown", (event) => { if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(event.key)) event.preventDefault(); if (event.key.toLowerCase() === "e" || event.key === "Enter") { interact(); return; } keys.add(keyName(event.key)); target = null; });
window.addEventListener("keyup", (event) => keys.delete(keyName(event.key)));
canvas.addEventListener("pointerdown", (event) => { target = canvasPoint(event); });
document.getElementById("showroom-picker-close").addEventListener("click", () => picker.classList.add("hidden"));
document.getElementById("showroom-action").addEventListener("click", interact);

await loadAssets();
camera.x = Math.max(0, Math.min(WORLD.width - VIEW.width, player.x - VIEW.width / 2)); camera.y = Math.max(0, Math.min(WORLD.height - VIEW.height, player.y - VIEW.height * .55));
updateCartUI(); void loadProducts(); requestAnimationFrame(frame);
