import type { Item } from './item'

export type ListPdfLabels = {
  title: string
  pendingSection: string
  purchasedSection: string
  emptySection: string
  totalSummary: string
  generatedAt: string
}

export type BuildListPdfOptions = {
  communityName: string
  items: Item[]
  labels: ListPdfLabels
  formattedDate: string
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function buildListPdfHtml(options: BuildListPdfOptions): string {
  const { communityName, items, labels, formattedDate } = options

  const pendingItems = items.filter((item) => !item.isPurchased)
  const purchasedItems = items.filter((item) => item.isPurchased)

  const escapedCommunityName = escapeHtml(communityName)
  const escapedDate = escapeHtml(formattedDate)

  const renderItemRows = (itemList: Item[], isPurchased: boolean) => {
    if (itemList.length === 0) {
      return `<li class="empty-state">${escapeHtml(labels.emptySection)}</li>`
    }

    return itemList
      .map((item) => {
        const escapedName = escapeHtml(item.name)
        const qtyBadge =
          item.quantity > 1
            ? `<span class="item-qty">&times; ${item.quantity}</span>`
            : ''
        const checkContent = isPurchased ? '&#10003;' : ''
        const rowClass = isPurchased ? 'item-row item-purchased' : 'item-row'
        const checkClass = isPurchased ? 'checkbox checkbox-checked' : 'checkbox'

        return `
        <li class="${rowClass}">
          <span class="${checkClass}">${checkContent}</span>
          <span class="item-name">${escapedName}</span>
          ${qtyBadge}
        </li>`
      })
      .join('\n')
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapedCommunityName} - ${escapeHtml(labels.title)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 16mm 14mm 16mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      line-height: 1.45;
    }
    header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 4px 0;
      color: #0f172a;
    }
    .subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 0;
    }
    .date-badge {
      font-size: 12px;
      color: #475569;
      text-align: right;
    }
    .section {
      margin-bottom: 24px;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #334155;
      margin: 0;
    }
    .section-count {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
    }
    .item-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .item-row {
      display: flex;
      align-items: center;
      padding: 7px 4px;
      border-bottom: 1px solid #f1f5f9;
      page-break-inside: avoid;
    }
    .checkbox {
      width: 17px;
      height: 17px;
      border: 1.5px solid #64748b;
      border-radius: 3.5px;
      margin-right: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      flex-shrink: 0;
      color: #2563eb;
    }
    .checkbox-checked {
      background-color: #f1f5f9;
      border-color: #94a3b8;
      color: #64748b;
    }
    .item-name {
      font-size: 14.5px;
      font-weight: 500;
      flex: 1;
      color: #1e293b;
      word-break: break-word;
    }
    .item-purchased .item-name {
      color: #94a3b8;
      text-decoration: line-through;
    }
    .item-qty {
      font-size: 12px;
      font-weight: 600;
      color: #1d4ed8;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 1px 7px;
      border-radius: 9999px;
      margin-left: 8px;
      white-space: nowrap;
    }
    .item-purchased .item-qty {
      color: #94a3b8;
      background: #f8fafc;
      border-color: #e2e8f0;
    }
    .empty-state {
      font-size: 13px;
      font-style: italic;
      color: #94a3b8;
      padding: 10px 4px;
    }
    footer {
      margin-top: 28px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-content">
      <div>
        <h1>${escapedCommunityName}</h1>
        <p class="subtitle">${escapeHtml(labels.title)}</p>
      </div>
      <div class="date-badge">
        <span>${escapeHtml(labels.generatedAt)}: ${escapedDate}</span>
      </div>
    </div>
  </header>

  <main>
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">${escapeHtml(labels.pendingSection)}</h2>
        <span class="section-count">${pendingItems.length}</span>
      </div>
      <ul class="item-list">
        ${renderItemRows(pendingItems, false)}
      </ul>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">${escapeHtml(labels.purchasedSection)}</h2>
        <span class="section-count">${purchasedItems.length}</span>
      </div>
      <ul class="item-list">
        ${renderItemRows(purchasedItems, true)}
      </ul>
    </section>
  </main>

  <footer>
    <span>${escapeHtml(labels.totalSummary)}: ${items.length}</span>
    <span>${escapedCommunityName}</span>
  </footer>
</body>
</html>`
}
