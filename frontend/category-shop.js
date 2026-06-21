"use strict";

function createProductCard(product) {
    const link = document.createElement("a");
    link.href = `product.html?id=${encodeURIComponent(product.slug)}`;
    link.className = "shop-card";

    const image = document.createElement("img");
    const preview = product.images[0];
    image.src = YOApi.imageUrl(preview?.url);
    image.alt = preview?.alt || product.title;
    image.loading = "lazy";

    const info = document.createElement("div");
    info.className = "shop-info";
    const name = document.createElement("p");
    name.textContent = product.title;
    const price = document.createElement("span");
    const available = product.variants.filter((variant) => variant.available > 0);
    const variants = available.length ? available : product.variants;
    const lowest = variants.reduce((current, variant) => !current || variant.priceMinor < current.priceMinor ? variant : current, null);
    price.textContent = lowest ? YOApi.formatMoney(lowest.priceMinor, lowest.currency) : "SOLD OUT";

    info.append(name, price);
    link.append(image, info);
    return link;
}

async function loadProducts() {
    const grid = document.getElementById("shop-grid");
    grid.style.gridTemplateColumns = "repeat(8, 1fr)";
    try {
        const products = await YOApi.getProducts(CATEGORY);
        const fragment = document.createDocumentFragment();
        products.forEach((product) => fragment.appendChild(createProductCard(product)));
        grid.replaceChildren(fragment);
        if (!products.length) {
            const empty = document.createElement("p");
            empty.className = "shop-message";
            empty.textContent = "COMING SOON";
            grid.appendChild(empty);
        }
    } catch (error) {
        const message = document.createElement("p");
        message.className = "shop-message";
        message.textContent = "THE COLLECTION IS TEMPORARILY UNAVAILABLE";
        grid.replaceChildren(message);
        console.error(error);
    }
}

function setColumns(columns) {
    const grid = document.getElementById("shop-grid");
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    const names = document.querySelectorAll(".shop-info p");
    const prices = document.querySelectorAll(".shop-info span");
    const infos = document.querySelectorAll(".shop-info");
    const settings = {
        2: ["60px", "120px", "24px", "18px", "4px", "14px", "14px"],
        4: ["40px", "80px", "18px", "13px", "3px", "10px", "12px"],
        6: ["25px", "50px", "12px", "11px", "2px", "8px", "10px"],
        8: ["15px", "30px", "8px", "9px", "1.5px", "6px", "8px"]
    }[columns];
    if (!settings) return;
    const [columnGap, rowGap, infoMargin, nameSize, letterSpacing, nameMargin, priceSize] = settings;
    grid.style.columnGap = columnGap;
    grid.style.rowGap = rowGap;
    infos.forEach((element) => { element.style.marginTop = infoMargin; });
    names.forEach((element) => {
        element.style.fontSize = nameSize;
        element.style.letterSpacing = letterSpacing;
        element.style.marginBottom = nameMargin;
    });
    prices.forEach((element) => { element.style.fontSize = priceSize; });
}

void loadProducts();
