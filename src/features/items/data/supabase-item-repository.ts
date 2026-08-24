import { assertOnline } from '../../../shared/lib/network'
import { supabase } from '../../../shared/lib/supabase'
import type { Item } from '../domain/item'
import { imageUrlTtlSeconds } from '../domain/item-image'
import type { ItemRepository } from '../domain/item-repository'

const columns = 'id, name, quantity, is_purchased, image_path, catalog_product_id, created_at'
const imagesBucket = 'item-images'
const duplicateKey = '23505'

type ItemRow = {
  id: string
  name: string
  quantity: number
  is_purchased: boolean
  image_path: string | null
  catalog_product_id: string | null
  created_at: string
}

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    isPurchased: row.is_purchased,
    imagePath: row.image_path,
    catalogProductId: row.catalog_product_id,
    createdAt: row.created_at,
  }
}

export const supabaseItemRepository: ItemRepository = {
  async list(communityId) {
    await assertOnline()

    const { data, error } = await supabase
      .from('items')
      .select(columns)
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`No se pudieron cargar los artículos: ${error.message}`)
    }

    return (data ?? []).map(toItem)
  },

  async add({ id, communityId, name, quantity, catalogProductId }) {
    await assertOnline()

    const { data, error } = await supabase
      .from('items')
      .insert({
        id,
        community_id: communityId,
        name,
        quantity,
        catalog_product_id: catalogProductId,
      })
      .select(columns)
      .single()

    if (error?.code === duplicateKey) {
      const { data: existing } = await supabase.from('items').select(columns).eq('id', id).single()

      if (existing) {
        return toItem(existing)
      }
      throw new Error(`El artículo ${id} ya se había añadido y ya no está en la lista`)
    }

    if (error) {
      throw new Error(`No se pudo añadir el artículo: ${error.message}`)
    }

    return toItem(data)
  },

  async edit(itemId, { name, quantity, imagePath }) {
    await assertOnline()

    const patch: { name: string; quantity: number; image_path?: string | null } = { name, quantity }
    if (imagePath !== undefined) {
      patch.image_path = imagePath
    }

    const { error } = await supabase.from('items').update(patch).eq('id', itemId)

    if (error) {
      throw new Error(`No se pudo editar el artículo: ${error.message}`)
    }
  },

  async setPurchased(itemId, isPurchased) {
    await assertOnline()

    const { error } = await supabase
      .from('items')
      .update({ is_purchased: isPurchased })
      .eq('id', itemId)

    if (error) {
      throw new Error(`No se pudo actualizar el artículo: ${error.message}`)
    }
  },

  async remove(itemId) {
    await assertOnline()

    const { error } = await supabase.from('items').delete().eq('id', itemId)

    if (error) {
      throw new Error(`No se pudo borrar el artículo: ${error.message}`)
    }
  },

  async uploadImage({ communityId, itemId, uri }) {
    await assertOnline()

    const body = await fetch(uri).then((response) => response.arrayBuffer())
    const path = `${communityId}/${itemId}-${Date.now()}.jpg`

    const { error } = await supabase.storage
      .from(imagesBucket)
      .upload(path, body, { contentType: 'image/jpeg', upsert: true })

    if (error) {
      throw new Error(`No se pudo subir la foto: ${error.message}`)
    }

    return path
  },

  async removeImage(path) {
    await assertOnline()

    const { error } = await supabase.storage.from(imagesBucket).remove([path])

    if (error) {
      throw new Error(`No se pudo borrar la foto: ${error.message}`)
    }
  },

  async signImageUrl(path) {
    await assertOnline()

    const { data, error } = await supabase.storage
      .from(imagesBucket)
      .createSignedUrl(path, imageUrlTtlSeconds)

    if (error || !data) {
      throw new Error(`No se pudo abrir la foto: ${error?.message ?? 'sin respuesta'}`)
    }

    return data.signedUrl
  },

  subscribe(communityId, { onChange, onStatus }) {
    const channel = supabase
      .channel(`items:${communityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `community_id=eq.${communityId}`,
        },
        () => onChange(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          onStatus('connected')
          return
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          onStatus('disconnected')
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  },
}
