"use strict";

async function loadSeasonNavigation() {
    try {
        const seasons = await YOApi.getSeasons(true);
        const published = seasons.filter((season) => season.status === "PUBLISHED");
        const archived = seasons.filter((season) => season.status === "ARCHIVED");
        document.querySelectorAll("[data-season-links]").forEach((container) => {
            container.replaceChildren(...published.map((season) => seasonLink(season)));
        });
        document.querySelectorAll("[data-archive-links]").forEach((container) => {
            const archive = document.createElement("a");
            archive.href = "archive.html"; archive.textContent = "VIEW ARCHIVE";
            container.replaceChildren(archive, ...archived.map((season) => seasonLink(season)));
        });
    } catch {
        // Keep the static S2 fallback if the API is temporarily unavailable.
    }
}

function seasonLink(season) {
    const link = document.createElement("a");
    link.href = `season.html?slug=${encodeURIComponent(season.slug)}`;
    link.textContent = `${season.code} — ${season.title}`;
    return link;
}

void loadSeasonNavigation();
