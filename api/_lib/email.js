/**
 * Resend email client (CJS) for pollyglot.
 * Used for translation delivery and error notifications.
 */

const { Resend } = require("resend");

let resendInstance = null;

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendInstance) resendInstance = new Resend(apiKey);
  return resendInstance;
}

const FROM = process.env.RESEND_FROM_EMAIL || "noreply@pollyglot.app";

/**
 * Send a translation result via email.
 * @param {Object} opts
 * @param {string} opts.to
 * @param {string} opts.originalText
 * @param {string} opts.translatedText
 * @param {string} opts.targetLanguage
 */
async function sendTranslationEmail({
  to,
  originalText,
  translatedText,
  targetLanguage,
}) {
  const client = getResend();
  if (!client) return null;

  return client.emails.send({
    from: FROM,
    to,
    subject: `Your translation to ${targetLanguage}`,
    html: `<p><strong>Original:</strong> ${originalText}</p><p><strong>Translation (${targetLanguage}):</strong> ${translatedText}</p>`,
  });
}

module.exports = { getResend, sendTranslationEmail };
