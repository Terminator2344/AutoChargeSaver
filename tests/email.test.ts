/**
 * Email Notification Test
 * 
 * Запуск:
 * npx tsx tests/email.test.ts
 * 
 * Требуемые переменные в .env:
 * EMAIL_HOST=smtp.gmail.com
 * EMAIL_PORT=465
 * EMAIL_USER=your_email@gmail.com
 * EMAIL_PASS=your_app_password
 * EMAIL_FROM=your_email@gmail.com
 * EMAIL_TO=recipient@example.com
 */

import { config as loadEnv } from 'dotenv';
import nodemailer from 'nodemailer';

// Загружаем переменные окружения
loadEnv();

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_TO = process.env.EMAIL_TO;

async function testEmailNotification() {
  try {
    // Проверяем наличие необходимых переменных
    if (!EMAIL_HOST) {
      console.error('❌ Ошибка: EMAIL_HOST не установлен в .env');
      process.exit(1);
    }

    if (!EMAIL_PORT) {
      console.error('❌ Ошибка: EMAIL_PORT не установлен в .env');
      process.exit(1);
    }

    if (!EMAIL_USER) {
      console.error('❌ Ошибка: EMAIL_USER не установлен в .env');
      process.exit(1);
    }

    if (!EMAIL_PASS) {
      console.error('❌ Ошибка: EMAIL_PASS не установлен в .env');
      process.exit(1);
    }

    if (!EMAIL_FROM) {
      console.error('❌ Ошибка: EMAIL_FROM не установлен в .env');
      process.exit(1);
    }

    if (!EMAIL_TO) {
      console.error('❌ Ошибка: EMAIL_TO не установлен в .env');
      process.exit(1);
    }

    console.log('📤 Настройка SMTP транспорта...');
    console.log(`Host: ${EMAIL_HOST}`);
    console.log(`Port: ${EMAIL_PORT}`);
    console.log(`User: ${EMAIL_USER}`);
    console.log(`From: ${EMAIL_FROM}`);
    console.log(`To: ${EMAIL_TO}`);

    // Создаем transporter
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: Number(EMAIL_PORT),
      secure: Number(EMAIL_PORT) === 465, // true для 465, false для других портов
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    console.log('\n📧 Отправка тестового письма...');

    // Отправляем письмо
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: '✅ Тест Email',
      html: '<b>Письмо успешно доставлено!</b>',
      text: 'Письмо успешно доставлено!', // Текстовая версия для клиентов без HTML
    });

    console.log('\n✅ Успешно! Письмо отправлено.');
    console.log(`\n📨 Message ID: ${info.messageId}`);
    console.log(`📬 Response: ${info.response}`);

    // Закрываем соединение
    transporter.close();

    console.log('\n✅ Тест завершен успешно!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Критическая ошибка:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    if (error.response) {
      console.error('\n📋 Ответ SMTP сервера:');
      console.error(error.response);
    }
    process.exit(1);
  }
}

// Запускаем тест
testEmailNotification();

