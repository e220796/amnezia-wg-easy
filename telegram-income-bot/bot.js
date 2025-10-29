const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Создаем бота с токеном из переменной окружения
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Путь к файлу с данными
const DATA_FILE = path.join(__dirname, 'incomes.json');

// Хранилище состояний пользователей для многошагового ввода
const userStates = new Map();

// Инициализация файла данных
function initDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2));
  }
}

// Загрузка данных
function loadData() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Ошибка при чтении данных:', error);
    return { users: {} };
  }
}

// Сохранение данных
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Ошибка при сохранении данных:', error);
  }
}

// Получение данных пользователя
function getUserData(userId) {
  const data = loadData();
  if (!data.users[userId]) {
    data.users[userId] = { incomes: [] };
    saveData(data);
  }
  return data.users[userId];
}

// Добавление дохода
function addIncome(userId, amount, description, date = new Date()) {
  const data = loadData();
  if (!data.users[userId]) {
    data.users[userId] = { incomes: [] };
  }

  data.users[userId].incomes.push({
    amount: parseFloat(amount),
    description: description,
    date: date.toISOString(),
    timestamp: date.getTime()
  });

  saveData(data);
}

// Получение доходов за месяц
function getMonthlyIncomes(userId, month, year) {
  const userData = getUserData(userId);
  return userData.incomes.filter(income => {
    const incomeDate = new Date(income.date);
    return incomeDate.getMonth() === month && incomeDate.getFullYear() === year;
  });
}

// Форматирование даты
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Форматирование суммы
function formatAmount(amount) {
  return amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Получение названия месяца
function getMonthName(month) {
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  return months[month];
}

// Главное меню с кнопками
function getMainKeyboard() {
  return {
    keyboard: [
      ['💰 Добавить доход'],
      ['📊 Отчет за месяц', '📋 История'],
      ['📅 Отчет за период', '🗑 Очистить данные'],
      ['❓ Помощь']
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

// Меню выбора месяца
function getMonthKeyboard() {
  return {
    keyboard: [
      ['📆 Текущий месяц'],
      ['1️⃣ Январь', '2️⃣ Февраль', '3️⃣ Март'],
      ['4️⃣ Апрель', '5️⃣ Май', '6️⃣ Июнь'],
      ['7️⃣ Июль', '8️⃣ Август', '9️⃣ Сентябрь'],
      ['🔟 Октябрь', '1️⃣1️⃣ Ноябрь', '1️⃣2️⃣ Декабрь'],
      ['🔙 Главное меню']
    ],
    resize_keyboard: true
  };
}

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  // Очищаем состояние пользователя
  userStates.delete(userId);

  const welcomeMessage = `
👋 Добро пожаловать в бот учета доходов!

Используйте кнопки меню ниже для управления ботом.

💰 Добавляйте доходы
📊 Просматривайте отчеты
📋 Следите за историей

Начните с добавления вашего первого дохода!
`;

  bot.sendMessage(chatId, welcomeMessage, {
    reply_markup: getMainKeyboard()
  });
});

// Команда /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
📚 Справка по командам:

💰 Добавление дохода:
/add <сумма> <описание>
Примеры:
• /add 5000 Зарплата
• /add 1500.50 Фриланс
• /add 300 Бонус от заказчика

📊 Отчеты:
/report - отчет за текущий месяц
/report 10 2024 - отчет за октябрь 2024
/report 1 2024 - отчет за январь 2024

📋 История:
/history - последние 10 записей

🗑 Очистка данных:
/clear - удалить все записи (требует подтверждения)

Все суммы автоматически сохраняются с датой добавления.
`;
  bot.sendMessage(chatId, helpMessage);
});

// Команда /add для добавления дохода
bot.onText(/\/add (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const input = match[1].trim();

  // Разбираем ввод: первое слово - сумма, остальное - описание
  const parts = input.split(' ');

  if (parts.length < 2) {
    bot.sendMessage(chatId, '❌ Неверный формат! Используйте: /add <сумма> <описание>\nПример: /add 5000 Зарплата');
    return;
  }

  const amount = parseFloat(parts[0]);
  const description = parts.slice(1).join(' ');

  if (isNaN(amount) || amount <= 0) {
    bot.sendMessage(chatId, '❌ Неверная сумма! Введите положительное число.\nПример: /add 5000 Зарплата');
    return;
  }

  addIncome(userId, amount, description);

  const confirmMessage = `
✅ Доход успешно добавлен!

💰 Сумма: ${formatAmount(amount)} руб.
📝 Описание: ${description}
📅 Дата: ${formatDate(new Date().toISOString())}
`;

  bot.sendMessage(chatId, confirmMessage);
});

// Команда /report для отчета
bot.onText(/\/report(?:\s+(\d+)\s+(\d+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  let month, year;

  if (match[1] && match[2]) {
    // Указан конкретный месяц и год
    month = parseInt(match[1]) - 1; // месяцы с 0
    year = parseInt(match[2]);

    if (month < 0 || month > 11) {
      bot.sendMessage(chatId, '❌ Неверный месяц! Укажите число от 1 до 12.');
      return;
    }

    if (year < 2000 || year > 2100) {
      bot.sendMessage(chatId, '❌ Неверный год! Укажите год от 2000 до 2100.');
      return;
    }
  } else {
    // Текущий месяц
    const now = new Date();
    month = now.getMonth();
    year = now.getFullYear();
  }

  const incomes = getMonthlyIncomes(userId, month, year);

  if (incomes.length === 0) {
    bot.sendMessage(chatId, `📊 За ${getMonthName(month)} ${year} года доходов не найдено.`);
    return;
  }

  // Подсчет общей суммы
  const total = incomes.reduce((sum, income) => sum + income.amount, 0);

  // Формирование отчета
  let report = `📊 Отчет за ${getMonthName(month)} ${year} года\n\n`;
  report += `💼 Всего записей: ${incomes.length}\n`;
  report += `💰 Общая сумма: ${formatAmount(total)} руб.\n\n`;
  report += `📝 Детализация:\n`;
  report += `${'─'.repeat(35)}\n`;

  incomes.forEach((income, index) => {
    report += `${index + 1}. ${formatDate(income.date)}\n`;
    report += `   💵 ${formatAmount(income.amount)} руб.\n`;
    report += `   📄 ${income.description}\n`;
    if (index < incomes.length - 1) {
      report += `${'─'.repeat(35)}\n`;
    }
  });

  bot.sendMessage(chatId, report);
});

// Команда /history для показа последних записей
bot.onText(/\/history/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userData = getUserData(userId);

  if (userData.incomes.length === 0) {
    bot.sendMessage(chatId, '📋 История пуста. Добавьте первый доход командой /add');
    return;
  }

  // Берем последние 10 записей
  const recentIncomes = userData.incomes.slice(-10).reverse();

  let message = `📋 Последние ${recentIncomes.length} записей:\n\n`;

  recentIncomes.forEach((income, index) => {
    message += `${recentIncomes.length - index}. ${formatDate(income.date)}\n`;
    message += `   💵 ${formatAmount(income.amount)} руб.\n`;
    message += `   📄 ${income.description}\n`;
    if (index < recentIncomes.length - 1) {
      message += `${'─'.repeat(35)}\n`;
    }
  });

  const total = userData.incomes.reduce((sum, income) => sum + income.amount, 0);
  message += `\n💰 Всего записей: ${userData.incomes.length}\n`;
  message += `💵 Общая сумма за все время: ${formatAmount(total)} руб.`;

  bot.sendMessage(chatId, message);
});

// Команда /clear для очистки данных
bot.onText(/\/clear/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  const opts = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Да, удалить все', callback_data: 'clear_yes' },
          { text: '❌ Отмена', callback_data: 'clear_no' }
        ]
      ]
    }
  };

  bot.sendMessage(chatId, '⚠️ Вы уверены, что хотите удалить все записи о доходах?', opts);
});

// Обработка кнопок подтверждения
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id.toString();

  if (query.data === 'clear_yes') {
    const data = loadData();
    data.users[userId] = { incomes: [] };
    saveData(data);

    bot.editMessageText('✅ Все записи успешно удалены!', {
      chat_id: chatId,
      message_id: query.message.message_id
    });

    // Показываем главное меню
    bot.sendMessage(chatId, 'Выберите действие:', {
      reply_markup: getMainKeyboard()
    });
  } else if (query.data === 'clear_no') {
    bot.editMessageText('❌ Удаление отменено.', {
      chat_id: chatId,
      message_id: query.message.message_id
    });
  }

  bot.answerCallbackQuery(query.id);
});

// Обработка текстовых сообщений (кнопки меню и ввод данных)
bot.on('message', (msg) => {
  // Пропускаем команды, они обрабатываются отдельно
  if (msg.text && msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const text = msg.text;

  // Проверяем состояние пользователя
  const userState = userStates.get(userId);

  // Главное меню
  if (text === '🔙 Главное меню') {
    userStates.delete(userId);
    bot.sendMessage(chatId, '🏠 Главное меню', {
      reply_markup: getMainKeyboard()
    });
    return;
  }

  // Добавление дохода - шаг 1: запрос данных
  if (text === '💰 Добавить доход') {
    userStates.set(userId, { action: 'adding_income' });
    bot.sendMessage(chatId,
      '💰 Введите сумму и описание дохода через пробел.\n\n' +
      'Формат: <сумма> <описание>\n' +
      'Пример: 5000 Зарплата за октябрь\n\n' +
      'Или нажмите "🔙 Главное меню" для отмены.',
      { reply_markup: { keyboard: [['🔙 Главное меню']], resize_keyboard: true } }
    );
    return;
  }

  // Добавление дохода - шаг 2: обработка ввода
  if (userState && userState.action === 'adding_income') {
    const parts = text.split(' ');

    if (parts.length < 2) {
      bot.sendMessage(chatId,
        '❌ Неверный формат!\n\n' +
        'Используйте: <сумма> <описание>\n' +
        'Пример: 5000 Зарплата'
      );
      return;
    }

    const amount = parseFloat(parts[0]);
    const description = parts.slice(1).join(' ');

    if (isNaN(amount) || amount <= 0) {
      bot.sendMessage(chatId, '❌ Неверная сумма! Введите положительное число.');
      return;
    }

    addIncome(userId, amount, description);
    userStates.delete(userId);

    const confirmMessage = `
✅ Доход успешно добавлен!

💰 Сумма: ${formatAmount(amount)} руб.
📝 Описание: ${description}
📅 Дата: ${formatDate(new Date().toISOString())}
`;

    bot.sendMessage(chatId, confirmMessage, {
      reply_markup: getMainKeyboard()
    });
    return;
  }

  // Отчет за текущий месяц
  if (text === '📊 Отчет за месяц') {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const incomes = getMonthlyIncomes(userId, month, year);

    if (incomes.length === 0) {
      bot.sendMessage(chatId, `📊 За ${getMonthName(month)} ${year} года доходов не найдено.`);
      return;
    }

    const total = incomes.reduce((sum, income) => sum + income.amount, 0);

    let report = `📊 Отчет за ${getMonthName(month)} ${year} года\n\n`;
    report += `💼 Всего записей: ${incomes.length}\n`;
    report += `💰 Общая сумма: ${formatAmount(total)} руб.\n\n`;
    report += `📝 Детализация:\n`;
    report += `${'─'.repeat(35)}\n`;

    incomes.forEach((income, index) => {
      report += `${index + 1}. ${formatDate(income.date)}\n`;
      report += `   💵 ${formatAmount(income.amount)} руб.\n`;
      report += `   📄 ${income.description}\n`;
      if (index < incomes.length - 1) {
        report += `${'─'.repeat(35)}\n`;
      }
    });

    bot.sendMessage(chatId, report);
    return;
  }

  // История
  if (text === '📋 История') {
    const userData = getUserData(userId);

    if (userData.incomes.length === 0) {
      bot.sendMessage(chatId, '📋 История пуста. Добавьте первый доход!');
      return;
    }

    const recentIncomes = userData.incomes.slice(-10).reverse();
    let message = `📋 Последние ${recentIncomes.length} записей:\n\n`;

    recentIncomes.forEach((income, index) => {
      message += `${recentIncomes.length - index}. ${formatDate(income.date)}\n`;
      message += `   💵 ${formatAmount(income.amount)} руб.\n`;
      message += `   📄 ${income.description}\n`;
      if (index < recentIncomes.length - 1) {
        message += `${'─'.repeat(35)}\n`;
      }
    });

    const total = userData.incomes.reduce((sum, income) => sum + income.amount, 0);
    message += `\n💰 Всего записей: ${userData.incomes.length}\n`;
    message += `💵 Общая сумма за все время: ${formatAmount(total)} руб.`;

    bot.sendMessage(chatId, message);
    return;
  }

  // Отчет за период - показываем меню выбора месяца
  if (text === '📅 Отчет за период') {
    userStates.set(userId, { action: 'selecting_month' });
    bot.sendMessage(chatId, '📅 Выберите месяц для отчета:', {
      reply_markup: getMonthKeyboard()
    });
    return;
  }

  // Обработка выбора месяца
  if (userState && userState.action === 'selecting_month') {
    const now = new Date();
    let month, year = now.getFullYear();

    if (text === '📆 Текущий месяц') {
      month = now.getMonth();
    } else {
      const monthMap = {
        '1️⃣ Январь': 0, '2️⃣ Февраль': 1, '3️⃣ Март': 2,
        '4️⃣ Апрель': 3, '5️⃣ Май': 4, '6️⃣ Июнь': 5,
        '7️⃣ Июль': 6, '8️⃣ Август': 7, '9️⃣ Сентябрь': 8,
        '🔟 Октябрь': 9, '1️⃣1️⃣ Ноябрь': 10, '1️⃣2️⃣ Декабрь': 11
      };

      month = monthMap[text];
      if (month === undefined) {
        bot.sendMessage(chatId, '❌ Неверный выбор. Попробуйте снова.');
        return;
      }
    }

    userStates.delete(userId);

    const incomes = getMonthlyIncomes(userId, month, year);

    if (incomes.length === 0) {
      bot.sendMessage(chatId, `📊 За ${getMonthName(month)} ${year} года доходов не найдено.`, {
        reply_markup: getMainKeyboard()
      });
      return;
    }

    const total = incomes.reduce((sum, income) => sum + income.amount, 0);

    let report = `📊 Отчет за ${getMonthName(month)} ${year} года\n\n`;
    report += `💼 Всего записей: ${incomes.length}\n`;
    report += `💰 Общая сумма: ${formatAmount(total)} руб.\n\n`;
    report += `📝 Детализация:\n`;
    report += `${'─'.repeat(35)}\n`;

    incomes.forEach((income, index) => {
      report += `${index + 1}. ${formatDate(income.date)}\n`;
      report += `   💵 ${formatAmount(income.amount)} руб.\n`;
      report += `   📄 ${income.description}\n`;
      if (index < incomes.length - 1) {
        report += `${'─'.repeat(35)}\n`;
      }
    });

    bot.sendMessage(chatId, report, {
      reply_markup: getMainKeyboard()
    });
    return;
  }

  // Очистка данных
  if (text === '🗑 Очистить данные') {
    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Да, удалить все', callback_data: 'clear_yes' },
            { text: '❌ Отмена', callback_data: 'clear_no' }
          ]
        ]
      }
    };

    bot.sendMessage(chatId, '⚠️ Вы уверены, что хотите удалить все записи о доходах?', opts);
    return;
  }

  // Помощь
  if (text === '❓ Помощь') {
    const helpMessage = `
📚 Справка по использованию бота

💰 Добавить доход:
Нажмите кнопку "💰 Добавить доход" и введите сумму и описание через пробел.
Пример: 5000 Зарплата за октябрь

📊 Отчет за месяц:
Показывает детальный отчет о доходах за текущий месяц.

📅 Отчет за период:
Выберите любой месяц текущего года для просмотра отчета.

📋 История:
Показывает последние 10 записей и общую статистику.

🗑 Очистить данные:
Удаляет все записи о доходах (требуется подтверждение).

Все данные сохраняются автоматически и доступны только вам!
`;

    bot.sendMessage(chatId, helpMessage);
    return;
  }

  // Если ничего не подошло
  bot.sendMessage(chatId, '❓ Не понимаю. Используйте кнопки меню для навигации.');
});

// Инициализация
initDataFile();

console.log('🤖 Бот запущен и готов к работе!');
console.log('📊 Файл данных:', DATA_FILE);
