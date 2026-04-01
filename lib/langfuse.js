const { Langfuse } = require("langfuse");

let langfuseInstance = null;

function getLangfuse() {
  if (langfuseInstance) return langfuseInstance;

  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;

  if (!secretKey || !publicKey) return null;

  langfuseInstance = new Langfuse({
    secretKey,
    publicKey,
    baseUrl: process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com",
  });

  return langfuseInstance;
}

async function flushLangfuse() {
  if (langfuseInstance) {
    await langfuseInstance.flushAsync();
  }
}

module.exports = { getLangfuse, flushLangfuse };
