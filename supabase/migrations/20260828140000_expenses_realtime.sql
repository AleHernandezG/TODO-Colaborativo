-- RF-9: las tres tablas de gastos se crearon fuera de la publicación de Realtime, así que el
-- segundo móvil no veía un gasto nuevo hasta reabrir la pantalla.

alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table settlements;

-- Sin la fila vieja completa en el WAL, Realtime no puede evaluar filter: community_id=eq.<id>
-- sobre un DELETE: o el borrado no llega a quien le toca, o llega a todo el mundo.
alter table expenses replica identity full;
alter table settlements replica identity full;

-- expense_shares se queda fuera a propósito: no tiene community_id, así que su canal no se
-- podría filtrar por comunidad. Las cuotas se insertan en la misma transacción que su gasto y
-- se borran en cascada con él, de modo que el evento de expenses ya las cubre.
