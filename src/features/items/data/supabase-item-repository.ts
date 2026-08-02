import { assertOnline } from '../../../shared/lib/network'
import { supabase } from '../../../shared/lib/supabase'
import type { Item } from '../domain/item'
import type { ItemRepository } from '../domain/item-repository'

const columns = 'id, name, quantity, is_purchased, created_at'

type ItemRow = {
  id: string
  name: string
  quantity: number
  is_purchased: boolean
  created_at: string
}

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    isPurchased: row.is_purchased,
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

  async add({ communityId, name, quantity }) {
    await assertOnline()

    const { data, error } = await supabase
      .from('items')
      .insert({ community_id: communityId, name, quantity })
      .select(columns)
      .single()

    if (error) {
      throw new Error(`No se pudo añadir el artículo: ${error.message}`)
    }

    return toItem(data)
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
