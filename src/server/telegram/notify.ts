export async function sendTelegramNotification(text: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
  
    if (!token || !chatId) {
      console.warn("Telegram not configured: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
      return;
    }
  
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
  
      if (!res.ok) {
        const err = await res.text();
        console.error("Telegram API error:", err);
      }
    } catch (error) {
      console.error("Telegram send error:", error);
    }
  }