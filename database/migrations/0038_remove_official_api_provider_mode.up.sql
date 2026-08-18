UPDATE `providers` SET `access_mode`='public_page',`updated_at`=UTC_TIMESTAMP(3),`version`=`version`+1 WHERE `access_mode`='official_api';
ALTER TABLE `providers` MODIFY `access_mode` ENUM('public_page','public_rss','authenticated_browser','import','manual') NOT NULL;
