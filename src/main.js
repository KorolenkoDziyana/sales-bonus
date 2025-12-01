/**
 * Функция для расчета выручки от продажи товара с учётом скидки
 * @param {Object} purchase - запись о покупке товара из чека
 * @param {number} purchase.discount - размер скидки в процентах
 * @param {number} purchase.sale_price - цена продажи за единицу
 * @param {number} purchase.quantity - количество товара
 * @param {Object} _product - карточка товара из каталога (опционально)
 * @returns {number} - сумма выручки с учётом скидки
 */
function calculateSimpleRevenue(purchase, _product) {
  const { discount, sale_price, quantity } = purchase;

  // Записываем в константу discount коэффициент для расчета суммы без скидки в десятичном формате
  const discountCoefficient = 1 - discount / 100;

  // Возвращаем выручку, рассчитанную по формуле: sale_price × quantity × discountCoefficient
  return sale_price * quantity * discountCoefficient;
}

/**
 * Методика расчёта бонусов на основе позиции в рейтинге по прибыли
 * @param {number} index - позиция продавца в отсортированном массиве (0 - лучший)
 * @param {number} total - общее число продавцов в рейтинге
 * @param {Object} seller - объект с данными о продавце
 * @param {number} seller.profit - прибыль продавца
 * @returns {number} - коэффициент бонуса (от 0 до 0.15)
 */
function calculateBonusByProfit(index, total, seller) {
  // 15% — для продавца, который принёс наибольшую прибыль (первое место)
  if (index === 0) {
    return 0.15*1000 ;
  }
  // 10% — для продавцов, которые оказались на втором и третьем месте по прибыли
  else if (index === 1 || index === 2) {
    return 0.1*1000;
  }
  // 0% — для продавца, который оказался на последнем месте
  else if (index === total - 1) {
    return 0.0*1000;
  }
  // 5% — для всех остальных продавцов
  else {
    return 0.05*1000;
  }
}

/**
 * Главная функция анализа данных продаж
 * @param {Object} data - входные данные о продажах
 * @param {Object} options - настройки расчета
 * @param {Function} options.calculateRevenue - функция расчета выручки
 * @param {Function} options.calculateBonusByProfit - функция расчета бонусов
 * @returns {Array} - отсортированный массив продавцов с данными о бонусах
 */
function analyzeSalesData(data, options) {
  // Проверка входных данных
  if (!data || typeof data !== "object") {
    throw new Error("Данные не предоставлены или имеют неверный формат");
  }

  if (!data.purchase_records || !Array.isArray(data.purchase_records) || data.purchase_records.length === 0) {
    throw new Error("Отсутствуют или некорректны записи о покупках");
  }

  if (!data.products || !Array.isArray(data.products) || data.products.length === 0) {
    throw new Error("Отсутствуют или некорректны данные о товарах");
  }

  if (!data.sellers || !Array.isArray(data.sellers) || data.sellers.length === 0) {
    throw new Error("Отсутствуют или некорректны данные о продавцах");
  }

  // Проверка наличия опций
  if (!options || typeof options !== "object") {
    throw new Error("Опции не предоставлены");
  }

  const { calculateRevenue, calculateBonusByProfit } = options;

  if (typeof calculateRevenue !== "function") {
    throw new Error("Функция calculateRevenue не предоставлена");
  }

  if (typeof calculateBonusByProfit !== "function") {
    throw new Error("Функция calculateBonusByProfit не предоставлена");
  }

  // Подготовка промежуточных данных для сбора статистики
  const sellerStats = data.sellers.map((seller) => ({
    seller_id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
  }));

  // Индексация продавцов и товаров для быстрого доступа
  const sellerIndex = Object.fromEntries(
    sellerStats.map((stat) => [stat.seller_id, stat])
  );

  const productIndex = Object.fromEntries(
    data.products.map((product) => [product.sku, product])
  );

  // Расчет выручки и прибыли для каждого продавца
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];

    if (!seller) return;

    // Увеличить количество продаж
    seller.sales_count += 1;

    // Увеличить общую сумму всех продаж
    seller.revenue += record.total_amount;

    // Расчёт прибыли для каждого товара
    record.items.forEach((item) => {
      const product = productIndex[item.sku];

      if (!product) return;

      // Посчитать себестоимость (cost) товара
      const cost = product.purchase_price * item.quantity;

      // Посчитать выручку (revenue) с учётом скидки через функцию calculateRevenue
      const revenue = calculateRevenue(item, product);

      // Посчитать прибыль: выручка минус себестоимость
      const profit = revenue - cost;

      // Увеличить общую накопленную прибыль у продавца
      seller.profit += profit;

      // Учёт количества проданных товаров
      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = {
          quantity: 0,
          revenue: 0,
          profit: 0,
          name: product.name,
        };
      }

      // По артикулу товара увеличить его проданное количество у продавца
      seller.products_sold[item.sku].quantity += item.quantity;
      seller.products_sold[item.sku].revenue += revenue;
      seller.products_sold[item.sku].profit += profit;
    });
  });

  // Сортировка продавцов по прибыли
  const sortedSellers = sellerStats.sort((a, b) => b.profit - a.profit);

  // Назначение премий на основе ранжирования
  const totalSellers = sortedSellers.length;
  const sellersWithBonuses = sortedSellers.map((seller, index) => {
    // Посчитать бонус, используя функцию calculateBonusByProfit
    const bonusRate = calculateBonusByProfit(index, totalSellers, seller);
    const bonusAmount = seller.profit * bonusRate;

    // Записать в поле bonus полученное значение
    seller.bonus = +bonusAmount.toFixed(2);
    seller.bonus_rate = bonusRate;
    seller.rank = index + 1;

    // Сформировать топ-10 проданных продуктов
    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, productData]) => ({
        sku: sku,
        name: productData.name,
        quantity: productData.quantity,
        revenue: +productData.revenue.toFixed(2),
        profit: +productData.profit.toFixed(2),
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return seller;
  });

  // Подготовка итоговой коллекции с нужными полями
  const finalResult = sellersWithBonuses.map((seller) => ({
    seller_id: seller.seller_id,
    name: seller.name,
    revenue: +seller.revenue.toFixed(2),
    profit: +seller.profit.toFixed(2),
    sales_count: seller.sales_count,
    top_products: seller.top_products.map((product) => ({
      sku: product.sku,
      quantity: product.quantity,
    })),
    bonus: seller.bonus,
  }));

  return finalResult;
}
