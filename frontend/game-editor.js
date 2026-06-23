"use strict";

const canvas = document.getElementById("editor-canvas");
const ctx = canvas.getContext("2d");
const statusLine = document.getElementById("editor-status");
const palette = {
    barrier: [255, 70, 65], walkable: [72, 215, 130], stairsUp: [70, 135, 255],
    stairsDown: [159, 91, 235], occlusion: [236, 201, 75], baseline: [245, 245, 235], anchor: [255, 151, 55],
};
const categories = ["clothing","furniture","sewing","walls","floor","decor","machines","lights","staff-only","checkout","characters","spritesheet"];
const state = {
    assets: [], products: [], selected: null, image: null, config: null, mode: "asset", tool: "select", draft: [],
    drawing: false, history: [], future: [], zoom: 1, panX: 0, panY: 0, panDrag: null, pointDrag: null,
    preview: false, previewPlayer: { x: 0, y: 0, z: 0 }, keys: new Set(), lastTime: performance.now(),
    levels: [], level: { slug: "yo-showroom", name: "YO SHOWROOM", width: 1280, height: 768, isActive: true, objects: [] },
    selectedObject: null, objectDrag: null, levelImages: new Map(),
};

const clone = (value) => JSON.parse(JSON.stringify(value));
function setStatus(message, error = false) { statusLine.textContent = message.toUpperCase(); statusLine.classList.toggle("error", error); }
function apiImageUrl(path) {
    if (/^https?:/.test(path)) return path;
    return ["localhost", "127.0.0.1"].includes(location.hostname) ? `http://${location.hostname}:3000${path}` : path;
}
function loadImage(url) {
    return new Promise((resolve, reject) => { const image = new Image(); image.crossOrigin = "anonymous"; image.onload = () => resolve(image); image.onerror = reject; image.src = url; });
}
function canvasPoint(event) { const bounds = canvas.getBoundingClientRect(); return { x: (event.clientX - bounds.left) / bounds.width * canvas.width, y: (event.clientY - bounds.top) / bounds.height * canvas.height }; }
function assetOrigin() { return { x: canvas.width / 2 + state.panX, y: canvas.height / 2 + state.panY }; }
function screenToAsset(point) { const origin = assetOrigin(); return { x: (point.x - origin.x) / state.zoom + state.config.width / 2, y: (point.y - origin.y) / state.zoom + state.config.height / 2 }; }
function assetToScreen(point) { const origin = assetOrigin(); return { x: origin.x + (point.x - state.config.width / 2) * state.zoom, y: origin.y + (point.y - state.config.height / 2) * state.zoom }; }
function snap(value) { const size = Number(document.getElementById("snap-size").value); return size ? Math.round(value / size) * size : value; }

function remember() { if (!state.config) return; state.history.push(clone(state.config)); if (state.history.length > 100) state.history.shift(); state.future = []; }
function undo() { if (!state.history.length || !state.config) return; state.future.push(clone(state.config)); state.config = state.history.pop(); refreshInspector(); }
function redo() { if (!state.future.length || !state.config) return; state.history.push(clone(state.config)); state.config = state.future.pop(); refreshInspector(); }

function allShapes() {
    if (!state.config) return [];
    return [
        ...state.config.collisionMasks.map((shape, index) => ({ kind: "barrier", list: "collisionMasks", index, shape })),
        ...state.config.walkableMasks.map((shape, index) => ({ kind: "walkable", list: "walkableMasks", index, shape })),
        ...state.config.stairsZones.map((shape, index) => ({ kind: shape.type, list: "stairsZones", index, shape })),
        ...state.config.occlusionMasks.map((shape, index) => ({ kind: "occlusion", list: "occlusionMasks", index, shape })),
    ];
}

function pointInPolygon(point, points) {
    let inside = false;
    for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
        const a = points[index]; const b = points[previous];
        if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}
function distanceToSegment(point, a, b) {
    const dx = b.x - a.x; const dy = b.y - a.y; const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
    return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}
function shapeContains(point, shape) {
    if (shape.brushSize) return shape.points.some((value, index) => index && distanceToSegment(point, shape.points[index - 1], value) <= shape.brushSize / 2);
    return shape.points.length > 2 && pointInPolygon(point, shape.points);
}

function drawShape(shape, kind, editing = false) {
    if (!shape.points.length) return;
    const [r, g, b] = palette[kind]; ctx.strokeStyle = `rgba(${r},${g},${b},.95)`; ctx.fillStyle = `rgba(${r},${g},${b},.2)`;
    ctx.lineWidth = (shape.brushSize || 2) / state.zoom; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); shape.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    if (!shape.brushSize && shape.points.length > 2) { ctx.closePath(); ctx.fill(); } ctx.stroke();
    if (editing) shape.points.forEach((point) => { ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(point.x - 3 / state.zoom, point.y - 3 / state.zoom, 6 / state.zoom, 6 / state.zoom); });
}

function drawPlayer() {
    const player = state.previewPlayer; ctx.save(); ctx.translate(player.x, player.y - player.z);
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.beginPath(); ctx.ellipse(0, player.z, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#171d1d"; ctx.beginPath(); ctx.moveTo(-8,-22);ctx.quadraticCurveTo(0,-30,8,-22);ctx.lineTo(11,2);ctx.lineTo(-11,2);ctx.closePath();ctx.fill();
    ctx.fillStyle = "#ded9c8"; ctx.beginPath();ctx.arc(0,-25,6,0,Math.PI*2);ctx.fill();ctx.fillStyle="#111";ctx.fillRect(2,-27,2,2);ctx.restore();
}

function behindDepthBaseline() {
    if (!state.config.depthBaseline.length) return true;
    const average = state.config.depthBaseline.reduce((sum, point) => sum + point.y, 0) / state.config.depthBaseline.length;
    return state.previewPlayer.y < average;
}

function drawAssetEditor() {
    ctx.fillStyle = "#090b0b"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!state.config || !state.image) return;
    const origin = assetOrigin(); ctx.save(); ctx.translate(origin.x, origin.y); ctx.scale(state.zoom, state.zoom); ctx.translate(-state.config.width / 2, -state.config.height / 2);
    ctx.fillStyle = "#141616"; ctx.fillRect(0, 0, state.config.width, state.config.height);
    ctx.drawImage(state.image, 0, 0, state.config.width, state.config.height);
    if (state.preview) {
        drawPlayer();
        if (behindDepthBaseline()) state.config.occlusionMasks.forEach((mask) => {
            if (mask.points.length < 3) return; ctx.save();ctx.beginPath();mask.points.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));ctx.closePath();ctx.clip();ctx.drawImage(state.image,0,0,state.config.width,state.config.height);ctx.restore();
        });
    }
    if (document.getElementById("show-masks").checked) {
        allShapes().forEach(({ shape, kind }) => drawShape(shape, kind, state.tool === "select"));
        if (state.config.depthBaseline.length) drawShape({ points: state.config.depthBaseline }, "baseline", state.tool === "select");
        const anchor = state.config.anchor; ctx.strokeStyle = `rgb(${palette.anchor.join(",")})`;ctx.lineWidth=2/state.zoom;ctx.beginPath();ctx.moveTo(anchor.x-8/state.zoom,anchor.y);ctx.lineTo(anchor.x+8/state.zoom,anchor.y);ctx.moveTo(anchor.x,anchor.y-8/state.zoom);ctx.lineTo(anchor.x,anchor.y+8/state.zoom);ctx.stroke();
        if (state.draft.length) drawShape({ points: state.draft, ...(document.getElementById("draw-mode").value === "brush" ? { brushSize: Number(document.getElementById("brush-size").value) } : {}) }, state.tool === "baseline" ? "baseline" : state.tool);
    }
    ctx.restore();
}

function transformObject(object, asset, draw) {
    const config = asset.config; const image = state.levelImages.get(asset.id); if (!image) return;
    ctx.save();ctx.translate(object.x,object.y-object.z);ctx.rotate(object.rotation*Math.PI/180);ctx.scale((object.flipX?-1:1)*object.scaleX,(object.flipY?-1:1)*object.scaleY);ctx.translate(-config.anchor.x,-config.anchor.y);draw(image,config);ctx.restore();
}

function drawLevel() {
    ctx.fillStyle="#0a0c0c";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(state.panX,state.panY);ctx.scale(state.zoom,state.zoom);
    ctx.fillStyle="#171919";ctx.fillRect(0,0,state.level.width,state.level.height);ctx.strokeStyle="rgba(255,255,255,.055)";ctx.lineWidth=1/state.zoom;
    const grid=Number(document.getElementById("snap-size").value)||32;for(let x=0;x<=state.level.width;x+=grid){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,state.level.height);ctx.stroke();}for(let y=0;y<=state.level.height;y+=grid){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(state.level.width,y);ctx.stroke();}
    const sorted=[...state.level.objects].sort((a,b)=>(a.y+a.depthOffset)-(b.y+b.depthOffset));
    sorted.forEach((object)=>{const asset=state.assets.find((item)=>item.id===object.assetId);if(!asset)return;transformObject(object,asset,(image,config)=>{ctx.drawImage(image,0,0,config.width,config.height);if(document.getElementById("show-masks").checked){allAssetShapes(config).forEach(({shape,kind})=>drawRawShape(shape,kind));}});});
    if(state.selectedObject){const asset=state.assets.find((item)=>item.id===state.selectedObject.assetId);if(asset)transformObject(state.selectedObject,asset,(_image,config)=>{ctx.strokeStyle="#e4c75f";ctx.lineWidth=2/state.zoom;ctx.strokeRect(0,0,config.width,config.height);});}
    ctx.restore();
}
function allAssetShapes(config){return[...config.collisionMasks.map(shape=>({shape,kind:"barrier"})),...config.walkableMasks.map(shape=>({shape,kind:"walkable"})),...config.stairsZones.map(shape=>({shape,kind:shape.type})),...config.occlusionMasks.map(shape=>({shape,kind:"occlusion"}))];}
function drawRawShape(shape,kind){const [r,g,b]=palette[kind];ctx.strokeStyle=`rgba(${r},${g},${b},.9)`;ctx.fillStyle=`rgba(${r},${g},${b},.15)`;ctx.lineWidth=(shape.brushSize||2)/state.zoom;ctx.beginPath();shape.points.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));if(!shape.brushSize&&shape.points.length>2){ctx.closePath();ctx.fill();}ctx.stroke();}

function finishShape() {
    if (!state.config || state.draft.length < 2) { state.draft=[]; return; }
    remember(); const points=state.draft.map((point)=>({x:Math.round(point.x*100)/100,y:Math.round(point.y*100)/100})); const brush=document.getElementById("draw-mode").value==="brush"?{brushSize:Number(document.getElementById("brush-size").value)}:{};
    if(state.tool==="barrier")state.config.collisionMasks.push({type:"barrier",points,...brush});
    else if(state.tool==="walkable")state.config.walkableMasks.push({points,...brush});
    else if(state.tool==="occlusion")state.config.occlusionMasks.push({points,...brush});
    else if(state.tool==="baseline")state.config.depthBaseline=points;
    else if(state.tool==="stairsUp"||state.tool==="stairsDown"){
        const vectors={right:{x:1,y:0},left:{x:-1,y:0},up:{x:0,y:-1},down:{x:0,y:1}};
        state.config.stairsZones.push({type:state.tool,points,heightStart:Number(document.getElementById("height-start").value),heightEnd:Number(document.getElementById("height-end").value),slopeStrength:Number(document.getElementById("slope-strength").value),direction:vectors[document.getElementById("stairs-direction").value]});
    }
    state.draft=[];refreshInspector();
}

function nearestEditablePoint(point) {
    let nearest=null;let distance=12/state.zoom;
    const check=(points,list,index)=>points.forEach((value,pointIndex)=>{const current=Math.hypot(value.x-point.x,value.y-point.y);if(current<distance){nearest={points,list,index,pointIndex};distance=current;}});
    allShapes().forEach(({shape,list,index})=>check(shape.points,list,index));check(state.config.depthBaseline,"depthBaseline",0);return nearest;
}
function eraseAt(point){const entry=allShapes().find(({shape})=>shapeContains(point,shape));if(entry){remember();state.config[entry.list].splice(entry.index,1);refreshInspector();return;}if(state.config.depthBaseline.some((p)=>Math.hypot(p.x-point.x,p.y-point.y)<10/state.zoom)){remember();state.config.depthBaseline=[];refreshInspector();}}

function collisionBlocked(point) {
    if(state.config.walkableMasks.length&&!state.config.walkableMasks.some((shape)=>shapeContains(point,shape)))return true;
    return state.config.collisionMasks.some((shape)=>shapeContains(point,shape));
}
function updatePreview(delta){if(!state.preview||state.mode!=="asset")return;let dx=0,dy=0,speed=delta*.12;if(state.keys.has("a")||state.keys.has("left"))dx-=speed;if(state.keys.has("d")||state.keys.has("right"))dx+=speed;if(state.keys.has("w")||state.keys.has("up"))dy-=speed;if(state.keys.has("s")||state.keys.has("down"))dy+=speed;const next={x:Math.max(0,Math.min(state.config.width,state.previewPlayer.x+dx)),y:Math.max(0,Math.min(state.config.height,state.previewPlayer.y+dy))};if(!collisionBlocked({x:next.x,y:state.previewPlayer.y}))state.previewPlayer.x=next.x;if(!collisionBlocked({x:state.previewPlayer.x,y:next.y}))state.previewPlayer.y=next.y;state.previewPlayer.z=0;for(const zone of state.config.stairsZones){if(!shapeContains(state.previewPlayer,zone))continue;const xs=zone.points.map(p=>p.x),ys=zone.points.map(p=>p.y);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const direction=zone.direction;let progress=Math.abs(direction.x)>=Math.abs(direction.y)?(state.previewPlayer.x-minX)/Math.max(1,maxX-minX):(state.previewPlayer.y-minY)/Math.max(1,maxY-minY);if(direction.x<0||direction.y<0)progress=1-progress;progress=Math.max(0,Math.min(1,progress));state.previewPlayer.z=zone.heightStart+(zone.heightEnd-zone.heightStart)*progress*zone.slopeStrength;}}

function refreshInspector(){if(!state.selected||!state.config)return;document.getElementById("selected-asset-name").textContent=state.selected.name;document.getElementById("selected-asset-preview").src=apiImageUrl(state.config.image);document.getElementById("asset-size").textContent=`${state.config.width} × ${state.config.height}`;document.getElementById("asset-category-label").textContent=state.selected.category;document.getElementById("asset-product").value=state.selected.productId||"";const counts=[["BARRIERS",state.config.collisionMasks.length],["WALKABLE",state.config.walkableMasks.length],["STAIRS",state.config.stairsZones.length],["OCCLUSION",state.config.occlusionMasks.length],["DEPTH POINTS",state.config.depthBaseline.length]];const container=document.getElementById("mask-counts");container.replaceChildren(...counts.map(([label,value])=>{const span=document.createElement("span");span.textContent=`${label} ${value}`;return span;}));document.getElementById("delete-asset").disabled=state.selected.isBuiltIn;}

function renderProductOptions(){const select=document.getElementById("asset-product");const empty=new Option("NO PRODUCT / DECOR ONLY","");const options=state.products.map(product=>new Option(`${product.title} / ${product.status}`,product.id));select.replaceChildren(empty,...options);}

async function selectAsset(asset){state.selected=asset;state.config=clone(asset.config);state.image=await loadImage(apiImageUrl(asset.config.image));state.history=[];state.future=[];state.draft=[];state.zoom=Math.min(2.5,Math.max(.15,Math.min((canvas.width-100)/asset.width,(canvas.height-100)/asset.height)));state.panX=0;state.panY=0;state.previewPlayer={x:state.config.anchor.x,y:Math.max(0,state.config.anchor.y-20),z:0};document.querySelectorAll(".asset-card").forEach(card=>card.classList.toggle("active",card.dataset.id===asset.id));refreshInspector();}
function renderAssetList(){const search=document.getElementById("asset-search").value.trim().toLowerCase();const category=document.getElementById("asset-category").value;const list=document.getElementById("asset-list");list.replaceChildren();state.assets.filter(asset=>(!category||asset.category===category)&&(!search||`${asset.name} ${asset.category}`.toLowerCase().includes(search))).forEach(asset=>{const card=document.createElement("button");card.type="button";card.className="asset-card";card.dataset.id=asset.id;const image=document.createElement("img");image.src=apiImageUrl(asset.config.image);image.alt="";const name=document.createElement("strong");name.textContent=asset.name;const meta=document.createElement("small");meta.textContent=`${asset.category} · ${asset.width}×${asset.height}`;card.append(image,name,meta);card.addEventListener("click",()=>void selectAsset(asset));list.append(card);});}

async function uploadAsset(file){if(!file||file.type!=="image/png"){setStatus("PNG ONLY",true);return;}if(file.size>750000){setStatus("PNG LIMIT IS 750 KB",true);return;}const name=window.prompt("Asset name",file.name.replace(/\.png$/i,""));if(!name)return;const category=window.prompt(`Category: ${categories.join(", ")}`,"decor");if(!categories.includes(category)){setStatus("INVALID CATEGORY",true);return;}const imageBase64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});try{const asset=await YOApi.uploadGameAsset({name,category,imageBase64});state.assets.push(asset);renderAssetList();await selectAsset(asset);setStatus("ASSET UPLOADED");}catch(error){setStatus(error.message,true);}}

function switchMode(mode){state.mode=mode;document.querySelectorAll("[data-mode]").forEach(button=>button.classList.toggle("active",button.dataset.mode===mode));document.querySelectorAll("[data-toolbar]").forEach(toolbar=>toolbar.classList.toggle("hidden",toolbar.dataset.toolbar!==mode));document.querySelectorAll("[data-panel]").forEach(panel=>panel.classList.toggle("hidden",panel.dataset.panel!==mode));if(mode==="level")void preloadLevelImages();}
async function preloadLevelImages(){await Promise.all(state.assets.map(async asset=>{if(!state.levelImages.has(asset.id))state.levelImages.set(asset.id,await loadImage(apiImageUrl(asset.config.image)));}));}
function levelPoint(event){const point=canvasPoint(event);return{x:(point.x-state.panX)/state.zoom,y:(point.y-state.panY)/state.zoom};}
function objectAt(point){return[...state.level.objects].reverse().find(object=>{const asset=state.assets.find(item=>item.id===object.assetId);if(!asset)return false;const width=asset.width*object.scaleX,height=asset.height*object.scaleY;return point.x>=object.x-width/2&&point.x<=object.x+width/2&&point.y>=object.y-height&&point.y<=object.y;});}
function selectObject(object){state.selectedObject=object;const fields=document.getElementById("object-fields");fields.classList.toggle("disabled",!object);if(!object)return;fields.querySelectorAll("[data-object]").forEach(input=>{const key=input.dataset.object;input[input.type==="checkbox"?"checked":"value"]=object[key];});}
function addToLevel(){if(!state.selected){setStatus("SELECT AN ASSET",true);return;}const object={id:crypto.randomUUID(),assetId:state.selected.id,x:snap(state.level.width/2),y:snap(state.level.height/2),z:0,rotation:0,scaleX:1,scaleY:1,flipX:false,flipY:false,layer:"furniture",depthOffset:0,locked:false};state.level.objects.push(object);selectObject(object);switchMode("level");}
function duplicateObject(){if(!state.selectedObject)return;const copy={...clone(state.selectedObject),id:crypto.randomUUID(),x:state.selectedObject.x+16,y:state.selectedObject.y+16,locked:false};state.level.objects.push(copy);selectObject(copy);}
function removeObject(){if(!state.selectedObject||state.selectedObject.locked)return;state.level.objects=state.level.objects.filter(object=>object!==state.selectedObject);selectObject(null);}
function readLevelFields(){state.level.slug=document.getElementById("level-slug").value;state.level.name=document.getElementById("level-name").value;state.level.width=Number(document.getElementById("level-width").value);state.level.height=Number(document.getElementById("level-height").value);state.level.isActive=document.getElementById("level-active").checked;}
function applyLevel(level){const config=typeof level.config==="object"?level.config:{objects:[]};state.level={slug:level.slug,name:level.name,width:level.width,height:level.height,isActive:level.isActive,objects:clone(config.objects||[])};document.getElementById("level-slug").value=state.level.slug;document.getElementById("level-name").value=state.level.name;document.getElementById("level-width").value=state.level.width;document.getElementById("level-height").value=state.level.height;document.getElementById("level-active").checked=state.level.isActive;selectObject(null);}

function handleAssetPointerDown(event){const point=canvasPoint(event);if(event.button===1||event.buttons===4||event.shiftKey&&event.button===0){state.panDrag={point,startX:state.panX,startY:state.panY};return;}const assetPoint=screenToAsset(point);if(state.tool==="anchor"){remember();state.config.anchor={x:assetPoint.x,y:assetPoint.y};refreshInspector();return;}if(state.tool==="erase"){eraseAt(assetPoint);return;}if(state.tool==="select"){const editable=nearestEditablePoint(assetPoint);if(editable){remember();state.pointDrag=editable;}return;}state.drawing=true;if(document.getElementById("draw-mode").value==="brush")state.draft=[assetPoint];else state.draft.push(assetPoint);}
function handleLevelPointerDown(event){const point=levelPoint(event);if(event.button===1||event.buttons===4){const raw=canvasPoint(event);state.panDrag={point:raw,startX:state.panX,startY:state.panY};return;}let object=objectAt(point);if(event.altKey&&object){object={...clone(object),id:crypto.randomUUID(),x:object.x+8,y:object.y+8,locked:false};state.level.objects.push(object);}selectObject(object||null);if(object&&!object.locked)state.objectDrag={object,offsetX:point.x-object.x,offsetY:point.y-object.y,startX:object.x,startY:object.y};}

canvas.addEventListener("pointerdown",event=>{canvas.setPointerCapture(event.pointerId);state.mode==="asset"?handleAssetPointerDown(event):handleLevelPointerDown(event);});
canvas.addEventListener("pointermove",event=>{const point=canvasPoint(event);if(state.panDrag){state.panX=state.panDrag.startX+point.x-state.panDrag.point.x;state.panY=state.panDrag.startY+point.y-state.panDrag.point.y;return;}if(state.mode==="asset"){const assetPoint=screenToAsset(point);if(state.pointDrag){state.pointDrag.points[state.pointDrag.pointIndex]={x:assetPoint.x,y:assetPoint.y};return;}if(state.drawing&&document.getElementById("draw-mode").value==="brush")state.draft.push(assetPoint);}else if(state.objectDrag){const level=levelPoint(event);let x=level.x-state.objectDrag.offsetX,y=level.y-state.objectDrag.offsetY;if(event.shiftKey){if(Math.abs(x-state.objectDrag.startX)>Math.abs(y-state.objectDrag.startY))y=state.objectDrag.startY;else x=state.objectDrag.startX;}state.objectDrag.object.x=snap(x);state.objectDrag.object.y=snap(y);selectObject(state.objectDrag.object);}});
canvas.addEventListener("pointerup",()=>{if(state.drawing&&document.getElementById("draw-mode").value==="brush")finishShape();state.drawing=false;state.panDrag=null;state.pointDrag=null;state.objectDrag=null;});
canvas.addEventListener("dblclick",()=>finishShape());
canvas.addEventListener("wheel",event=>{event.preventDefault();const before=state.mode==="asset"&&state.config?screenToAsset(canvasPoint(event)):levelPoint(event);const factor=event.deltaY<0?1.12:.89;state.zoom=Math.max(.1,Math.min(8,state.zoom*factor));const point=canvasPoint(event);if(state.mode==="asset"&&state.config){const after=assetToScreen(before);state.panX+=point.x-after.x;state.panY+=point.y-after.y;}},{passive:false});

document.querySelectorAll("[data-tool]").forEach(button=>button.addEventListener("click",()=>{state.tool=button.dataset.tool;state.draft=[];document.querySelectorAll("[data-tool]").forEach(item=>item.classList.toggle("active",item===button));}));
document.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>switchMode(button.dataset.mode)));
document.getElementById("finish-shape").addEventListener("click",finishShape);document.getElementById("undo-editor").addEventListener("click",undo);document.getElementById("redo-editor").addEventListener("click",redo);
document.getElementById("preview-asset").addEventListener("click",event=>{state.preview=!state.preview;event.currentTarget.classList.toggle("active",state.preview);event.currentTarget.textContent=state.preview?"STOP":"PLAY";});
document.getElementById("upload-trigger").addEventListener("click",()=>document.getElementById("asset-upload").click());document.getElementById("asset-upload").addEventListener("change",event=>void uploadAsset(event.target.files[0]));
document.getElementById("asset-search").addEventListener("input",renderAssetList);document.getElementById("asset-category").addEventListener("change",renderAssetList);
document.getElementById("save-asset-config").addEventListener("click",async()=>{if(!state.selected)return;try{const productId=document.getElementById("asset-product").value||null;const updated=await YOApi.saveGameAssetConfig(state.selected.id,state.config,productId);Object.assign(state.selected,{config:updated.config,productId:updated.productId,product:updated.product});state.config=clone(updated.config);refreshInspector();setStatus(productId?"ASSET LINKED AND SAVED":"ASSET SAVED AS DECOR");}catch(error){setStatus(error.message,true);}});
document.getElementById("delete-asset").addEventListener("click",async()=>{if(!state.selected||state.selected.isBuiltIn)return;if(!window.confirm(`Delete ${state.selected.name}?`))return;try{await YOApi.deleteGameAsset(state.selected.id);state.assets=state.assets.filter(asset=>asset.id!==state.selected.id);state.selected=null;state.config=null;state.image=null;renderAssetList();setStatus("ASSET DELETED");}catch(error){setStatus(error.message,true);}});
document.getElementById("add-to-level").addEventListener("click",addToLevel);document.getElementById("duplicate-object").addEventListener("click",duplicateObject);document.getElementById("delete-object").addEventListener("click",removeObject);
document.getElementById("reset-object").addEventListener("click",()=>{if(!state.selectedObject)return;Object.assign(state.selectedObject,{z:0,rotation:0,scaleX:1,scaleY:1,flipX:false,flipY:false,depthOffset:0});selectObject(state.selectedObject);});
document.querySelectorAll("[data-object]").forEach(input=>input.addEventListener("input",()=>{if(!state.selectedObject)return;const key=input.dataset.object;state.selectedObject[key]=input.type==="checkbox"?input.checked:(input.type==="number"?Number(input.value):input.value);}));
document.getElementById("save-level").addEventListener("click",async()=>{readLevelFields();try{const saved=await YOApi.saveGameLevel(state.level);applyLevel(saved);setStatus("LEVEL SAVED");}catch(error){setStatus(error.message,true);}});
document.getElementById("export-level").addEventListener("click",()=>{readLevelFields();document.getElementById("level-json").value=JSON.stringify(state.level,null,2);});
document.getElementById("import-level").addEventListener("click",()=>{try{const data=JSON.parse(document.getElementById("level-json").value);applyLevel({...data,config:{objects:data.objects||data.config?.objects||[]}});setStatus("LEVEL JSON LOADED");}catch{setStatus("INVALID LEVEL JSON",true);}});

window.addEventListener("keydown",event=>{const key=({ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down"})[event.key]||event.key.toLowerCase();if((event.ctrlKey||event.metaKey)&&key==="z"){event.preventDefault();event.shiftKey?redo():undo();return;}if((event.ctrlKey||event.metaKey)&&key==="y"){event.preventDefault();redo();return;}if(event.key==="Enter"&&state.mode==="asset"&&!state.preview){finishShape();return;}if(event.key==="Escape"){state.draft=[];state.preview=false;return;}state.keys.add(key);});window.addEventListener("keyup",event=>state.keys.delete((({ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down"})[event.key]||event.key.toLowerCase())));

function loop(time){const delta=Math.min(34,time-state.lastTime);state.lastTime=time;updatePreview(delta);state.mode==="asset"?drawAssetEditor():drawLevel();requestAnimationFrame(loop);}

async function boot(){try{const admin=await YOApi.getCurrentUser();if(!admin||admin.role!=="SUPER_ADMIN"){location.replace("auth.html?return=game-editor.html");return;}document.getElementById("editor-identity").textContent=`${admin.email} / SUPER_ADMIN`;categories.forEach(category=>document.getElementById("asset-category").add(new Option(category.toUpperCase(),category)));[state.assets,state.levels,state.products]=await Promise.all([YOApi.getGameAssets(),YOApi.getGameLevels(),YOApi.request("/admin/products",{auth:true})]);renderProductOptions();renderAssetList();if(state.levels.length)applyLevel(state.levels[0]);document.getElementById("editor-gate").remove();document.getElementById("editor-app").classList.remove("hidden");if(state.assets.length)await selectAsset(state.assets[0]);requestAnimationFrame(loop);}catch(error){document.getElementById("editor-gate").querySelector("span").textContent=error.message.toUpperCase();}}

void boot();
