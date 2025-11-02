/**
 * Telegram Notification Test
 * 
 * Запуск:
 * npx tsx tests/telegram.test.ts
 * 
 * Требуемые переменные в .env:
 * TELEGRAM_BOT_TOKEN=your_bot_token
 * TELEGRAM_CHAT_ID=your_chat_id
 */

import { config as loadEnv } from 'dotenv';
// @ts-ignore - node-fetch@2 использует CommonJS, но tsx обрабатывает это
import fetch from 'node-fetch';

// Загружаем переменные окружения
loadEnv();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function testTelegramNotification() {
  try {
    // Проверяем наличие необходимых переменных
    if (!TELEGRAM_BOT_TOKEN) {
      console.error('❌ Ошибка: TELEGRAM_BOT_TOKEN не установлен в .env');
      process.exit(1);
    }

    if (!TELEGRAM_CHAT_ID) {
      console.error('❌ Ошибка: TELEGRAM_CHAT_ID не установлен в .env');
      process.exit(1);
    }

    console.log('📤 Отправка тестового сообщения в Telegram...');
    console.log(`Bot Token: ${TELEGRAM_BOT_TOKEN.substring(0, 10)}...`);
    console.log(`Chat ID: ${TELEGRAM_CHAT_ID}`);

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const message = '✅ Тест Telegram из Node.js успешно доставлен!';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Ошибка при отправке сообщения:');
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log('\n✅ Успешно! Сообщение отправлено.');
    console.log('\n📋 Ответ API:');
    console.log(JSON.stringify(data, null, 2));

    if (data.ok && data.result) {
      console.log(`\n📨 Message ID: ${data.result.message_id}`);
      console.log(`👤 Chat ID: ${data.result.chat.id}`);
      console.log(`👤 Chat Title: ${data.result.chat.title || data.result.chat.first_name || 'N/A'}`);
    }

    console.log('\n✅ Тест завершен успешно!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Критическая ошибка:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Запускаем тест
testTelegramNotification();

