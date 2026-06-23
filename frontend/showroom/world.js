export const WORLD = { width: 1280, height: 768 };
export const ROOM = { left: 64, top: 154, right: 1216, bottom: 718 };

export const ATLAS = {
    counter: [0, 0, 256, 128],
    pile: [256, 0, 192, 128],
    vending: [0, 128, 96, 128],
    crt: [96, 128, 64, 96],
    rack: [160, 128, 224, 128],
    table: [0, 256, 192, 112],
    cart: [192, 256, 80, 64],
    door: [272, 256, 80, 128],
    ac: [352, 256, 128, 64],
    logo: [0, 368, 128, 80],
    seller: [128, 368, 64, 96],
    sewing: [192, 368, 112, 80],
    boxes: [304, 368, 128, 96],
};

export const OBJECTS = [
    { id: "door", frame: "door", x: 108, y: 55, sortY: 183, collision: [108, 158, 80, 25], label: "STAFF ONLY" },
    { id: "logo", frame: "logo", x: 520, y: 61, sortY: 141, label: "YO WALL MARK" },
    { id: "ac", frame: "ac", x: 978, y: 66, sortY: 130, label: "AIR CONDITIONER" },
    { id: "vending", frame: "vending", x: 155, y: 195, sortY: 323, collision: [163, 298, 78, 35], label: "COFFEE VENDING" },
    { id: "crt", frame: "crt", x: 298, y: 235, sortY: 331, collision: [303, 306, 55, 30], label: "CRT MONITOR" },
    { id: "counter", frame: "counter", x: 682, y: 178, sortY: 304, collision: [699, 252, 222, 61], label: "CHECKOUT COUNTER" },
    { id: "seller", frame: "seller", x: 778, y: 161, sortY: 258, label: "SELLER" },
    { id: "pile", frame: "pile", x: 994, y: 222, sortY: 345, collision: [1010, 308, 166, 48], label: "FABRIC PILE" },
    { id: "sewing", frame: "sewing", x: 1035, y: 204, sortY: 285, label: "SEWING MACHINE" },
    { id: "rack-left", frame: "rack", x: 86, y: 348, sortY: 476, collision: [102, 435, 195, 43], label: "SHIRT RAIL" },
    { id: "table", frame: "table", x: 438, y: 365, sortY: 477, collision: [463, 435, 157, 53], label: "DISPLAY TABLE" },
    { id: "rack-right", frame: "rack", x: 824, y: 493, sortY: 621, collision: [840, 580, 195, 43], label: "OUTERWEAR RAIL" },
    { id: "boxes", frame: "boxes", x: 1052, y: 493, sortY: 590, collision: [1059, 552, 112, 50], label: "STOCK BOXES" },
];

export const PRODUCT_STATIONS = [
    { id: "tee", assetSlug: "builtin-black-lace-tee", fallbackName: "UNLINKED TEE ASSET", sprite: 0, x: 231, y: 410, interactX: 244, interactY: 510, sortY: 465 },
    { id: "pants", assetSlug: "builtin-black-pants", fallbackName: "UNLINKED PANTS ASSET", sprite: 1, x: 510, y: 398, interactX: 535, interactY: 520, sortY: 448 },
    { id: "jacket", assetSlug: "builtin-dark-jacket", fallbackName: "UNLINKED JACKET ASSET", sprite: 2, x: 914, y: 548, interactX: 930, interactY: 660, sortY: 603 },
];

export const STATIC_INTERACTIONS = [
    { id: "vending", x: 205, y: 338, radius: 68, label: "USE COFFEE VENDING" },
    { id: "crt", x: 330, y: 350, radius: 64, label: "WATCH DROP SIGNAL" },
    { id: "staff", x: 148, y: 192, radius: 60, label: "STAFF ONLY" },
    { id: "pile", x: 1080, y: 375, radius: 75, label: "INSPECT FABRIC ARCHIVE" },
    { id: "checkout", x: 804, y: 337, radius: 88, label: "CHECK OUT" },
];

export const LIGHTS = [
    { x: 148, y: 183, radius: 180, color: [224, 185, 119], strength: .18, speed: .0017 },
    { x: 590, y: 151, radius: 230, color: [225, 190, 128], strength: .15, speed: .0013 },
    { x: 804, y: 205, radius: 170, color: [221, 181, 113], strength: .18, speed: .0019 },
    { x: 1080, y: 212, radius: 185, color: [232, 199, 139], strength: .16, speed: .0015 },
    { x: 198, y: 258, radius: 115, color: [104, 143, 139], strength: .11, speed: .0022 },
];
