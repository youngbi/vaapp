
// =============================================================================
// CONFIGURATION & METADATA
// =============================================================================

function getManifest() {
    return JSON.stringify({
        "id": "rophim",
        "name": "RoPhim",
        "version": "1.0.1",
        "iconUrl": "https://www.rophim.la/favicon.ico",
        "isEnabled": true,
        "type": "MOVIE"
    });
}

function getHomeSections() {
    return JSON.stringify([
        { slug: 'phim-moi', title: 'Phim Mới', type: 'Horizontal', path: 'phimhay' },
        { slug: 'phim-le', title: 'Phim Lẻ', type: 'Horizontal', path: 'phim-le' },
        { slug: 'phim-bo', title: 'Phim Bộ', type: 'Horizontal', path: 'phim-bo' },
        { slug: 'hoat-hinh', title: 'Hoạt Hình', type: 'Horizontal', path: 'the-loai/hoat-hinh' }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: 'Phim Mới', slug: 'phimhay' },
        { name: 'Phim Lẻ', slug: 'phim-le' },
        { name: 'Phim Bộ', slug: 'phim-bo' },
        { name: 'Hoạt Hình', slug: 'the-loai/hoat-hinh' },
        { name: 'Hành Động', slug: 'the-loai/hanh-dong.2xCjTG' },
        { name: 'Tình Cảm', slug: 'the-loai/tinh-cam' },
        { name: 'Hài Hước', slug: 'the-loai/hai-huoc' },
        { name: 'Cổ Trang', slug: 'the-loai/co-trang' }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({
        sort: []
    });
}

// =============================================================================
// URL GENERATION
// =============================================================================

function getUrlList(slug, filtersJson) {
    var filters = JSON.parse(filtersJson || "{}");
    var page = filters.page || 1;
    var baseUrl = "https://www.rophim.la";
    var path = slug;
    if (slug.indexOf("http") === 0) return slug + (slug.indexOf("?") > -1 ? "&" : "?") + "page=" + page;
    if (slug.indexOf("/") !== 0) path = "/" + slug;
    return baseUrl + path + (path.indexOf("?") > -1 ? "&" : "?") + "page=" + page;
}

function getUrlSearch(keyword, filtersJson) {
    var filters = JSON.parse(filtersJson || "{}");
    var page = filters.page || 1;
    return "https://www.rophim.la/tim-kiem?q=" + encodeURIComponent(keyword) + "&page=" + page;
}

function getUrlDetail(slug) {
    if (slug.indexOf("http") === 0) return slug;
    if (slug.indexOf("/") === 0) return "https://www.rophim.la" + slug;
    return "https://www.rophim.la/phim/" + slug;
}

function getUrlCategories() { return "https://www.rophim.la/the-loai"; }
function getUrlCountries() { return "https://www.rophim.la/quoc-gia"; }
function getUrlYears() { return "[]"; }

// =============================================================================
// PARSERS
// =============================================================================

function parseListResponse(html) {
    var movies = [];
    // Split by sw-item
    var parts = html.split('class="sw-item"');

    for (var i = 1; i < parts.length; i++) {
        var itemHtml = parts[i];

        // Extract Link & ID
        var hrefMatch = itemHtml.match(/href="([^"]+)"/);
        var href = hrefMatch ? hrefMatch[1] : "";

        // Extract Image
        var imgMatch = itemHtml.match(/src="([^"]+)"/);
        var thumb = imgMatch ? imgMatch[1] : "";

        // Extract Title
        var titleMatch = itemHtml.match(/<h4 class="item-title[^"]*">[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
        var title = titleMatch ? titleMatch[1].trim() : "";

        // Extract Label (Quality/Episode)
        var labelMatch = itemHtml.match(/<div class="line-center line-pd">([^<]+)<\/div>/);
        var label = labelMatch ? labelMatch[1].trim() : "";

        if (href && title) {
            movies.push({
                id: href,
                title: cleanText(title),
                posterUrl: thumb,
                backdropUrl: thumb,
                year: 0,
                quality: label,
                episode_current: label,
                lang: ""
            });
        }
    }

    // Pagination
    var totalPages = 1;
    var totalPagesMatch = html.match(/class="page-link" href="[^"]+page=(\d+)"/g);
    if (totalPagesMatch) {
        var lastPageMatch = totalPagesMatch[totalPagesMatch.length - 1].match(/page=(\d+)/);
        if (lastPageMatch) totalPages = parseInt(lastPageMatch[1]);
    }

    return JSON.stringify({
        items: movies,
        pagination: {
            currentPage: 1, // Will be managed by app based on request
            totalPages: totalPages,
            totalItems: movies.length * totalPages,
            itemsPerPage: movies.length
        }
    });
}

function parseSearchResponse(html) {
    return parseListResponse(html);
}

function parseMovieDetail(html) {
    try {
        // Vietnamese Title
        var titleMatch = html.match(/<h2 class="heading-md media-name">([^<]+)<\/h2>/) || html.match(/<h1[^>]*>([^<]+)<\/h1>/);
        var title = titleMatch ? titleMatch[1].trim() : "Unknown";

        // English Title
        var aliasMatch = html.match(/<h2 class="alias-name[^"]*">([^<]+)<\/h2>/);
        var titleAlias = aliasMatch ? aliasMatch[1].trim() : "";

        // Description
        var descMatch = html.match(/<div class="description">([\s\S]*?)<\/div>/) || html.match(/<div class="movie-description">([\s\S]*?)<\/div>/);
        var description = descMatch ? cleanText(descMatch[1]) : "";

        // Thumbnail
        var thumbMatch = html.match(/class="v-thumbnail"[^>]*>[\s\S]*?src="([^"]+)"/) || html.match(/class="poster-image"[^>]*>[\s\S]*?src="([^"]+)"/);
        var thumb = thumbMatch ? thumbMatch[1] : "";

        // Episodes
        var servers = [];
        var episodes = [];

        // Check for "Xem Ngay" button for phim le
        var watchMatch = html.match(/<a[^>]+class="btn btn-primary btn-play"[^>]+href="([^"]+)"/);
        if (watchMatch) {
            var watchUrl = watchMatch[1];
            if (watchUrl.indexOf("http") !== 0) watchUrl = "https://www.rophim.la" + watchUrl;
            episodes.push({
                id: watchUrl,
                name: "Full",
                slug: "full"
            });
        }

        // Check for episode list (series)
        var epRegex = /<a class="item\s*" href="([^"]+)"[\s\S]*?<div class="ep-sort[^"]*">([^<]+)<\/div>/g;
        var match;
        while ((match = epRegex.exec(html)) !== null) {
            var url = match[1];
            var name = match[2].trim();
            if (url.indexOf("http") !== 0) url = "https://www.rophim.la" + url;
            episodes.push({
                id: url,
                name: name,
                slug: name
            });
        }

        if (episodes.length > 0) {
            servers.push({
                name: "Server Main",
                episodes: episodes
            });
        }

        return JSON.stringify({
            id: "",
            title: title + (titleAlias ? " (" + titleAlias + ")" : ""),
            posterUrl: thumb,
            backdropUrl: thumb,
            description: description,
            servers: servers,
            quality: "HD",
            lang: "Vietsub",
            year: 0,
            rating: 0,
            status: ""
        });
    } catch (e) {
        return "null";
    }
}

function parseDetailResponse(html) {
    try {
        // Extract iframe
        var iframeRegex = /<iframe[^>]+src="([^"]+)"/;
        var match = iframeRegex.exec(html);
        var streamUrl = match ? match[1] : "";

        if (streamUrl && streamUrl.indexOf("//") === 0) streamUrl = "https:" + streamUrl;

        return JSON.stringify({
            url: streamUrl,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.rophim.la/"
            },
            subtitles: []
        });
    } catch (e) {
        return "{}";
    }
}

function parseCategoriesResponse(html) { return "[]"; }
function parseCountriesResponse(html) { return "[]"; }
function parseYearsResponse(html) { return "[]"; }

function cleanText(text) {
    if (!text) return "";
    return text.replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}
