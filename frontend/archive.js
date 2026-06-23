"use strict";

async function loadArchive() {
    const container = document.getElementById("archive-seasons");
    try {
        const seasons = (await YOApi.getSeasons(true)).filter((season) => season.status === "ARCHIVED");
        container.replaceChildren(...seasons.map((season) => {
            const link = document.createElement("a");
            link.className = "archive-card";
            link.href = `season.html?slug=${encodeURIComponent(season.slug)}`;
            const image = document.createElement("img");
            image.src = YOApi.imageUrl(season.images[0]?.url); image.alt = season.images[0]?.alt || season.title;
            const meta = document.createElement("span"); meta.textContent = season.code;
            const title = document.createElement("h2"); title.textContent = season.title;
            link.append(image, meta, title); return link;
        }));
        if (!seasons.length) container.textContent = "THE ARCHIVE IS CURRENTLY EMPTY";
    } catch { container.textContent = "ARCHIVE TEMPORARILY UNAVAILABLE"; }
}

void loadArchive();
