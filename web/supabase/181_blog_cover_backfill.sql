-- 181_blog_cover_backfill.sql
-- Blog cards had no thumbnails: the webhook provider sends no cover field, but
-- every article body carries images. Backfill cover_image_url from the first
-- <img src> inside the stored HTML (the webhook now does this automatically
-- for new posts).

update blog_posts
set cover_image_url = substring(content_html from 'src="(https?://[^"]+)"')
where (cover_image_url is null or cover_image_url = '')
  and content_html ~ 'src="https?://';
