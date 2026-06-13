<?php
/**
 * Plugin Name: Sikt Connector
 * Description: Lar Sikt (siktseo.com) oppdatere SEO-felter på siden
 *              din via et sikret REST-endepunkt.
 * Version: 1.1.0
 * Author: Sikt
 * License: Proprietary
 */

if (!defined('ABSPATH')) {
    exit; // Direkte tilgang ikke tillatt
}

add_action('rest_api_init', function () {
    register_rest_route('sikt/v1', '/update-meta', array(
        'methods' => 'POST',
        'callback' => 'sikt_update_meta_handler',
        'permission_callback' => function () {
            // Krev edit_posts capability — Application Password
            // med admin-bruker har dette.
            return current_user_can('edit_posts');
        },
        'args' => array(
            'post_id' => array(
                'required' => true,
                'type' => 'integer',
            ),
            'field' => array(
                'required' => true,
                'type' => 'string',
                'enum' => array('meta-description', 'seo-title', 'h1', 'content'),
            ),
            'value' => array(
                'required' => true,
                'type' => 'string',
            ),
        ),
    ));

    // v1.1.0: strukturert data (JSON-LD) injisert på forsiden.
    register_rest_route('sikt/v1', '/set-site-schema', array(
        'methods' => 'POST',
        'callback' => 'sikt_set_site_schema_handler',
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
        'args' => array(
            'jsonld' => array('required' => true, 'type' => 'string'),
        ),
    ));

    // v1.1.0: list bilder som mangler alt-tekst.
    register_rest_route('sikt/v1', '/images-without-alt', array(
        'methods' => 'GET',
        'callback' => 'sikt_images_without_alt_handler',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
    ));

    // v1.1.0: sett alt-tekst på et bilde (vedlegg).
    register_rest_route('sikt/v1', '/set-alt', array(
        'methods' => 'POST',
        'callback' => 'sikt_set_alt_handler',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
        'args' => array(
            'attachment_id' => array('required' => true, 'type' => 'integer'),
            'alt' => array('required' => true, 'type' => 'string'),
        ),
    ));
});

/**
 * Injiser Sikt-lagret JSON-LD på forsiden. Lagres som option, så det er
 * fullstendig reversibelt (tøm option = borte). Skrives kun av Sikt.
 */
add_action('wp_head', function () {
    if (!is_front_page() && !is_home()) {
        return;
    }
    $jsonld = get_option('sikt_site_jsonld', '');
    if (!is_string($jsonld) || trim($jsonld) === '') {
        return;
    }
    // Allerede validert som JSON ved lagring; skriv ut rått i en script-tag.
    echo "\n<script type=\"application/ld+json\" data-sikt=\"1\">" . $jsonld . "</script>\n";
}, 99);

function sikt_set_site_schema_handler($request) {
    $jsonld = (string) $request->get_param('jsonld');
    if (strlen($jsonld) > 12000) {
        return new WP_Error('too_long', 'JSON-LD er for langt (maks 12000 tegn).', array('status' => 400));
    }
    // Tom streng = fjern (rollback). Ellers krev gyldig JSON.
    if (trim($jsonld) !== '') {
        $decoded = json_decode($jsonld, true);
        if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
            return new WP_Error('invalid_json', 'Ugyldig JSON-LD.', array('status' => 400));
        }
    }
    $old_value = get_option('sikt_site_jsonld', '');
    update_option('sikt_site_jsonld', $jsonld, false);
    return rest_ensure_response(array(
        'ok' => true,
        'field' => 'site-schema',
        'old_value' => is_string($old_value) ? $old_value : '',
        'new_value' => $jsonld,
    ));
}

function sikt_images_without_alt_handler($request) {
    $limit = (int) $request->get_param('limit');
    if ($limit <= 0 || $limit > 50) {
        $limit = 20;
    }
    $attachments = get_posts(array(
        'post_type' => 'attachment',
        'post_mime_type' => 'image',
        'post_status' => 'inherit',
        'posts_per_page' => $limit,
        'meta_query' => array(
            'relation' => 'OR',
            array('key' => '_wp_attachment_image_alt', 'compare' => 'NOT EXISTS'),
            array('key' => '_wp_attachment_image_alt', 'value' => '', 'compare' => '='),
        ),
    ));
    $out = array();
    foreach ($attachments as $att) {
        $file = get_post_meta($att->ID, '_wp_attached_file', true);
        $out[] = array(
            'id' => $att->ID,
            'title' => $att->post_title,
            'filename' => is_string($file) ? basename($file) : '',
        );
    }
    return rest_ensure_response(array('ok' => true, 'images' => $out));
}

function sikt_set_alt_handler($request) {
    $attachment_id = (int) $request->get_param('attachment_id');
    $alt = (string) $request->get_param('alt');
    if (strlen($alt) > 300) {
        return new WP_Error('too_long', 'Alt-tekst er for lang (maks 300 tegn).', array('status' => 400));
    }
    $post = get_post($attachment_id);
    if (!$post || $post->post_type !== 'attachment') {
        return new WP_Error('post_not_found', 'Fant ikke bildet.', array('status' => 404));
    }
    if (!current_user_can('edit_post', $attachment_id)) {
        return new WP_Error('forbidden', 'Ingen tilgang til å redigere bildet.', array('status' => 403));
    }
    $old_value = get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
    update_post_meta($attachment_id, '_wp_attachment_image_alt', sanitize_text_field($alt));
    $written = get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
    if ($written !== sanitize_text_field($alt)) {
        return new WP_Error('write_failed', 'Lagret ikke alt-teksten korrekt.', array('status' => 500));
    }
    return rest_ensure_response(array(
        'ok' => true,
        'field' => 'alt',
        'attachment_id' => $attachment_id,
        'old_value' => is_string($old_value) ? $old_value : '',
        'new_value' => $written,
    ));
}

function sikt_build_gutenberg_paragraphs($raw_text) {
    $normalized = str_replace(array("\r\n", "\r"), "\n", (string) $raw_text);
    $parts = preg_split("/\n\s*\n/", $normalized, -1, PREG_SPLIT_NO_EMPTY);
    $blocks = array();

    if (empty($parts)) {
        $parts = array(trim($normalized));
    }

    foreach ($parts as $para) {
        $para = trim($para);
        if ($para === '') {
            continue;
        }
        $escaped = esc_html($para);
        $blocks[] = "<!-- wp:paragraph -->\n<p>{$escaped}</p>\n<!-- /wp:paragraph -->";
    }

    if (empty($blocks)) {
        $blocks[] = "<!-- wp:paragraph -->\n<p></p>\n<!-- /wp:paragraph -->";
    }

    return implode("\n\n", $blocks);
}

function sikt_update_meta_handler($request) {
    $post_id = (int) $request->get_param('post_id');
    $field = sanitize_text_field($request->get_param('field'));
    $value = (string) $request->get_param('value');

    // Verifiser at posten finnes og brukeren kan redigere den
    $post = get_post($post_id);
    if (!$post) {
        return new WP_Error('post_not_found', 'Fant ikke posten.',
            array('status' => 404));
    }
    if (!current_user_can('edit_post', $post_id)) {
        return new WP_Error('forbidden',
            'Du har ikke tilgang til å redigere denne posten.',
            array('status' => 403));
    }

    if ($field === 'h1') {
        if (strlen($value) > 200) {
            return new WP_Error('too_long',
                'H1-tittel er for lang (maks 200 tegn).',
                array('status' => 400));
        }

        $old_value = $post->post_title;

        $result = wp_update_post(array(
            'ID' => $post_id,
            'post_title' => $value,
        ), true);

        if (is_wp_error($result)) {
            return $result;
        }

        $updated = get_post($post_id);
        $written = $updated ? $updated->post_title : '';
        if ($written !== $value) {
            return new WP_Error('write_failed',
                'WordPress lagret ikke feltet korrekt.',
                array('status' => 500));
        }

        return rest_ensure_response(array(
            'ok' => true,
            'field' => 'h1',
            'old_value' => $old_value,
            'new_value' => $written,
        ));
    }

    if ($field === 'content') {
        if (strlen($value) > 20000) {
            return new WP_Error('too_long',
                'Sideinnhold er for langt (maks 20000 tegn).',
                array('status' => 400));
        }

        $old_value = $post->post_content;

        // Rollback sender full gammel post_content; push sender rå tekst som pakkes i blokker.
        $is_full_restore = (strpos($value, '<!-- wp:') !== false);
        $new_content = $is_full_restore
            ? $value
            : sikt_build_gutenberg_paragraphs($value);

        $result = wp_update_post(array(
            'ID' => $post_id,
            'post_content' => $new_content,
        ), true);

        if (is_wp_error($result)) {
            return $result;
        }

        $updated = get_post($post_id);
        $written = $updated ? $updated->post_content : '';
        if ($written !== $new_content) {
            return new WP_Error('write_failed',
                'WordPress lagret ikke feltet korrekt.',
                array('status' => 500));
        }

        return rest_ensure_response(array(
            'ok' => true,
            'field' => 'content',
            'old_value' => $old_value,
            'new_value' => $written,
        ));
    }

    // Mappe field-navn til Yoast-metanøkkel
    $meta_key_map = array(
        'meta-description' => '_yoast_wpseo_metadesc',
        'seo-title'        => '_yoast_wpseo_title',
    );
    if (!isset($meta_key_map[$field])) {
        return new WP_Error('invalid_field', 'Ugyldig felt.',
            array('status' => 400));
    }
    $meta_key = $meta_key_map[$field];

    // Hent gammel verdi (for vår egen verifisering, ikke for kunden)
    $old_value = get_post_meta($post_id, $meta_key, true);

    // Maks-lengder (defensive grenser)
    if ($field === 'meta-description' && strlen($value) > 500) {
        return new WP_Error('too_long',
            'Meta-beskrivelse er for lang (maks 500 tegn).',
            array('status' => 400));
    }
    if ($field === 'seo-title' && strlen($value) > 200) {
        return new WP_Error('too_long',
            'SEO-tittel er for lang (maks 200 tegn).',
            array('status' => 400));
    }

    // Skriv via WP's egen meta-funksjon
    $result = update_post_meta($post_id, $meta_key, $value);

    // Verifiser at skriving virkelig skjedde ved å lese tilbake
    $written = get_post_meta($post_id, $meta_key, true);
    if ($written !== $value) {
        return new WP_Error('write_failed',
            'WordPress lagret ikke feltet korrekt.',
            array('status' => 500));
    }

    return rest_ensure_response(array(
        'ok' => true,
        'field' => $field,
        'meta_key' => $meta_key,
        'old_value' => $old_value,
        'new_value' => $value,
    ));
}
