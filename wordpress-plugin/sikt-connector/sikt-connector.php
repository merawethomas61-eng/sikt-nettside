<?php
/**
 * Plugin Name: Sikt Connector
 * Description: Lar Sikt (siktseo.com) oppdatere SEO-felter på siden
 *              din via et sikret REST-endepunkt.
 * Version: 1.0.0
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
});

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
