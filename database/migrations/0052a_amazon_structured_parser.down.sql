UPDATE `providers`
SET `parser_version`='amazon-product-search-v1', `updated_at`=UTC_TIMESTAMP(3)
WHERE `code`='amazon_product' AND `parser_version`='amazon-structured-product-v2';
