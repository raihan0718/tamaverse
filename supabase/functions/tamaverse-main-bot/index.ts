const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN3");
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET3") ?? "";
const APP_URL = "https://tamaverse-pet-quest--raihanmilano07.replit.app";
const API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : "";

type TgMessage = {
  message_id: number;
  chat: { id: number; type?: string };
  from?: { first_name?: string; username?: string };
  text?: string;
};
type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number } };
    from?: { first_name?: string };
  };
};

const mainKeyboard = {
  inline_keyboard: [
    [{ text: "🌈 Open Tamaverse", url: APP_URL }],
    [{ text: "✨ About Tamaverse", callback_data: "about" }, { text: "🐣 How to play", callback_data: "guide" }],
    [{ text: "📜 Commands", callback_data: "commands" }, { text: "💌 Help & support", callback_data: "support" }],
  ],
};

const pages: Record<string, { text: string; keyboard?: unknown }> = {
  home: {
    text: "🌙 *Welcome to Tamaverse!*\n\nH hii, Tama Pals! So happy to see you here! 🌷\nYour little adventure with adorable companions starts right here. Ready to explore? 🥚✨\n\nPick a little corner to visit:",
    keyboard: mainKeyboard,
  },
  about: {
    text: "🌷 *A little about Tamaverse*\n\nTamaverse is a cozy little world where you can meet companions, take care of them, collect adorable pets, and enjoy your own adventure! 🐣💗\n\nEvery companion has a story. Let’s make lovely memories together! ✨",
    keyboard: { inline_keyboard: [[{ text: "🌈 Open Tamaverse", url: APP_URL }], [{ text: "‹ Back to menu", callback_data: "home" }]] },
  },
  guide: {
    text: "🥚 *Your little adventure starts here!*\n\n1. Tap the button below to enter Tamaverse.\n2. Meet your very first companion! 🐾\n3. Give your pet some love and care.\n4. Explore the menus and see what fun surprises await! 🌟\n\nHave fun on your journey, Tama Pal! 💕",
    keyboard: { inline_keyboard: [[{ text: "🌈 Open Tamaverse", url: APP_URL }], [{ text: "‹ Back to menu", callback_data: "home" }]] },
  },
  commands: {
    text: "💌 *A few handy commands*\n\n/start — say hello and open the menu 🌷\n/menu — show the main menu 🏡\n/help — get a little help 🧸\n/about — learn about Tamaverse ✨\n/game — jump into the game 🥚\n/support — contact our support team 💗",
    keyboard: { inline_keyboard: [[{ text: "‹ Back to menu", callback_data: "home" }]] },
  },
  support: {
    text: "🧸 *Need a little help?*\n\nOh no, something not working as expected? No worries! We’re happy to help. 🌷\n\nTell our support team what happened and share a screenshot if it helps explain the issue. Please don’t share private account details or verification codes. 💌\n\nWe’ll do our best to help you out. See you there, Tama Pal! ✨",
    keyboard: { inline_keyboard: [[{ text: "💌 Chat with @TamaSupportBot", url: "https://t.me/TamaSupportBot" }], [{ text: "‹ Back to menu 🌷", callback_data: "home" }]] },
  },
};

async function telegram(method: string, body: Record<string, unknown>) {
  if (!API) throw new Error("Missing TELEGRAM_BOT_TOKEN3");
  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    console.error("Telegram API error", method, result);
    throw new Error(`Telegram API request failed: ${method}`);
  }
  return result;
}

async function send(chatId: number, text: string, replyMarkup?: unknown) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

async function showPage(chatId: number, messageId: number, page: string) {
  const selected = pages[page] ?? pages.home;
  return telegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: selected.text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    ...(selected.keyboard ? { reply_markup: selected.keyboard } : {}),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return Response.json({ ok: true, service: "tamaverse-main-bot", configured: Boolean(BOT_TOKEN) });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!BOT_TOKEN) return Response.json({ ok: false, error: "Bot token is not configured" }, { status: 500 });

  if (WEBHOOK_SECRET) {
    const supplied = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (supplied !== WEBHOOK_SECRET) return new Response("Unauthorized", { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (update.callback_query) {
      const query = update.callback_query;
      await telegram("answerCallbackQuery", { callback_query_id: query.id });
      const chatId = query.message?.chat.id;
      const messageId = query.message?.message_id;
      if (chatId && messageId) await showPage(chatId, messageId, query.data ?? "home");
      return Response.json({ ok: true });
    }

    const message = update.message;
    if (!message?.text || !message.chat?.id) return Response.json({ ok: true });
    const command = message.text.trim().split(/\s+/)[0].split("@")[0].toLowerCase();
    const firstName = (message.from?.first_name ?? "there").replace(/[<>]/g, "");
    const chatId = message.chat.id;

    switch (command) {
      case "/start":
      case "/menu":
        await send(chatId, `🌙 *Hey, ${firstName}!*\n\nWelcome to *Tamaverse* — a cozy universe for your virtual-pet journey.\n\nReady to meet your companion and explore? Pick a menu below.`, mainKeyboard);
        break;
      case "/about":
        await send(chatId, pages.about.text, pages.about.keyboard);
        break;
      case "/help":
        await send(chatId, pages.support.text, pages.support.keyboard);
        break;
      case "/game":
        await send(chatId, "🎮 Your Tamaverse adventure is just one tap away! Ready, set, hatch! 🐣✨", { inline_keyboard: [[{ text: "Open Tamaverse", url: APP_URL }], [{ text: "‹ Main menu", callback_data: "home" }]] });
        break;
      case "/support":
        await send(chatId, pages.support.text, pages.support.keyboard);
        break;
      default:
        await send(chatId, "I didn't recognize that command. Use /menu to see what I can do.", mainKeyboard);
    }
  } catch (error) {
    console.error("Update handling failed", error);
    // Return 200 so Telegram does not retry an update indefinitely after a transient API failure.
  }
  return Response.json({ ok: true });
});
