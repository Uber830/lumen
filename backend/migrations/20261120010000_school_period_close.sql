-- ---------------------------------------------------------------------------
-- El cierre de un periodo academico
-- ---------------------------------------------------------------------------
-- Cuando el colegio cierra un periodo, el material de ese ciclo deja de
-- ser el material activo: queda archivado para la institucion, visible en
-- el historico y fuera de la lista del dia.
--
-- La columna vive en `material_schools` y no en `materials` porque el
-- material es del catalogo editorial (lo publica la plataforma) y lo que
-- se archiva es lo que ese colegio tiene activo. Un material archivado
-- para un colegio puede seguir activo para otro.
--
-- La fila no se borra: es el historico de lo que el colegio tuvo
-- disponible en cada ciclo.
-- ---------------------------------------------------------------------------

alter table public.material_schools
  add column if not exists archived_at timestamptz;

comment on column public.material_schools.archived_at is
  'When the material left the active material of the school: the cycle it belonged to was closed. The row stays as history.';

create index if not exists material_schools_active_idx
  on public.material_schools (school_id)
  where archived_at is null;
