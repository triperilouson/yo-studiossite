"use strict";

async function loadCollection() {
    const container = document.getElementById("looks-container");
    try {
        const querySlug = new URLSearchParams(window.location.search).get("slug");
        const previewToken = new URLSearchParams(window.location.search).get("preview");
        const slug = querySlug || (typeof COLLECTION_SLUG === "string" ? COLLECTION_SLUG : "");
        if (!slug) throw new Error("Season is not selected");
        const collection = previewToken ? await YOApi.getSeasonPreview(slug, previewToken) : await YOApi.getSeason(slug);
        document.title = `YO — ${collection.code} ${collection.title}`;
        document.querySelector(".shop-title").textContent = collection.code.toLowerCase();
        collection.images.forEach((source, index) => {
            const section = document.createElement("section");
            section.className = "look";
            const image = document.createElement("img");
            image.src = YOApi.imageUrl(source.url);
            image.alt = source.alt || collection.title;
            image.loading = index === 0 ? "eager" : "lazy";
            section.appendChild(image);
            if (index === 0) {
                const info = document.createElement("div");
                info.className = "look-info";
                const seasonMeta = document.createElement("p");
                seasonMeta.textContent = `${collection.code} / ${collection.status}`;
                const title = document.createElement("h2");
                title.textContent = collection.title;
                const description = document.createElement("span");
                description.textContent = collection.description;
                info.append(seasonMeta, title, description);
                section.appendChild(info);
            }
            container.appendChild(section);
        });
        if (!collection.images.length) {
            const empty = document.createElement("p");
            empty.className = "shop-message";
            empty.textContent = "COLLECTION COMING SOON";
            container.appendChild(empty);
        }
    } catch (error) {
        const message = document.createElement("p");
        message.className = "shop-message";
        message.textContent = "COLLECTION TEMPORARILY UNAVAILABLE";
        container.appendChild(message);
        console.error(error);
    }
}

window.addEventListener("scroll", () => {
    document.querySelectorAll(".look").forEach((look) => {
        const rect = look.getBoundingClientRect();
        const info = look.querySelector(".look-info");
        if (!info) return;
        info.classList.toggle("visible", rect.top < window.innerHeight * 0.8 && rect.bottom > window.innerHeight * 0.2);
    });
});

void loadCollection();
