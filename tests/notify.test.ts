import { config as loadEnv } from 'dotenv';
import { notify } from '../app/src/services/notify';

// Загружаем переменные окружения из .env
loadEnv();

/**
 * Тест рассылки уведомлений через универсальный сервис
 * 
 * Использование:
 * ```bash
 * npm run test:notify
 * ```
 * 
 * Требуемые переменные окружения в .env:
 * - TELEGRAM_BOT_TOKEN - токен Telegram бота
 * - TELEGRAM_CHAT_ID - ID чата для отправки (может быть таким же как TELEGRAM_ADMIN_CHAT_ID)
 * - EMAIL_HOST (или SMTP_HOST) - SMTP сервер
 * - EMAIL_PORT (или SMTP_PORT) - порт SMTP (465 для SSL, 587 для TLS)
 * - EMAIL_USER (или SMTP_USER) - логин SMTP
 * - EMAIL_PASS (или SMTP_PASS) - пароль SMTP
 * - EMAIL_FROM (или SMTP_FROM) - отправитель
 * - EMAIL_TO - email получателя для теста
 * - ENABLE_TELEGRAM=true - включить Telegram
 * - ENABLE_EMAIL=true - включить Email
 */
async function testNotify() {
  console.log('🚀 Запуск теста рассылки уведомлений...\n');

  const telegramId = process.env.TELEGRAM_CHAT_ID;
  const email = process.env.EMAIL_TO;

  if (!telegramId && !email) {
    console.error('❌ Ошибка: Установите TELEGRAM_CHAT_ID и/или EMAIL_TO в .env');
    throw new Error('Отсутствуют обязательные переменные окружения');
  }

  console.log('📋 Параметры:');
  console.log(`   Telegram ID: ${telegramId || 'не указан'}`);
  console.log(`   Email: ${email || 'не указан'}\n`);

  try {
    await notify({
      to: {
        telegramId: telegramId,
        email: email,
      },
      subject: '✅ Тест рассылки',
      message: 'Привет! Это тестовая рассылка через универсальный сервис.',
      html: '<b>Привет!</b> Это тестовая рассылка через <i>универсальный сервис</i>.',
    });

    console.log('\n✅ Тест завершён успешно!');
    console.log('   Проверьте Telegram и Email для подтверждения получения сообщений.\n');
  } catch (error: any) {
    console.error('\n❌ Ошибка при выполнении теста:');
    console.error(error?.message || String(error));
    throw error; // Пробрасываем ошибку вместо process.exit()
  }
}

// Запускаем тест и обрабатываем ошибки на верхнем уровне
testNotify().catch((error) => {
  console.error('Критическая ошибка:', error);
  process.exit(1);
});

