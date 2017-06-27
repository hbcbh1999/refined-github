import toMarkdown from 'to-markdown';
import copyToClipboard from 'copy-text-to-clipboard';

const unwrapContent = content => content;
const unshortenRegex = /^https:[/][/](www[.])?|[/]$/g;

const converters = [
	// Drop unnecessary elements
	// <g-emoji> is GH's emoji wrapper
	// input and .handle appear in "- [ ] lists", let's not copy tasks
	{
		filter: node => node.matches('g-emoji,.handle,input.task-list-item-checkbox'),
		replacement: unwrapContent
	},

	// Unwrap commit/issue autolinks
	{
		filter: node => node.matches('.commit-link,.issue-link') || // GH autolinks
			(node.href && node.href.replace(unshortenRegex, '') === node.textContent), // Some of bfred-it/shorten-repo-url
		replacement: (content, element) => element.href
	},

	// Unwrap images
	{
		filter: node => node.tagName === 'A' && // It's a link
			node.childNodes.length === 1 && // It has one child
			node.firstChild.tagName === 'IMG' && // Its child is an image
			node.firstChild.src === node.href, // It links to its own image
		replacement: unwrapContent
	},

	// Keep <img> if it's customized
	{
		filter: node => node.matches('img[width],img[height],img[align]'),
		replacement: (content, element) => element.outerHTML
	},

	// Add support for <ol> lists that start after 1
	// Until https://github.com/domchristie/to-markdown/pull/187 is in
	{
		filter: 'li',
		replacement: (content, node) => {
			content = content.replace(/^\s+/, '').replace(/\n/gm, '\n    ');
			const parent = node.parentNode;
			const index = parent.start + Array.prototype.indexOf.call(parent.children, node);
			const prefix = /ol/i.test(parent.nodeName) ? index + '.  ' : '*   ';

			return prefix + content;
		}
	}
];

export default event => {
	const selection = window.getSelection();
	const range = selection.getRangeAt(0);
	const container = range.commonAncestorContainer;
	const containerEl = container.closest ? container : container.parentNode;

	// Exclude pure code selections and selections across markdown elements:
	// https://github.com/sindresorhus/refined-github/issues/522#issuecomment-311271274
	if (containerEl.closest('pre') || containerEl.querySelector('.markdown-body')) {
		return;
	}

	const holder = document.createElement('div');
	holder.append(range.cloneContents());

	// Wrap orphaned <li>s in their original parent
	// And keep the their original number
	if (holder.firstChild.tagName === 'LI') {
		const list = document.createElement(containerEl.tagName);
		try {
			const originalLi = range.startContainer.parentNode.closest('li');
			list.start = containerEl.start + [...containerEl.children].indexOf(originalLi);
		} catch (err) {}
		list.append(...holder.childNodes);
		holder.appendChild(list);
	}

	const markdown = toMarkdown(holder.innerHTML, {
		converters,
		gfm: true
	});

	copyToClipboard(markdown);

	event.stopImmediatePropagation();
	event.preventDefault();
};
