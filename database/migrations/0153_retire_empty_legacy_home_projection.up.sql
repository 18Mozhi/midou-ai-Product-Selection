-- Only the retired workspace projection may be removed; retain any unexpected rows.
CREATE TEMPORARY TABLE scoutops_home_projection_retirement_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_home_projection_retirement_guard VALUES (1);
INSERT INTO scoutops_home_projection_retirement_guard SELECT 1 FROM home_dashboard_items LIMIT 1;
INSERT INTO scoutops_home_projection_retirement_guard
SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='home_dashboard_items'
LIMIT 1;
DROP TEMPORARY TABLE scoutops_home_projection_retirement_guard;
DROP TABLE home_dashboard_items;
