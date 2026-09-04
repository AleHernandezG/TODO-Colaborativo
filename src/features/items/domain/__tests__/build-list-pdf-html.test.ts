import { buildListPdfHtml, type ListPdfLabels } from '../build-list-pdf-html'
import type { Item } from '../item'

describe('buildListPdfHtml', () => {
  const mockLabels: ListPdfLabels = {
    title: 'Lista de la compra',
    pendingSection: 'Por comprar',
    purchasedSection: 'Comprados',
    emptySection: 'Sin artículos en esta sección',
    totalSummary: 'Total de artículos',
    generatedAt: 'Generado',
  }

  const mockDate = '5 de septiembre de 2026, 12:00'

  it('escapa correctamente caracteres especiales HTML en el nombre de la comunidad y artículos', () => {
    const items: Item[] = [
      {
        id: '1',
        name: 'Tomates <cherry> & "pera"',
        quantity: 1,
        isPurchased: false,
        imagePath: null,
        catalogProductId: null,
        createdAt: '2026-09-01T10:00:00Z',
      },
    ]

    const html = buildListPdfHtml({
      communityName: 'Piso 1 <A> & "Amigos"',
      items,
      labels: mockLabels,
      formattedDate: mockDate,
    })

    expect(html).toContain('Piso 1 &lt;A&gt; &amp; &quot;Amigos&quot;')
    expect(html).toContain('Tomates &lt;cherry&gt; &amp; &quot;pera&quot;')
    expect(html).not.toContain('<cherry>')
  })

  it('renderiza secciones separadas para pendientes y comprados', () => {
    const items: Item[] = [
      {
        id: '1',
        name: 'Pan',
        quantity: 2,
        isPurchased: false,
        imagePath: null,
        catalogProductId: null,
        createdAt: '2026-09-01T10:00:00Z',
      },
      {
        id: '2',
        name: 'Leche',
        quantity: 1,
        isPurchased: true,
        imagePath: null,
        catalogProductId: null,
        createdAt: '2026-09-01T10:00:00Z',
      },
    ]

    const html = buildListPdfHtml({
      communityName: 'Familia',
      items,
      labels: mockLabels,
      formattedDate: mockDate,
    })

    expect(html).toContain('Por comprar')
    expect(html).toContain('Comprados')
    expect(html).toContain('Pan')
    expect(html).toContain('&times; 2')
    expect(html).toContain('Leche')
    expect(html).toContain('item-purchased')
  })

  it('muestra mensaje de vacío si no hay artículos en una sección', () => {
    const items: Item[] = [
      {
        id: '1',
        name: 'Huevos',
        quantity: 6,
        isPurchased: false,
        imagePath: null,
        catalogProductId: null,
        createdAt: '2026-09-01T10:00:00Z',
      },
    ]

    const html = buildListPdfHtml({
      communityName: 'Mi Casa',
      items,
      labels: mockLabels,
      formattedDate: mockDate,
    })

    expect(html).toContain('Huevos')
    // Comprados está vacío, debe mostrar emptySection
    expect(html).toContain('Sin artículos en esta sección')
  })

  it('incluye fecha, cabecera y conteos en el footer', () => {
    const html = buildListPdfHtml({
      communityName: 'Campamento',
      items: [],
      labels: mockLabels,
      formattedDate: mockDate,
    })

    expect(html).toContain('Campamento')
    expect(html).toContain(mockDate)
    expect(html).toContain('Total de artículos: 0')
  })
})
