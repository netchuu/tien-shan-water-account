// Where the question box sends its requests. The AI key is kept on the server (a Vercel setting), never in this file.
window.WATER_AI = { endpoint: (/\.vercel\.app$/.test(location.hostname) ? '' : 'https://tien-shan-water-account.vercel.app') + '/api/ask' };
