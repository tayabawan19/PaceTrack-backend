/**
 * Sends an email using the Resend HTTP API.
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.html - HTML content of the email
 */
const sendEmail = async ({ to, subject, html }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_USER || 'onboarding@resend.dev';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not configured.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `PaceTrack Support <${fromEmail}>`,
      to: [to],
      subject,
      html
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to send email via Resend API.');
  }

  return data;
};

module.exports = sendEmail;
