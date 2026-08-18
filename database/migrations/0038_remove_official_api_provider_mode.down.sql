ALTER TABLE `providers` MODIFY `access_mode` ENUM('public_page','public_rss','official_api','authenticated_browser','import','manual') NOT NULL;
