DO $$
DECLARE
  target_column record;
BEGIN
  FOR target_column IN
    SELECT columns.table_schema, columns.table_name, columns.column_name
    FROM information_schema.columns AS columns
    JOIN information_schema.tables AS tables
      ON tables.table_schema = columns.table_schema
      AND tables.table_name = columns.table_name
    WHERE columns.table_schema = 'public'
      AND tables.table_type = 'BASE TABLE'
      AND columns.data_type IN ('text', 'character varying', 'character')
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = $1 WHERE %I IN ($2, $3)',
      target_column.table_schema,
      target_column.table_name,
      target_column.column_name,
      target_column.column_name
    )
    USING '개발관리부', '개발부', '개발관리팀';
  END LOOP;
END
$$;
