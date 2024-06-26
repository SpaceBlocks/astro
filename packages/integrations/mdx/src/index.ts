import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { markdownConfigDefaults } from '@astrojs/markdown-remark';
import type { AstroIntegration, ContentEntryType, HookParameters } from 'astro';
import astroJSXRenderer from 'astro/jsx/renderer.js';
import type { Options as RemarkRehypeOptions } from 'remark-rehype';
import type { PluggableList } from 'unified';
import type { OptimizeOptions } from './rehype-optimize-static.js';
import { ignoreStringPlugins, parseFrontmatter } from './utils.js';
import { vitePluginMdxPostprocess } from './vite-plugin-mdx-postprocess.js';
import { vitePluginMdx } from './vite-plugin-mdx.js';

export type MdxOptions = Omit<typeof markdownConfigDefaults, 'remarkPlugins' | 'rehypePlugins'> & {
	extendMarkdownConfig: boolean;
	recmaPlugins: PluggableList;
	// Markdown allows strings as remark and rehype plugins.
	// This is not supported by the MDX compiler, so override types here.
	remarkPlugins: PluggableList;
	rehypePlugins: PluggableList;
	remarkRehype: RemarkRehypeOptions;
	optimize: boolean | OptimizeOptions;
};

type SetupHookParams = HookParameters<'astro:config:setup'> & {
	// `addPageExtension` and `contentEntryType` are not a public APIs
	// Add type defs here
	addPageExtension: (extension: string) => void;
	addContentEntryType: (contentEntryType: ContentEntryType) => void;
};

export default function mdx(partialMdxOptions: Partial<MdxOptions> = {}): AstroIntegration {
	return {
		name: '@astrojs/mdx',
		hooks: {
			'astro:config:setup': async (params) => {
				const { updateConfig, config, addPageExtension, addContentEntryType, addRenderer } =
					params as SetupHookParams;

				addRenderer(astroJSXRenderer);
				addPageExtension('.mdx');
				addContentEntryType({
					extensions: ['.mdx'],
					async getEntryInfo({ fileUrl, contents }: { fileUrl: URL; contents: string }) {
						const parsed = parseFrontmatter(contents, fileURLToPath(fileUrl));
						return {
							data: parsed.data,
							body: parsed.content,
							slug: parsed.data.slug,
							rawData: parsed.matter,
						};
					},
					contentModuleTypes: await fs.readFile(
						new URL('../template/content-module-types.d.ts', import.meta.url),
						'utf-8'
					),
					// MDX can import scripts and styles,
					// so wrap all MDX files with script / style propagation checks
					handlePropagation: true,
				});

				const extendMarkdownConfig =
					partialMdxOptions.extendMarkdownConfig ?? defaultMdxOptions.extendMarkdownConfig;

				const mdxOptions = applyDefaultOptions({
					options: partialMdxOptions,
					defaults: markdownConfigToMdxOptions(
						extendMarkdownConfig ? config.markdown : markdownConfigDefaults
					),
				});

				updateConfig({
					vite: {
						plugins: [vitePluginMdx(config, mdxOptions), vitePluginMdxPostprocess(config)],
					},
				});
			},
		},
	};
}

const defaultMdxOptions = {
	extendMarkdownConfig: true,
	recmaPlugins: [],
};

function markdownConfigToMdxOptions(markdownConfig: typeof markdownConfigDefaults): MdxOptions {
	return {
		...defaultMdxOptions,
		...markdownConfig,
		remarkPlugins: ignoreStringPlugins(markdownConfig.remarkPlugins),
		rehypePlugins: ignoreStringPlugins(markdownConfig.rehypePlugins),
		remarkRehype: (markdownConfig.remarkRehype as any) ?? {},
		optimize: false,
	};
}

function applyDefaultOptions({
	options,
	defaults,
}: {
	options: Partial<MdxOptions>;
	defaults: MdxOptions;
}): MdxOptions {
	return {
		syntaxHighlight: options.syntaxHighlight ?? defaults.syntaxHighlight,
		extendMarkdownConfig: options.extendMarkdownConfig ?? defaults.extendMarkdownConfig,
		recmaPlugins: options.recmaPlugins ?? defaults.recmaPlugins,
		remarkRehype: options.remarkRehype ?? defaults.remarkRehype,
		gfm: options.gfm ?? defaults.gfm,
		smartypants: options.smartypants ?? defaults.smartypants,
		remarkPlugins: options.remarkPlugins ?? defaults.remarkPlugins,
		rehypePlugins: options.rehypePlugins ?? defaults.rehypePlugins,
		shikiConfig: options.shikiConfig ?? defaults.shikiConfig,
		optimize: options.optimize ?? defaults.optimize,
	};
}
