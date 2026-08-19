UPDATE `providers`
SET `status`='enabled', `access_mode`='public_page', `parser_version`='amazon-product-search-v1', `fields_json`=JSON_ARRAY('asin','title','price','currency','position','review_count','rating_value','availability','image_url','source_url'), `updated_at`=UTC_TIMESTAMP(3)
WHERE `code`='amazon_product';
