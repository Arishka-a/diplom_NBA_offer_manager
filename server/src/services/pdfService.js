const PDFDocument = require('pdfkit');
const reportService = require('./reportService');

/**
 * Создание PDF документа с отчётом по аналитике NBA-системы
 */
const generateAnalyticsReport = async (startDate, endDate) => {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    bufferPages: true,
    info: {
      Title: 'NBA Offer Manager - Analytics Report',
      Author: 'NBA Offer Manager System',
      Subject: 'Offer and Segment Performance Analytics',
      CreationDate: new Date()
    }
  });

  // Загружаем данные для отчёта
  const [
    dashboardStats,
    offerTypeStats,
    topOffersByConversion,
    topOffersByViews,
    segmentPerformance,
    customerStats,
    segmentDistribution
  ] = await Promise.all([
    reportService.getDashboardStats(),
    reportService.getOfferTypeReport(startDate, endDate),
    reportService.getTopOffersByConversion(10, startDate, endDate),
    reportService.getTopOffersByViews(10, startDate, endDate),
    reportService.getSegmentPerformanceReport(startDate, endDate),
    reportService.getCustomerStatsReport(),
    reportService.getCustomerSegmentDistribution()
  ]);

  // Заголовок
  addHeader(doc, 'NBA System Analytics Report');

  // Период отчёта
  const periodText = startDate && endDate
    ? `Period: ${formatDate(startDate)} - ${formatDate(endDate)}`
    : 'Period: All time';
  doc.fontSize(10).fillColor('#666').text(periodText, { align: 'center' });
  doc.moveDown(2);

  // Общая статистика
  addSectionTitle(doc, '1. System Overview');

  if (dashboardStats) {
    const statsData = [
      ['Metric', 'Value'],
      ['Total Offers', dashboardStats.offers?.total_offers || 0],
      ['Active Offers', dashboardStats.offers?.active_offers || 0],
      ['Draft Offers', dashboardStats.offers?.draft_offers || 0],
      ['Total Segments', dashboardStats.segments?.total_segments || 0],
      ['Active Segments', dashboardStats.segments?.active_segments || 0],
      ['Total Customers', dashboardStats.customers?.total_customers || 0],
      ['Total Views', dashboardStats.interactions?.total_views || 0],
      ['Accepted Offers', dashboardStats.interactions?.total_accepts || 0],
      ['Rejected Offers', dashboardStats.interactions?.total_rejects || 0],
      ['Conversion Rate', `${dashboardStats.interactions?.conversion_rate || 0}%`]
    ];
    addTable(doc, statsData, [200, 150]);
  }

  // Статистика по клиентам
  addPageBreakIfNeeded(doc);
  addSectionTitle(doc, '2. Customer Statistics');

  if (customerStats) {
    const customerData = [
      ['Metric', 'Value'],
      ['Total Customers', customerStats.total_customers || 0],
      ['Low Churn Risk', customerStats.low_churn || 0],
      ['Medium Churn Risk', customerStats.medium_churn || 0],
      ['High Churn Risk', customerStats.high_churn || 0],
      ['Average ARPU', `$${customerStats.avg_arpu || 0}`],
      ['Average Tenure', `${customerStats.avg_tenure || 0} months`],
      ['Average Churn Score', customerStats.avg_churn_score || 0]
    ];
    addTable(doc, customerData, [200, 150]);
  }

  // Эффективность по типам офферов
  addPageBreakIfNeeded(doc);
  addSectionTitle(doc, '3. Performance by Offer Type');

  if (offerTypeStats && offerTypeStats.length > 0) {
    const typeLabels = {
      discount: 'Discount',
      bonus: 'Bonus',
      recommendation: 'Recommendation',
      upgrade: 'Upgrade',
      retention: 'Retention'
    };

    const offerTypeData = [
      ['Type', 'Count', 'Views', 'Accepts', 'Conversion']
    ];

    offerTypeStats.forEach(row => {
      offerTypeData.push([
        typeLabels[row.offer_type] || row.offer_type,
        row.offer_count || 0,
        row.total_views || 0,
        row.total_accepts || 0,
        `${row.conversion_rate || 0}%`
      ]);
    });

    addTable(doc, offerTypeData, [100, 60, 80, 80, 80]);
  }

  // Топ офферов по конверсии
  addPageBreakIfNeeded(doc);
  addSectionTitle(doc, '4. Top 10 Offers by Conversion');

  if (topOffersByConversion && topOffersByConversion.length > 0) {
    const conversionData = [
      ['#', 'Title', 'Views', 'Accepts', 'Conversion']
    ];

    topOffersByConversion.forEach((offer, index) => {
      conversionData.push([
        index + 1,
        truncateText(offer.title, 30),
        offer.views || 0,
        offer.accepts || 0,
        `${offer.conversion_rate || 0}%`
      ]);
    });

    addTable(doc, conversionData, [30, 180, 70, 70, 70]);
  }

  // Топ офферов по просмотрам
  addPageBreakIfNeeded(doc);
  addSectionTitle(doc, '5. Top 10 Offers by Views');

  if (topOffersByViews && topOffersByViews.length > 0) {
    const viewsData = [
      ['#', 'Title', 'Views', 'Accepts', 'Conversion']
    ];

    topOffersByViews.forEach((offer, index) => {
      viewsData.push([
        index + 1,
        truncateText(offer.title, 30),
        offer.views || 0,
        offer.accepts || 0,
        `${offer.conversion_rate || 0}%`
      ]);
    });

    addTable(doc, viewsData, [30, 180, 70, 70, 70]);
  }

  // Эффективность сегментов
  addPageBreakIfNeeded(doc);
  addSectionTitle(doc, '6. Segment Performance');

  if (segmentPerformance && segmentPerformance.length > 0) {
    const segmentData = [
      ['Segment', 'Customers', 'Views', 'Accepts', 'Conv.', 'ARPU']
    ];

    segmentPerformance.forEach(segment => {
      segmentData.push([
        truncateText(segment.name, 20),
        segment.customer_count || 0,
        segment.total_views || 0,
        segment.total_accepts || 0,
        `${segment.conversion_rate || 0}%`,
        `$${segment.avg_arpu || 0}`
      ]);
    });

    addTable(doc, segmentData, [100, 60, 70, 70, 60, 60]);
  }

  // Распределение клиентов по сегментам
  addPageBreakIfNeeded(doc);
  addSectionTitle(doc, '7. Customer Distribution by Segment');

  if (segmentDistribution && segmentDistribution.length > 0) {
    const distributionData = [
      ['Segment', 'Customers', 'Avg ARPU', 'Avg Churn']
    ];

    segmentDistribution.forEach(segment => {
      distributionData.push([
        truncateText(segment.segment_name, 25),
        segment.customer_count || 0,
        `$${segment.avg_arpu || 0}`,
        segment.avg_churn_score || 0
      ]);
    });

    addTable(doc, distributionData, [150, 80, 80, 100]);
  }

  // Футер
  addFooter(doc);

  return doc;
};

/**
 * Добавить заголовок документа
 */
function addHeader(doc, title) {
  doc.fontSize(20)
    .fillColor('#2D3748')
    .text(title, { align: 'center' });
  doc.moveDown(0.5);

  // Дата генерации
  doc.fontSize(10)
    .fillColor('#718096')
    .text(`Generated: ${formatDate(new Date())}`, { align: 'center' });
  doc.moveDown();

  // Линия под заголовком
  doc.moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .strokeColor('#E2E8F0')
    .stroke();
  doc.moveDown();
}

/**
 * Добавить заголовок секции
 */
function addSectionTitle(doc, title) {
  doc.fontSize(14)
    .fillColor('#4A5568')
    .text(title);
  doc.moveDown(0.5);
}

/**
 * Добавить таблицу
 */
function addTable(doc, data, columnWidths) {
  const startX = 50;
  let y = doc.y;
  const rowHeight = 20;
  const cellPadding = 5;

  data.forEach((row, rowIndex) => {
    let x = startX;
    const isHeader = rowIndex === 0;

    // Проверяем нужен ли перенос на новую страницу
    if (y > 750) {
      doc.addPage();
      y = 50;
    }

    // Фон для заголовка
    if (isHeader) {
      doc.rect(x, y, columnWidths.reduce((a, b) => a + b, 0), rowHeight)
        .fillColor('#EDF2F7')
        .fill();
    }

    // Чередование строк
    if (!isHeader && rowIndex % 2 === 0) {
      doc.rect(x, y, columnWidths.reduce((a, b) => a + b, 0), rowHeight)
        .fillColor('#F7FAFC')
        .fill();
    }

    row.forEach((cell, colIndex) => {
      const width = columnWidths[colIndex];

      doc.fontSize(isHeader ? 9 : 8)
        .fillColor(isHeader ? '#2D3748' : '#4A5568')
        .text(String(cell), x + cellPadding, y + cellPadding, {
          width: width - cellPadding * 2,
          height: rowHeight - cellPadding,
          ellipsis: true,
          lineBreak: false
        });

      x += width;
    });

    y += rowHeight;
  });

  doc.y = y;
  doc.moveDown();
}

/**
 * Проверить необходимость перехода на новую страницу
 */
function addPageBreakIfNeeded(doc) {
  if (doc.y > 700) {
    doc.addPage();
  }
}

/**
 * Добавить футер
 */
function addFooter(doc) {
  const pageCount = doc.bufferedPageRange().count;

  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);

    // Линия
    doc.moveTo(50, 780)
      .lineTo(545, 780)
      .strokeColor('#E2E8F0')
      .stroke();

    // Номер страницы
    doc.fontSize(8)
      .fillColor('#A0AEC0')
      .text(
        `Page ${i + 1} of ${pageCount}`,
        50,
        785,
        { align: 'center', width: 495 }
      );

    // Название системы
    doc.fontSize(8)
      .fillColor('#A0AEC0')
      .text(
        'NBA Offer Manager',
        50,
        785,
        { align: 'left', width: 200, continued: false }
      );
  }
}

/**
 * Форматирование даты
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Обрезать текст до определённой длины
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

module.exports = {
  generateAnalyticsReport
};
