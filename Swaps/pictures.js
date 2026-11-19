/**
 * Pictures for the "picture" levels, drawn as SVG. Each one fills a
 * width x height box (the board's shape), and every tile shows the piece of
 * its goal cell. Details are spread out so that no two pieces look alike.
 */
const SwapsPictures = {
    hills(w, h) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
            <defs>
                <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#3d4f8a"/>
                    <stop offset="0.45" stop-color="#c77d8e"/>
                    <stop offset="0.7" stop-color="#f3b27a"/>
                </linearGradient>
            </defs>
            <rect width="${w}" height="${h}" fill="url(#sky)"/>
            <g fill="#fff8e6" opacity="0.9">
                <circle cx="${w * 0.08}" cy="${h * 0.07}" r="3"/>
                <circle cx="${w * 0.36}" cy="${h * 0.13}" r="2"/>
                <circle cx="${w * 0.6}" cy="${h * 0.05}" r="2.5"/>
                <circle cx="${w * 0.9}" cy="${h * 0.16}" r="3"/>
                <circle cx="${w * 0.17}" cy="${h * 0.2}" r="1.8"/>
            </g>
            <circle cx="${w * 0.66}" cy="${h * 0.42}" r="${w * 0.13}" fill="#ffd77a"/>
            <circle cx="${w * 0.66}" cy="${h * 0.42}" r="${w * 0.17}" fill="#ffd77a" opacity="0.25"/>
            <path d="M${w * 0.12} ${h * 0.3} q8 -8 16 0 q8 -8 16 0" stroke="#2f2a40" stroke-width="3" fill="none"/>
            <path d="M${w * 0.33} ${h * 0.36} q6 -6 12 0 q6 -6 12 0" stroke="#2f2a40" stroke-width="2.5" fill="none"/>
            <path d="M0 ${h * 0.6} Q${w * 0.25} ${h * 0.42} ${w * 0.55} ${h * 0.58} T${w} ${h * 0.5} V${h} H0Z" fill="#6c8f7a"/>
            <path d="M0 ${h * 0.78} Q${w * 0.3} ${h * 0.6} ${w * 0.62} ${h * 0.74} T${w} ${h * 0.7} V${h} H0Z" fill="#4c7262"/>
            <path d="M0 ${h * 0.93} Q${w * 0.4} ${h * 0.8} ${w} ${h * 0.9} V${h} H0Z" fill="#2f5249"/>
            <path d="M${w * 0.42} ${h} C${w * 0.46} ${h * 0.9} ${w * 0.6} ${h * 0.86} ${w * 0.55} ${h * 0.74}" stroke="#e8d6b0" stroke-width="${w * 0.03}" fill="none" stroke-linecap="round"/>
            <rect x="${w * 0.19}" y="${h * 0.6}" width="${w * 0.025}" height="${h * 0.1}" fill="#3a2b25"/>
            <circle cx="${w * 0.2}" cy="${h * 0.58}" r="${w * 0.06}" fill="#2f5249"/>
            <rect x="${w * 0.8}" y="${h * 0.62}" width="${w * 0.07}" height="${h * 0.07}" fill="#f2e6cf"/>
            <path d="M${w * 0.78} ${h * 0.63} L${w * 0.835} ${h * 0.57} L${w * 0.89} ${h * 0.63}Z" fill="#a8483c"/>
        </svg>`;
    },

    boat(w, h) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
            <defs>
                <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#7fb6d9"/>
                    <stop offset="1" stop-color="#e9f1f0"/>
                </linearGradient>
                <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#3f86a8"/>
                    <stop offset="1" stop-color="#1f4d6b"/>
                </linearGradient>
            </defs>
            <rect width="${w}" height="${h}" fill="url(#sky)"/>
            <g fill="#ffffff" opacity="0.9">
                <ellipse cx="${w * 0.14}" cy="${h * 0.16}" rx="${w * 0.09}" ry="${h * 0.05}"/>
                <ellipse cx="${w * 0.2}" cy="${h * 0.12}" rx="${w * 0.06}" ry="${h * 0.05}"/>
                <ellipse cx="${w * 0.84}" cy="${h * 0.22}" rx="${w * 0.08}" ry="${h * 0.04}"/>
            </g>
            <circle cx="${w * 0.58}" cy="${h * 0.12}" r="${w * 0.05}" fill="#ffe08a"/>
            <rect y="${h * 0.6}" width="${w}" height="${h * 0.4}" fill="url(#sea)"/>
            <rect x="${w * 0.88}" y="${h * 0.3}" width="${w * 0.05}" height="${h * 0.3}" fill="#f4efe6"/>
            <rect x="${w * 0.88}" y="${h * 0.38}" width="${w * 0.05}" height="${h * 0.05}" fill="#c24b3a"/>
            <rect x="${w * 0.88}" y="${h * 0.5}" width="${w * 0.05}" height="${h * 0.05}" fill="#c24b3a"/>
            <path d="M${w * 0.87} ${h * 0.3} L${w * 0.905} ${h * 0.25} L${w * 0.94} ${h * 0.3}Z" fill="#3b3b4f"/>
            <path d="M${w * 0.47} ${h * 0.2} V${h * 0.6}" stroke="#4a3a2e" stroke-width="4"/>
            <path d="M${w * 0.475} ${h * 0.22} L${w * 0.66} ${h * 0.56} H${w * 0.475}Z" fill="#fbf7ee"/>
            <path d="M${w * 0.465} ${h * 0.28} L${w * 0.33} ${h * 0.56} H${w * 0.465}Z" fill="#f2b84b"/>
            <path d="M${w * 0.3} ${h * 0.6} H${w * 0.7} L${w * 0.63} ${h * 0.69} H${w * 0.37}Z" fill="#a8483c"/>
            <g stroke="#cfe6ee" stroke-width="3" fill="none" opacity="0.8" stroke-linecap="round">
                <path d="M${w * 0.05} ${h * 0.75} q10 -6 20 0 t20 0"/>
                <path d="M${w * 0.7} ${h * 0.8} q10 -6 20 0 t20 0"/>
                <path d="M${w * 0.3} ${h * 0.9} q10 -6 20 0 t20 0"/>
                <path d="M${w * 0.82} ${h * 0.95} q8 -5 16 0"/>
                <path d="M${w * 0.1} ${h * 0.93} q8 -5 16 0"/>
            </g>
            <path d="M${w * 0.2} ${h * 0.4} q6 -6 12 0 q6 -6 12 0" stroke="#33415a" stroke-width="2.5" fill="none"/>
        </svg>`;
    },

    // CSS url() for a picture sized to a cols x rows board
    url(name, cols, rows) {
        const svg = this[name](cols * 100, rows * 100).replace(/\s+/g, ' ');
        return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    }
};
