-- Placeholder "#" links are dead; clear them. Storefront hides socials with no URL.
update website_content set cta_link = null where cta_link = '#';
update website_content set cta2_link = null where cta2_link = '#';
update website_sections set cta_link = null where cta_link = '#';
update offers set cta_href = null where cta_href = '#';
