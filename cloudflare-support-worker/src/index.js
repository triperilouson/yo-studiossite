import PostalMime from "postal-mime";

export default {
  async email(message, env) {
    if (message.rawSize > 1024 * 1024) {
      message.setReject("Message too large");
      return;
    }

    const email = await PostalMime.parse(message.raw);

    await fetch(`${env.BACKEND_URL}/api/v1/support/inbound`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-yo-support-secret": env.SUPPORT_INBOUND_WEBHOOK_SECRET
      },
      body: JSON.stringify({
        provider: "cloudflare",
        fromEmail: message.from,
        fromName: email.from?.name || "",
        subject: email.subject || "Support message",
        body: email.text || "",
        providerMessageId: message.headers.get("message-id") || undefined,
        messageId: message.headers.get("message-id") || undefined,
        inReplyTo: message.headers.get("in-reply-to") || undefined,
        references: message.headers.get("references") || undefined
      })
    });
  }
};