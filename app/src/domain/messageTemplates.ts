export function recoveryMessage({ userName, link }: { userName?: string; link: string }) {
  const text = `Hey${userName ? ' ' + userName : ''}, your last payment didn’t go through. Update your card here: ${link}`;
  const html = `<p>Hey${userName ? ' ' + userName : ''}, your last payment didn’t go through.</p>
                <p><a href="${link}">Click to update your payment</a></p>`;
  const subject = 'Action required: update your payment';
  return { subject, text, html };
}




