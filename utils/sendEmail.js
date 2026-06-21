/**
 * Sends an email using the Brevo (Sendinblue) Transactional API.
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.html - HTML content of the email
 */
const sendEmail = async ({ to, subject, html }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_USER || 'tayabawan.in@gmail.com';

  if (!apiKey) {
    throw new Error('BREVO_API_KEY environment variable is not configured.');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: {
        name: 'PaceTrack Support',
        email: fromEmail
      },
      to: [
        {
          email: to
        }
      ],
      subject,
      htmlContent: html
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to send email via Brevo API.');
  }

  return data;
};

module.exports = sendEmail;
