// build.js
const fs = require('fs');
const path = require('path');

// Vercel Environment Variables - NEXT_PUBLIC_ is a convention for client-side exposure
const config = {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || ''
};

const content = `// js/config.js - BU DOSYA BUILD SIRASINDA OTOMATİK OLUŞTURULMUŞTUR.
window.CONFIG = ${JSON.stringify(config, null, 2)};
`;

const configPath = path.join(__dirname, 'js', 'config.js');

try {
    fs.writeFileSync(configPath, content);
} catch (err) {
    process.exit(1);
}
