<?php
/**
 * Plugin Name: WP Vite Plugin E2E Host
 * Description: Host plugin used by @asolopovas/vite-plugin-wp e2e tests. Registers the Test block and loads assets produced by Vite (dev or prod).
 * Version:     0.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

define('WPVP_HOST_DIR', __DIR__);
define('WPVP_HOST_URL', plugin_dir_url(__FILE__));

function wpvp_host_hot_url(): ?string {
    $hot = WPVP_HOST_DIR . '/static/build/hot';
    if (!file_exists($hot)) {
        return null;
    }
    $url = trim((string) file_get_contents($hot));
    return $url !== '' ? $url : null;
}

function wpvp_host_manifest(): array {
    $file = WPVP_HOST_DIR . '/static/build/manifest.json';
    if (!file_exists($file)) {
        return [];
    }
    $decoded = json_decode((string) file_get_contents($file), true);
    return is_array($decoded) ? $decoded : [];
}

function wpvp_host_register_block(): void {
    register_block_type(WPVP_HOST_DIR . '/src/blocks/Test');
}
add_action('init', 'wpvp_host_register_block');

function wpvp_host_enqueue_dev(string $hot): void {
    $entries = [
        'vite-client'      => $hot . '/@vite/client',
        'wpvp-host-blocks' => $hot . '/src/vite-blocks.ts',
    ];
    foreach ($entries as $handle => $src) {
        wp_enqueue_script($handle, $src, [], null, true);
    }
    add_filter('script_loader_tag', function ($tag, $handle) use ($entries) {
        if (!isset($entries[$handle])) {
            return $tag;
        }
        return preg_replace('#<script (?!type=)#', '<script type="module" ', $tag, 1);
    }, 10, 2);
}

function wpvp_host_enqueue_prod(): void {
    $manifest = wpvp_host_manifest();
    $entry    = 'src/vite-blocks.ts';
    if (!isset($manifest[$entry])) {
        return;
    }
    $item = $manifest[$entry];
    $base = WPVP_HOST_URL . 'static/build/';

    wp_enqueue_script(
        'wpvp-host-blocks',
        $base . $item['file'],
        ['wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n'],
        null,
        true
    );
    add_filter('script_loader_tag', function ($tag, $handle) {
        if ($handle !== 'wpvp-host-blocks') {
            return $tag;
        }
        return preg_replace('#<script (?!type=)#', '<script type="module" ', $tag, 1);
    }, 10, 2);

    if (!empty($item['css']) && is_array($item['css'])) {
        foreach ($item['css'] as $i => $css) {
            wp_enqueue_style('wpvp-host-blocks-' . $i, $base . $css, [], null);
        }
    }
}

function wpvp_host_enqueue(): void {
    $hot = wpvp_host_hot_url();
    if ($hot) {
        wpvp_host_enqueue_dev($hot);
    } else {
        wpvp_host_enqueue_prod();
    }
}
add_action('enqueue_block_editor_assets', 'wpvp_host_enqueue');
add_action('wp_enqueue_scripts', 'wpvp_host_enqueue');

function wpvp_host_check_dev_mode(): void {
    wp_send_json([
        'isDev' => (bool) wpvp_host_hot_url(),
    ]);
}
add_action('wp_ajax_check_vite_dev_mode', 'wpvp_host_check_dev_mode');
add_action('wp_ajax_nopriv_check_vite_dev_mode', 'wpvp_host_check_dev_mode');
