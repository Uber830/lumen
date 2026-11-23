-- =========================================================================
-- ICFES seed: replaces the static initialQuestions / initialSimulacros
-- from src/lib/icfes-data.ts. Each row carries school_id =
-- 00000000-0000-0000-0000-000000000001 (the "Shared ICFES Bank"
-- sentinel school). Real schools will clone this content into their
-- own bank through the teacher ICFES routes.
-- =========================================================================

insert into public.schools (id, name, short_code, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'Shared ICFES Bank',
  'shared-bank',
  'active'
)
on conflict (id) do nothing;

-- Course and subject that the shared bank's demo simulation links
-- to. course_subjects has NOT NULL FKs to both.
insert into public.courses (id, school_id, name, grade_label)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Shared Course',
  'Demo'
)
on conflict (id) do nothing;

insert into public.subjects (id, school_id, name)
values (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  'Demo Subject'
)
on conflict (id) do nothing;

insert into public.course_subjects (id, school_id, course_id, subject_id)
values (
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000011'
)
on conflict (id) do nothing;

-- Plan catalog (idempotent; Phase 5 commit 1 also seeds these rows).
insert into public.plans (code, name, description, price_cents, currency, interval,
                          max_students, max_teachers, max_storage_gb, includes_icfes)
values
  ('basico', 'Basico', 'Para colegios pequenos que empiezan a digitalizarse.',
   49000, 'COP', 'monthly', 200, 15, 10, false),
  ('estandar', 'Estandar', 'El plan mas elegido por instituciones en crecimiento.',
   129000, 'COP', 'monthly', 1500, null, 100, true),
  ('premium', 'Premium', 'Para redes educativas con multiples sedes.',
   299000, 'COP', 'monthly', null, null, 1024, true)
on conflict (code) do nothing;

-- ICFES questions: the same ten items that shipped in
-- src/lib/icfes-data.ts initialQuestions. The correct_index lives in
-- icfes_answer_keys.
do $$
declare
  q record;
  ci uuid;
begin
  for q in
    select * from (values
      ('q1', 'Lectura critica', '11', 'Medio', 'Interpretativa',
       'Segun el texto, la intencion principal del autor es',
       'El rio que atraviesa la vereda dejo de crecer hace tres inviernos. Los mayores recuerdan cuando el agua llegaba a la mitad del puente; hoy los ninos cruzan a pie. Nadie ha querido nombrar lo que todos ven.',
       ARRAY['Describir un paisaje rural con fines turisticos',
             'Advertir sobre un cambio ambiental silenciado por la comunidad',
             'Narrar un accidente ocurrido en el puente',
             'Explicar el funcionamiento de las cuencas hidrograficas']::text[],
       1),
      ('q2', 'Matematicas', '9', 'Basico', 'Interpretativa',
       'Si 3x menos 7 = 14, el valor de x es',
       null,
       ARRAY['3', '5', '7', '9']::text[],
       2),
      ('q3', 'Ciencias naturales', '10', 'Alto', 'Argumentativa',
       'Un estudiante afirma que al aumentar la temperatura de un gas en un recipiente rigido aumenta su presion. La mejor justificacion es',
       null,
       ARRAY['el volumen del recipiente disminuye',
             'las moleculas chocan con mayor frecuencia y energia contra las paredes',
             'la masa del gas aumenta con el calor',
             'la densidad del gas se mantiene constante']::text[],
       1),
      ('q4', 'Sociales y ciudadanas', '11', 'Medio', 'Propositiva',
       'Ante el aumento de residuos en el colegio, la propuesta mas pertinente para reducirlos en la fuente seria',
       null,
       ARRAY['aumentar la frecuencia de recoleccion',
             'instalar mas canecas en los pasillos',
             'implementar estaciones de separacion y jornadas de reutilizacion',
             'contratar personal adicional de aseo']::text[],
       2),
      ('q5', 'Ingles', '11', 'Basico', 'Interpretativa',
       'Choose the option that best completes the sentence: "She ____ in Bogota since 2019."',
       null,
       ARRAY['live', 'is living', 'has lived', 'lived']::text[],
       2),
      ('q6', 'Matematicas', '5', 'Basico', 'Interpretativa',
       'El area de un triangulo de base 12 cm y altura 7 cm es',
       null,
       ARRAY['19 cm cuadrados', '42 cm cuadrados', '84 cm cuadrados', '38 cm cuadrados']::text[],
       1),
      ('q7', 'Ciencias naturales', '9', 'Basico', 'Interpretativa',
       'La funcion principal de los globulos rojos en el cuerpo humano es',
       null,
       ARRAY['transportar oxigeno', 'coagular la sangre', 'combatir infecciones', 'producir anticuerpos']::text[],
       0),
      ('q8', 'Lectura critica', '9', 'Alto', 'Argumentativa',
       'En el texto, la expresion "nadie ha querido nombrar lo que todos ven" sugiere que la comunidad',
       'El rio que atraviesa la vereda dejo de crecer hace tres inviernos. Los mayores recuerdan cuando el agua llegaba a la mitad del puente; hoy los ninos cruzan a pie. Nadie ha querido nombrar lo que todos ven.',
       ARRAY['desconoce el problema',
             'evita reconocer publicamente el problema',
             'celebra el nuevo cauce del rio',
             'planea mudarse de la vereda']::text[],
       1),
      ('q9', 'Sociales y ciudadanas', '10', 'Medio', 'Argumentativa',
       'La separacion de poderes en el Estado colombiano busca principalmente',
       null,
       ARRAY['acelerar los tramites administrativos',
             'evitar la concentracion del poder y garantizar control mutuo',
             'reducir el gasto publico',
             'descentralizar los impuestos']::text[],
       1),
      ('q10', 'Ingles', '9', 'Basico', 'Interpretativa',
       'Read the sign: "No littering". It means you must not',
       null,
       ARRAY['run', 'throw trash on the ground', 'speak loudly', 'take pictures']::text[],
       1)
    ) as t(id, area, grado, difficulty, competencia, prompt, reading, options, correct_index)
  loop
    insert into public.icfes_questions (
      school_id, area, grado, difficulty, competencia, prompt, reading, options, points
    )
    values (
      '00000000-0000-0000-0000-000000000001',
      q.area, q.grado, q.difficulty, q.competencia,
      q.prompt, q.reading, to_jsonb(q.options),
      1.0
    )
    on conflict do nothing
    returning id into ci;

    if ci is not null then
      insert into public.icfes_answer_keys (school_id, question_id, correct_index)
      values ('00000000-0000-0000-0000-000000000001', ci, q.correct_index)
      on conflict (question_id) do nothing;
    end if;
  end loop;
end;
$$;

-- Note: a demo icfes_simulations row is intentionally NOT seeded here.
-- icfes_simulations.posted_by is NOT NULL and references auth.users, so it
-- cannot be seeded without a real teacher/admin account. Real simulations are
-- created by the teacher ICFES routes once the bank is cloned to a real school.
