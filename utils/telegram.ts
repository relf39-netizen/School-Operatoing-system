
// Utility for sending Telegram Notifications

interface SendMessagePayload {
    chat_id: string;
    text: string;
    parse_mode?: 'HTML' | 'Markdown';
}

export const sendTelegramMessage = async (botToken: string, chatId: string, message: string, linkUrl?: string) => {
    if (!botToken || !chatId) {
        console.warn("Telegram Bot Token or Chat ID is missing");
        return;
    }

    let finalMessage = message;
    if (linkUrl) {
        // Use HTML parse mode to create a clickable link
        finalMessage += `\n\n<a href="${linkUrl}">👉 คลิกเพื่อเปิดดูเอกสาร</a>`;
    }

    const payload: SendMessagePayload = {
        chat_id: chatId,
        text: finalMessage,
        parse_mode: 'HTML'
    };

    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!data.ok) {
            console.error("Telegram API Error:", data);
        } else {
            console.log("Telegram notification sent to", chatId);
        }
    } catch (error) {
        console.error("Failed to send Telegram message:", error);
    }
};
