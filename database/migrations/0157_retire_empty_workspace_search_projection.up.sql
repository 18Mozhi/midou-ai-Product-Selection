-- This projection is not a source of business data. Stop legacy writers before checking it.
CREATE TEMPORARY TABLE scoutops_search_projection_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_search_projection_guard VALUES (1);
INSERT INTO scoutops_search_projection_guard SELECT 1 FROM search_documents LIMIT 1;
INSERT INTO scoutops_search_projection_guard
SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='search_documents' LIMIT 1;
DROP TEMPORARY TABLE scoutops_search_projection_guard;
DROP TABLE search_documents;
